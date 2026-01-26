# Automate Netflix Household Primary Location with IMAP

> Use your time for better things than manually accepting things

- ✉️ Compatible with All Email Providers That Use IMAP
- ⚡️️ Blazing-Fast Acceptance
- 🛠️ Up to Zero Configuration
- 🍃 Even Runs on Raspberry Pi

Manually updating and accepting Netflix primary location *sucks*—**especially when you have 2 or more devices**. Keeping track of verification emails and updating your primary location can be a tedious chore. This tool automates the entire process, saving you time without the hassle of looking you E-Mails manually.

## 🚀 Usage

*Start the Docker container, and you’re good to go!*

```sh
docker compose up -d
```

View logs:
```sh
docker compose logs -f
```

Example output:
```
[12.01.26, 14:32:15] [INFO] Starting IMAP Netflix Automation...
[12.01.26, 14:32:16] [SUCCESS] Connected to IMAP, listening for emails...
[12.01.26, 15:45:23] [INFO] Netflix email received (1 message(s))
[12.01.26, 15:45:23] [INFO] Update link found, processing...
[12.01.26, 15:45:24] [INFO] Starting browser automation...
[12.01.26, 15:45:25] [INFO] Opening Netflix link...
[12.01.26, 15:45:28] [SUCCESS] Household location updated successfully!
```

## Getting Started
> **❗️Please note that currently only the INBOX checks for new emails. If there are enough requests to check emails in other folders, this feature will be implemented in the near future.**

Lets speed it up!

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose
- IMAP enabled on your email provider

#### Enable IMAP

**Gmail:** Settings > Forwarding and POP/IMAP > Enable IMAP  
[Gmail Settings](https://mail.google.com/mail/u/0/#settings/fwdandpop)

**Other providers:** Check your provider's documentation for IMAP settings.

### Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/Jonas-wpr/imap-netflix-household-automation.git
   cd imap-netflix-household-automation
   ```

2. **Configure environment variables**
   ```sh
   cp .env.dist .env
   ```
   Edit `.env` with your credentials (see [Environment Variables](#environment-variables))

3. **Start the container**
   ```sh
   docker compose up -d
   ```
That’s it! Docker will automatically install all the necessary dependencies and start the script.

```yaml
# compose.yml
services:
  imap-netflix-household-automation:
    build: .
    container_name: imap-netflix-household-automation
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./tmp:/app/tmp
```

## Environment Variables

Required (set in `.env`):

- IMAP_USER — mailbox username
- IMAP_PASSWORD — mailbox password or app password
- IMAP_HOST — IMAP server host
- IMAP_PORT — IMAP server port (usually 993)
- TARGET_EMAIL_ADDRESS — expected sender (e.g. `info@account.netflix.com`)
- TARGET_EMAIL_SUBJECT — substring used to identify the initial verification email (server-side IMAP header search is substring-based)
- CONFIRMATION_SUBJECT — substring used to identify the follow-up confirmation email (e.g. `Bestätigung`)

Security: keep credentials out of source control and use secrets in CI/containers.

> **💡 Tip:** For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  1. IMAP connection to email server                     │
│                         ↓                               │
│  2. Monitor INBOX for new emails                        │
│                         ↓                               │
│  3. Filter by sender & subject                          │
│     - From: TARGET_EMAIL_ADDRESS                        │
│     - Subject: TARGET_EMAIL_SUBJECT                     │
│                         ↓                               │
│  4. Extract Netflix update link from email body         │
│                         ↓                               │
│  5. Playwright automation clicks confirmation button    │
│                         ↓                               │
│  6. Session saved for future requests                   │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Automatic email monitoring** - Listens for new Netflix household emails via IMAP IDLE
- **Session persistence** - Saves browser session to `tmp/storageState.json` to avoid repeated logins
- **Performance optimized** - Blocks images, fonts, and media for faster page loads
- **Structured logging** - Timestamps and log levels for easy debugging
- **Docker ready** - Pre-built image available on GitHub Container Registry

## License

[MIT](https://choosealicense.com/licenses/mit/) © [Duc Phung](https://github.com/ducphu0ng)

If you find this project interesting or helpful, I'd love your support!
Please consider giving it a star (⭐) and following me on GitHub.

I love coding and always have new ideas, so stay tuned—your support won’t be in vain!

## Acknowledgements

This project is a fork of [ducphu0ng/imap-netflix-household-automation](https://github.com/ducphu0ng/imap-netflix-household-automation).
