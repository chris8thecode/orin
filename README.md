<h1 align="center">Orin</h1>

<p align="center">
  <img src="https://files.catbox.moe/o2yft0.png" alt="Orin Logo"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" />
</p>

<p align="center">
  A feature-rich WhatsApp bot built with <a href="https://github.com/WhiskeySockets/Baileys">Baileys</a> and <a href="https://bun.sh/">Bun</a> that provides automated messaging, admin controls and a comprehensive web dashboard for management.
</p>

## Features

- **WhatsApp Automation**: Automated message handling and responses
- **Web Dashboard**: Admin, user and general dashboards for bot management
- **Admin Commands**: Generate API keys, manage users, mute/kick functionality, settings management
- **General Commands**: Ping, speed test, info, menu, and more
- **Anti-Spam Protection**: Built-in spam detection and prevention
- **SQLite Database**: Persistent data storage and query management
- **Native WebSocket**: Real-time communication via Bun's high-performance pub/sub
- **Structured Logging**: Pino logger with detailed output
- **Environment Configuration**: Secure configuration management with .env support
- **Bun Server**: High-performance HTTP server with 2.5x faster throughput than Express

## Requirements

- **Bun:** v1.0 or higher
- **.env file:** Required environment variables configured

## Quick Start

### Installation

```bash
# Clone repo
git clone https://github.com/chris8thecode/orin.git

# Navigate to project
cd orin

# Install dependencies with Bun
bun i
```

### Configuration

Create a `.env` file in the project root with required variables:

```env
PREFIX=!
OWNER_NUMBER=gets auto filled on successful pair
ADMIN_CONTACT=+1234567890
PORT=3000
PASSKEY_SECRET=your_secret_key
```

### Running the Bot

```bash
bun start
```

### Generate Secret Key

Generate a secure passkey for admin authentication:

```bash
bun run generate-secret
```

## Core Modules

### **Bot Connection** (`src/bot/connection.js`)

Manages WhatsApp connection, session persistence and event handling using Baileys library.

### **Message Handler** (`src/bot/messageHandler.js`)

Processes incoming messages with:

- Command parsing (prefix-based)
- Anti-spam validation
- Message type detection (text, image, video, etc...)
- Error handling and logging

### **Anti-Spam** (`src/bot/antiSpam.js`)

Implements rate limiting and spam detection to prevent abuse.

### **Command System** (`src/bot/commands/`)

Modular command architecture with admin and general command categories. Each command implements:

- Execution logic
- Permission checks
- Parameter validation

### **Database** (`src/database/`)

SQLite3 integration with persistent storage for:

- User data
- Settings
- API keys
- Session information

### **Server** (`src/server/`)

High-performance Bun.serve() server providing:

- Fast HTTP request handling (2.5x faster than Express)
- RESTful API endpoints with native routing
- Static file serving with zero-allocation dispatch
- Native WebSocket support with built-in pub/sub for real-time updates
- Automatic port fallback for conflict resolution

### **WebSocket** (integrated in `src/server/routes.js`)

Real-time communication via Bun's native WebSocket and pub/sub system:

- Dashboard clients subscribe to `dashboard-stats` topic
- Live stats broadcasting every 2 seconds
- 7x higher throughput compared to traditional WebSocket libraries
- Automatic client lifecycle management (open/close/message)

## Commands

### Admin Commands (Prefix: `!`)

- **`!genkey`**: Generate API authentication keys
- **`!kick @user`**: Remove user from group
- **`!mute @user`**: Silence user notifications
- **`!promote @user`**: Promote user to admin
- **`!settings`**: Configure bot settings

### General Commands (Prefix: `!`)

- **`!ping`**: Check bot response time
- **`!info`**: Display bot information
- **`!menu`**: Show available commands
- **`!speedtest`**: Run connection speed test

## Web Dashboards

The bot includes three web interfaces:

1. **Index Page** (`/`): Landing page with bot overview
2. **User Dashboard** (`/dashboard`): User statistics and controls
3. **Admin Panel** (`/admin`): Administrative management interface

All dashboards feature real-time updates via WebSocket.

**Note:** Bun.serve() is built-in—no Express or ws library needed!

## Configuration

### Environment Variables

| Variable         | Default       | Description               |
| ---------------- | ------------- | ------------------------- |
| `PREFIX`         | `!`           | Command prefix            |
| `OWNER_NUMBER`   | ``            | Owner's WhatsApp number   |
| `ADMIN_CONTACT`  | `+1234567890` | Admin contact number      |
| `PORT`           | `3000`        | Server port               |
| `PASSKEY_SECRET` | (required)    | Authentication secret key |

### Config File (`src/config.js`)

Central configuration object loaded from environment variables. Extend this file to add custom settings.

## Database

The bot uses **SQLite3** (stored in `orin.db`) with the following files:

- `orin.db`: Main database
- `orin.db-wal`: Write-Ahead Log
- `orin.db-shm`: Shared memory

Run database initialization on first startup. Queries are managed in `src/database/queries.js`.

## Scripts

```bash
# Start orin
bun start

# Generate secure passkey
bun run generate-secret

# Format code with Prettier
bun run format

# Check code formatting
bun run format:check
```

## Security

- **Environment Variables**: Sensitive data stored in `.env` (not in repo)
- **Passkey Authentication**: Admin operations protected with secret key
- **Anti-Spam Protection**: Automatic rate limiting and spam detection
- **Secure Logging**: Sensitive information not logged
- **Session Management**: Baileys handles WhatsApp security

## Error Handling

The bot implements comprehensive error handling:

- **Graceful Shutdowns**: SIGINT and SIGTERM signals
- **Unhandled Rejections**: Process-level error catching
- **Command Errors**: Safe execution with try-catch blocks
- **Detailed Logging**: Pino logger for debugging

## Getting Started Steps

1. **Clone Repository**

   ```bash
   git clone https://github.com/chris8thecode/orin.git
   cd orin
   ```

2. **Install Dependencies with Bun**

   ```bash
   bun i
   ```

3. **Setup Environment**

   ```bash
   # Manually create .env with required variables
   ```

4. **Generate Secret**

   ```bash
   bun run generate-secret
   ```

5. **Start Bot**

   ```bash
   bun start
   ```

6. **Access Dashboard**
   - Open `http://localhost:3000` in your browser

## Logging

Structured logging via **Pino**:

- Console output in development
- JSON format for production
- Pretty printing available with `pino-pretty`

Check logs for debugging and monitoring.

## Contributing

Feel free to extend this bot by:

- Adding new commands in `src/bot/commands/`
- Creating new API routes in `src/server/routes.js` (uses Bun's fetch handler)
- Expanding database schema in `src/database/queries.js`
- Enhancing web dashboards in `src/public/`

**Development Tips:**

- Test WebSocket connections via browser DevTools console

## Tips & Tricks

- **Clear Cache**: Delete session files to re-authenticate
- **Database Backup**: Regularly backup `orin.db` file
- **Monitor WebSocket**: Check browser console for real-time updates

## License

MIT License | **Made with Love by Chris**
