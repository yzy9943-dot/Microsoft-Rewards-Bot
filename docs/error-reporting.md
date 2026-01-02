# Error Reporting

> **⚠️ NEW SYSTEM (2025-01-02):** Error reporting now uses Vercel Serverless Functions instead of direct Discord webhooks. [See full documentation →](error-reporting-vercel.md)

## What it does
Automatically sends anonymized error reports to help improve the project. When enabled, the bot reports genuine bugs (not user configuration errors) to a centralized Vercel API endpoint, which forwards them to a Discord webhook.

## Privacy
- **No sensitive data is sent:** Emails, passwords, tokens, and file paths are automatically redacted.
- **Only genuine bugs are reported:** User configuration errors (wrong password, missing files) are filtered out.
- **Completely optional:** Disable in config.jsonc if you prefer not to participate.
- **Server-side rate limiting:** Maximum 10 reports per minute per IP address.

## How to configure
In src/config.jsonc:

```jsonc
{
  "errorReporting": {
    "enabled": true,  // Set to false to disable
    "apiUrl": "https://rewards-bot-eight.vercel.app/api/report-error",  // Optional: custom endpoint
    "secret": "your-secret-here"  // Optional: bypass rate limits (trusted clients)
  }
}
```

## What gets reported
- Error message (sanitized)
- Stack trace (truncated to 15 lines, paths removed)
- Bot version
- OS platform and architecture
- Node.js version
- Timestamp
- Bot mode (DESKTOP, MOBILE, MAIN)

## What is filtered out
- Login failures (your credentials are never sent)
- Account suspensions/bans
- Configuration errors (missing files, invalid settings)
- Network timeouts
- Expected errors (daily limit reached, activity not available)
- Rebrowser-playwright internal errors (benign)

## Migration from Old System

If you were using the old webhook-based system (pre-2025):
- **No action required** - the bot automatically uses the new Vercel API
- Old config fields (`errorReporting.webhooks[]`) are deprecated but still supported as fallback
- Old webhook tracking files (`sessions/disabled-webhooks.json`) are no longer used

---

**New System Benefits:**
- ✅ Webhook URL never exposed in code
- ✅ Centralized control (maintainer-managed)
- ✅ Server-side rate limiting
- ✅ Simplified codebase (~300 lines removed)

**Full documentation:** [error-reporting-vercel.md](error-reporting-vercel.md)

---
**[Back to Documentation](index.md)**