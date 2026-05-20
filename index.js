const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  isJidGroup,
  downloadMediaMessage,
  Browsers,
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const { connectDB } = require('./src/database');
const config = require('./src/config');
const User = require('./src/models/User');
const Group = require('./src/models/Group');

const { handleGeneral } = require('./src/commands/general');
const { handleAdmin } = require('./src/commands/admin');
const { handleEconomy } = require('./src/commands/economy');
const { handleGambling } = require('./src/commands/gambling');
const { handleFun } = require('./src/commands/fun');
const { handleInteractions } = require('./src/commands/interactions');
const { handleGames, handleGameAnswer, activeGames } = require('./src/commands/games');
const { handlePokemon } = require('./src/commands/pokemon');
const { handleDownloader } = require('./src/commands/downloader');
const { handleRpg } = require('./src/commands/rpg');
const { handleGuild } = require('./src/commands/guild');
const { isOwner } = require('./src/utils/helpers');

const SESSION_DIR = path.join(__dirname, 'session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const logger = pino({ level: 'warn' });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((res) => rl.question(q, res));

let sock = null;
let reconnectAttempts = 0;
let savedPhoneNumber = process.env.BOT_NUMBER || '';

function clearSession() {
  try {
    const files = fs.readdirSync(SESSION_DIR);
    for (const file of files) {
      fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
    }
    console.log('🗑️  Session cleared.');
  } catch (e) {
    console.log('⚠️  Could not clear session files:', e.message);
  }
}

async function startBot() {
  await connectDB();

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  // Track whether this session had real credentials before connecting
  const hadCredentials = !!state.creds.registered;

  // Ask for phone number BEFORE creating the socket so the connection is
  // fresh when we call requestPairingCode (avoids "Connection Closed" errors)
  if (!hadCredentials && !savedPhoneNumber) {
    const raw = await question('\n📱 Enter your WhatsApp number (with country code, no + or spaces, e.g. 1234567890): ');
    savedPhoneNumber = raw.trim().replace(/[^0-9]/g, '');
  }

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`\n✨ Using WA v${version.join('.')} (isLatest: ${isLatest})`);

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    getMessage: async () => ({ conversation: '' }),
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 250,
  });

  let credsSavedThisSession = false;
  sock.ev.on('creds.update', () => {
    credsSavedThisSession = true;
    saveCreds();
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log('\n🔑 Bot was logged out / unpaired. Clearing session and restarting...');
        clearSession();
        reconnectAttempts = 0;
        setTimeout(startBot, 2000);
      } else if (!hadCredentials && !credsSavedThisSession) {
        // Fresh start, no creds yet and nothing was saved — stay quiet,
        // the pairing code request handles its own retries.
        return;
      } else {
        // Either we had credentials before, or credentials were just saved
        // during pairing (stream reset 515 after code entry) — reconnect.
        reconnectAttempts++;
        const delay = Math.min(3000 * reconnectAttempts, 15000);
        console.log(`🔄 Reconnecting in ${delay / 1000}s...`);
        setTimeout(startBot, delay);
      }
    }

    if (connection === 'open') {
      reconnectAttempts = 0;
      console.log('\n✅ Bot connected successfully!');
      console.log(`🤖 Bot Name: ${config.BOT_NAME}`);
      console.log(`📱 Logged in as: ${sock.user?.id}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✨ Aqua Bot is ready! Send .menu to get started.');
    }
  });

  if (!hadCredentials && savedPhoneNumber) {
    // Small delay to let the WebSocket handshake complete
    await new Promise(res => setTimeout(res, 1500));
    console.log(`\n🔑 Requesting pairing code for: +${savedPhoneNumber}`);

    const tryPair = async (attemptsLeft) => {
      try {
        const code = await sock.requestPairingCode(savedPhoneNumber);
        const formatted = code.match(/.{1,4}/g).join('-');
        console.log('\n╔════════════════════════════╗');
        console.log(`║   PAIRING CODE: ${formatted.padEnd(12)}║`);
        console.log('╚════════════════════════════╝');
        console.log('\n📲 How to pair:');
        console.log('   1. Open WhatsApp on your phone');
        console.log('   2. Go to Settings → Linked Devices');
        console.log('   3. Tap "Link a Device"');
        console.log('   4. Choose "Link with phone number instead"');
        console.log(`   5. Enter the code: ${formatted}`);
        console.log('\n⏳ Waiting for you to scan...\n');
      } catch (err) {
        if (attemptsLeft > 0) {
          console.log(`⚠️  Pairing request failed (${err.message}), retrying in 3s...`);
          setTimeout(() => tryPair(attemptsLeft - 1), 3000);
        } else {
          console.log('❌ Could not get pairing code after multiple attempts. Restarting...');
          setTimeout(startBot, 5000);
        }
      }
    };

    tryPair(4);
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        if (!message.message) continue;
        if (message.key.fromMe) continue;
        if (isJidBroadcast(message.key.remoteJid)) continue;

        const sender = message.key.participant || message.key.remoteJid;
        const groupJid = isJidGroup(message.key.remoteJid) ? message.key.remoteJid : null;
        const isGroup = !!groupJid;
        const dest = isGroup ? groupJid : sender;

        const body =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          message.message?.imageMessage?.caption ||
          message.message?.videoMessage?.caption ||
          message.message?.buttonsResponseMessage?.selectedButtonId ||
          message.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          '';

        const prefix = config.PREFIX;
        const isCommand = body.startsWith(prefix);

        if (isGroup) {
          try {
            const now = new Date();
            const updated = await Group.findOneAndUpdate(
              { jid: groupJid, 'memberActivity.jid': sender },
              { $set: { 'memberActivity.$.lastSeen': now }, $inc: { 'memberActivity.$.messageCount': 1 } }
            );
            if (!updated) {
              await Group.findOneAndUpdate(
                { jid: groupJid },
                { $push: { memberActivity: { jid: sender, lastSeen: now, messageCount: 1 } } },
                { upsert: true }
              );
            }
          } catch (_) {}
        }

        if (!isCommand) {
          await handleGameAnswer(sock, message, body, sender, isGroup, groupJid);

          if (isGroup) {
            const group = await Group.findOne({ jid: groupJid });
            if (group?.antilink && body.match(/https?:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+/)) {
              try {
                await sock.groupParticipantsUpdate(groupJid, [sender], 'remove');
                await sock.sendMessage(groupJid, { text: `⚠️ @${sender.split('@')[0]} was removed for sharing invite links!`, mentions: [sender] });
              } catch (_) {
                await sock.sendMessage(groupJid, { text: `⚠️ @${sender.split('@')[0]} please don't share links!`, mentions: [sender] }, { quoted: message });
              }
            }
          }
          continue;
        }

        const args = body.slice(prefix.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();

        let user = await User.findOne({ jid: sender });
        if (!user) {
          user = new User({ jid: sender, name: message.pushName || sender.split('@')[0] });
          await user.save();
        } else if (user.name !== message.pushName && message.pushName) {
          user.name = message.pushName;
          await user.save();
        }

        if (user.banned && !isOwner(sender)) {
          await sock.sendMessage(dest, { text: '*🚫 Access Denied*' }, { quoted: message });
          continue;
        }

        if (isGroup) {
          const group = await Group.findOne({ jid: groupJid });
          if (group && !group.active && !isOwner(sender)) continue;
          if (group?.mutedMembers?.includes(sender)) continue;
        }

        let handled = false;

        handled = await handleGeneral(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleAdmin(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleEconomy(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleGambling(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleFun(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleInteractions(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleGames(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handlePokemon(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleDownloader(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleRpg(sock, message, command, args, sender, isGroup, groupJid);
        if (!handled) handled = await handleGuild(sock, message, command, args, sender, isGroup, groupJid);

        // Unknown commands are silently ignored

      } catch (err) {
        console.error('⚠️ Error handling message:', err.message);
      }
    }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      const group = await Group.findOne({ jid: id });
      if (!group) return;

      for (const participant of participants) {
        if (action === 'add' && group.welcome) {
          let avatarUrl = null;
          try { avatarUrl = await sock.profilePictureUrl(participant, 'image'); } catch (_) {}
          const welcomeText = `👋 Welcome to the group, @${participant.split('@')[0]}!\n\n🎉 We're happy to have you here!\nType *.menu* to see what I can do!`;
          await sock.sendMessage(id, {
            text: welcomeText,
            mentions: [participant],
          });
        }
        if (action === 'remove' && group.goodbye) {
          await sock.sendMessage(id, {
            text: `👋 Goodbye @${participant.split('@')[0]}! We'll miss you!`,
            mentions: [participant],
          });
        }
      }
    } catch (err) {
      console.error('Group update error:', err.message);
    }
  });

  return sock;
}

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

startBot().catch(console.error);
