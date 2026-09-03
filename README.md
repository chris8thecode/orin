<h1 align="center">Orin</h1>

<p align="center">
  <img src="https://files.catbox.moe/o2yft0.png" alt="Orin logo" />
</p>

<p align="center">
  <a href="https://github.com/chris8thecode/orin/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2E8B57?style=for-the-badge" alt="License: MIT" /></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/runtime-Bun-000000?logo=bun&style=for-the-badge" alt="Bun runtime" /></a>
  <a href="https://github.com/WhiskeySockets/Baileys"><img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&style=for-the-badge" alt="WhatsApp via Baileys" /></a>
  <a href="https://github.com/chris8thecode/orin"><img src="https://img.shields.io/badge/status-active-2ECC71?style=for-the-badge" alt="Status: active" /></a>
</p>

<p align="center">A WhatsApp automation and management platform built with Baileys and Bun, with modular commands, persistent sessions, passkey-protected administration and a real-time web interface.</p>

## Disclaimer

**IMPORTANT:** Orin is provided for educational and personal use only.

- **Use responsibly:** Do not spam, harass or send unwanted messages.
- **Respect privacy:** Handle phone numbers, chats and message data with care.
- **Follow the rules:** Your use must comply with WhatsApp's terms and local laws.
- **Get consent:** Do not add the bot to groups or contact people without permission.

The developers are not responsible for misuse or for consequences arising from
use of the project. WhatsApp may suspend or ban accounts that violate its terms
of service.

## Why Orin?

Orin brings WhatsApp operations and browser-based management into one focused
tool:

- Connect and manage multiple WhatsApp sessions from a web interface.
- Inspect recent chats and messages, including supported media retrieval.
- Send messages from the chat UI with real-time WebSocket updates.
- Extend the bot through small command modules grouped by responsibility.
- Store connections, passkeys, statistics and message history in SQLite.

## Features

### Bot capabilities

- **Group administration:** Kick, promote, demote, mute, unmute and inspect groups.
- **General commands:** Menu, ping, speed test, bot information and runtime details.
- **Anti-spam protection:** Rate limiting and spam detection for incoming messages.
- **Session persistence:** Resume configured WhatsApp sessions after restart.
- **Structured logging:** Pino-based logs for connection and server activity.

### Web platform

- **Dashboard:** Connection statistics, active sessions and live updates.
- **Admin panel:** Generate passkeys, inspect passkeys and disconnect sessions.
- **Chat interface:** Browse recent chats, read messages and send replies.
- **Native WebSocket:** Dashboard statistics broadcast every two seconds, with per-session chat topics.
- **Automatic port fallback:** The server tries the next port when the configured port is busy.

## Prerequisites

