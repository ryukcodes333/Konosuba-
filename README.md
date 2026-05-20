# 🤖 Aqua Bot — WhatsApp Bot (KONOSUBA Community)

A feature-rich WhatsApp bot powered by Baileys with pairing code authentication.

## 🚀 Setup & Installation

### Requirements
- Node.js 18+
- MongoDB Atlas account

### Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the bot:**
   ```bash
   npm start
   ```

3. **Pair your phone:**
   - The bot will ask for your phone number (with country code, no `+` or spaces)
   - Example: `12345678901` for +1 (234) 567-8901
   - A **pairing code** will appear in the console
   - Open WhatsApp → Settings → Linked Devices → Link a Device
   - Choose "Link with phone number instead"
   - Enter the code shown in the console

4. **Done!** Your bot is running. Send `.menu` to see all commands.

## 📋 Commands

- `.menu` — View all commands (with image)
- `.mods` — View moderators
- `.p / .profile` — View user profile card
- `.bal / .balance` — View account balance
- `.ping` — Check bot speed

### 💰 Economy
Daily rewards, fishing, digging, work, crime, rob, heist, shop, market, and more!

### 🎲 Gambling
Coin flip, slots, blackjack, roulette, dice, lottery, bet, high-low, crash — all with 30% win rate!

### 🎉 Fun
Jokes, quotes, facts, truth or dare, 8-ball, ship, roast, compliment, and more!

### 💞 Interactions
Hug, kiss, pat, slap, punch, bite, cuddle, poke, tickle, wave, and more!

### 🎮 Games
Hangman, trivia, math quiz, word scramble, guess the number, fast type, minesweeper, duel!

### 🐾 Pokémon
Full Pokémon system: starters, catching, training, evolving, battles!

### ⚔️ RPG
Class system, dungeons, boss battles, raids, crafting, forging!

### 🏰 Guild
Create/join guilds, invite members, guild leaderboard!

### ⬇️ Downloader
YouTube MP3/MP4, play music, TikTok, Instagram!

## ⚙️ Configuration

Edit `src/config.js` to change:
- `OWNER_JID` — Bot owner's JID
- `PREFIX` — Command prefix (default: `.`)
- `MONGO_URI` — MongoDB connection string

## 📁 File Structure

```
bot/
├── index.js              # Main bot entry point
├── package.json
├── assets/
│   └── menu.jpg          # Menu image (Aqua)
└── src/
    ├── config.js          # Configuration
    ├── database.js        # MongoDB connection
    ├── models/
    │   ├── User.js        # User data model
    │   ├── Group.js       # Group settings model
    │   └── Guild.js       # Guild model
    ├── commands/
    │   ├── general.js     # Menu, profile, mods
    │   ├── admin.js       # Group admin commands
    │   ├── economy.js     # Economy system
    │   ├── gambling.js    # Gambling games
    │   ├── fun.js         # Fun commands
    │   ├── interactions.js# Social interactions
    │   ├── games.js       # Mini-games
    │   ├── pokemon.js     # Pokémon system
    │   ├── downloader.js  # Media downloader
    │   ├── rpg.js         # RPG system
    │   └── guild.js       # Guild system
    └── utils/
        ├── helpers.js     # Utility functions
        └── imageGen.js    # Profile card image generator
```

## 📝 Notes

- Session files are saved in `session/` folder — keep this safe!
- To re-pair, delete the `session/` folder and restart
- Bot must be admin in groups for admin commands to work
- Owner commands only work for the configured owner number
