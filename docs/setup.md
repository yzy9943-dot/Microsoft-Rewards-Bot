# Setup

Get the bot ready before running it.

## What it does
Creates a safe baseline so your accounts and config are ready.

## How to use
1. Install Node.js 20 or newer.
2. Copy `src/accounts.example.jsonc` to `src/accounts.jsonc` and fill in your accounts.
3. Review `src/config.jsonc`; defaults work for most people.
4. (Optional) set `DISCORD_WEBHOOK_URL` in your environment for alerts.

## Example
```jsonc
[
  {
    "email": "you@example.com",
    "password": "your-password"
  }
]
```