- [Bun](https://bun.sh/) 1.0 or newer
- A WhatsApp account for pairing
- A stable internet connection
- Git, if cloning the repository

Verify the runtime before continuing:

```bash
bun --version
git --version
```

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/chris8thecode/orin.git
cd orin
bun install
```

### 2. Configure the environment

Create a `.env` file in the project root. Generate a strong secret with:

```bash
bun run generate-secret
```

Copy the printed value into `PASSKEY_SECRET`:

```env
PREFIX=/
OWNER_NUMBER=
ADMIN_CONTACT=+27639614303
PORT=3000
PASSKEY_SECRET=replace_with_the_generated_secret
```

### 3. Start Orin

```bash
bun start
```

Open `http://localhost:3000` in a browser. The server logs the exact port and
URLs when it starts.

### 4. Pair a WhatsApp session

1. Open the dashboard or connection flow in the browser.
2. Use the admin secret to generate a temporary passkey in the admin panel.
3. Enter the WhatsApp phone number with its country code.
4. Enter the generated passkey and follow the pairing-code instructions in WhatsApp.

## Configuration

Orin reads configuration from `.env` through [src/config.js](src/config.js).

| Variable         | Default        | Description                                          |
| ---------------- | -------------- | ---------------------------------------------------- |
| `PREFIX`         | `/`            | Prefix used for WhatsApp commands.                   |
| `OWNER_NUMBER`   | empty          | Owner's WhatsApp number.                             |
| `ADMIN_CONTACT`  | `+27639614303` | Contact shown or used by administrative flows.       |
| `PORT`           | `3000`         | Starting port for the Bun server.                    |
| `PASSKEY_SECRET` | empty          | Secret used to generate and validate admin passkeys. |

Keep `.env` private. In particular, never commit `PASSKEY_SECRET` or session
data to source control.

## Commands

The command registry loads modules from [src/bot/commands](src/bot/commands).
The default prefix is `/`.

### General

- `/menu`: Show available commands.
- `/ping`: Check response time.
- `/speedtest`: Run a connection speed test.
- `/info`: Display bot information.
- `/runtime`: Display process runtime information.

### Group administration

- `/kick @user`: Remove a participant from a group.
- `/promote @user`: Promote a participant to admin.
- `/demote @user`: Remove admin status from a participant.
- `/mute @user`: Mute a participant.
- `/unmute @user`: Unmute a participant.
- `/groupinfo`: Display group information.

### Administration

- `/genkey`: Generate an authentication key for management flows.

Use `/menu` in WhatsApp for the current command list. Group and administrative
commands require the appropriate permissions.

## Web Interfaces

| URL          | Purpose                                           |
| ------------ | ------------------------------------------------- |
| `/`          | Orin home and connection entry point              |
| `/dashboard` | Live connection statistics and session controls   |
| `/admin`     | Passkey and administrative management             |
| `/chat`      | Recent chats, messages and message sending        |
| `/ws`        | Native WebSocket endpoint used by the web clients |

The server also exposes health, statistics, connection, chat and message API
endpoints under `/api`. These endpoints are intended for the included web
interfaces and should not be exposed publicly without appropriate protection.

## Project Structure

| Path                                 | Purpose                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [src/bot](src/bot)                   | WhatsApp connection lifecycle, message handling, anti-spam and commands |
| [src/bot/commands](src/bot/commands) | Modular general and administrative commands                             |
| [src/database](src/database)         | Bun SQLite initialization and database queries                          |
| [src/server](src/server)             | Bun HTTP routes and native WebSocket handling                           |
| [src/public](src/public)             | Dashboard, admin, chat and home web assets                              |
| [src/utils](src/utils)               | Environment, cryptography, caching and shared helpers                   |

## Data and Security

The database is created as `orin.db` using Bun's built-in `bun:sqlite` module.
SQLite WAL files may also appear beside it. The database contains connection
records, passkeys, statistics and stored message metadata/content used by the
chat interface.

- Use a long, randomly generated `PASSKEY_SECRET`.
- Keep the admin panel and API behind a trusted network or reverse proxy.
- Back up `orin.db` only when the stored data can be handled securely.
- Delete local session data when you need to pair a session again.

## Development

```bash
# Start Orin
bun start

# Generate an admin secret
bun run generate-secret

# Format the project
bun run format

# Check formatting without changing files
bun run format:check
```

To add a command, create a module in the relevant directory under
[src/bot/commands](src/bot/commands), export it from the category index, and
register it in the command registry. Keep permission checks and input
validation close to the command that needs them.

## Troubleshooting

### The server does not start

Check the startup logs and confirm that `PASSKEY_SECRET` is present. If the
configured port is already occupied, Orin automatically tries subsequent ports.

### Pairing fails

Confirm the phone number includes its country code, the passkey has not expired,
and the WhatsApp account can receive pairing prompts. Delete local session data
only when you need to start the pairing flow again.

### Commands do not respond

Confirm the configured `PREFIX`, use `/menu` to check command names, and verify
that the bot has the required group permissions.

## Contributing

Contributions are welcome. Keep changes focused, follow the existing module
structure, run `bun run format:check` and describe behavioral changes clearly
in pull requests.

## License

This project is available under the [MIT License](LICENSE).
