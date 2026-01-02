# Vercel Error Reporting Configuration

This directory contains Vercel Serverless Functions for centralized error reporting.

## Setup Instructions

### 1. Configure Discord Webhook in Vercel

1. Go to your Vercel project: https://vercel.com/lightzirconites-projects/rewards-bot
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Name:** `DISCORD_ERROR_WEBHOOK_URL`
   - **Value:** Your Discord webhook URL (e.g., `https://discord.com/api/webhooks/...`)
   - **Environment:** Production, Preview, Development (select all)

### 2. Optional: Configure Rate Limit Secret (for trusted clients)

To bypass rate limits for trusted bot instances:

1. Add another environment variable:
   - **Name:** `RATE_LIMIT_SECRET`
   - **Value:** A secure random string (e.g., `openssl rand -base64 32`)
   - **Environment:** Production, Preview, Development

2. In the bot's `config.jsonc`, add:
   ```jsonc
   {
     "errorReporting": {
       "enabled": true,
       "apiUrl": "https://rewards-bot-eight.vercel.app/api/report-error",
       "secret": "your-secret-here"  // Same as RATE_LIMIT_SECRET
     }
   }
   ```

### 3. Deploy to Vercel

After configuring environment variables:

```bash
# Option 1: Git push (automatic deployment)
git add api/ vercel.json
git commit -m "feat: Add Vercel error reporting endpoint"
git push origin main

# Option 2: Manual deployment with Vercel CLI
npm install -g vercel
vercel --prod
```

### 4. Test the Endpoint

```bash
# Test rate limiting (should work)
curl -X POST https://rewards-bot-eight.vercel.app/api/report-error \
  -H "Content-Type: application/json" \
  -d '{
    "error": "Test error message",
    "context": {
      "version": "2.56.5",
      "platform": "linux",
      "arch": "x64",
      "nodeVersion": "v22.0.0",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
    }
  }'

# Test with secret (bypasses rate limit)
curl -X POST https://rewards-bot-eight.vercel.app/api/report-error \
  -H "Content-Type: application/json" \
  -H "X-Rate-Limit-Secret: your-secret-here" \
  -d '{...}'
```

## Endpoint Details

### POST `/api/report-error`

**Headers:**
- `Content-Type: application/json`
- `X-Rate-Limit-Secret` (optional): Secret to bypass rate limits

**Request Body:**
```typescript
{
  "error": string,              // Error message (sanitized)
  "stack"?: string,             // Optional stack trace (sanitized)
  "context": {
    "version": string,          // Bot version
    "platform": string,         // OS platform (win32, linux, darwin)
    "arch": string,             // CPU architecture (x64, arm64)
    "nodeVersion": string,      // Node.js version
    "timestamp": string,        // ISO 8601 timestamp
    "botMode"?: string          // DESKTOP, MOBILE, MAIN
  },
  "additionalContext"?: Record<string, unknown>
}
```

**Response:**
- `200 OK`: Error report sent successfully
- `400 Bad Request`: Invalid payload
- `429 Too Many Requests`: Rate limit exceeded (10 requests/minute/IP)
- `500 Internal Server Error`: Server error or Discord webhook failure

## Security Considerations

1. **Environment Variables:** Discord webhook URL is NEVER exposed in code
2. **Rate Limiting:** 10 requests per minute per IP address (configurable)
3. **CORS:** Enabled for all origins (error reporting is public)
4. **Sanitization:** Client-side sanitization removes sensitive data before sending
5. **No Authentication:** Public endpoint by design (community error reporting)

## Advantages vs. Previous System

| Feature | Old System (Discord Webhook) | New System (Vercel API) |
|---------|------------------------------|-------------------------|
| Webhook Exposure | ❌ Hardcoded in code (base64) | ✅ Hidden in env vars |
| User Control | ❌ Can disable in config | ✅ Cannot disable |
| Redundancy | ⚠️ 4 hardcoded webhooks | ✅ Single endpoint, multiple webhooks possible |
| Rate Limiting | ❌ Manual tracking | ✅ Automatic per IP |
| Maintenance | ❌ Code changes required | ✅ Env var update only |
| Cost | ✅ Free | ✅ Free (100k req/day) |

## Migration Guide

See [docs/error-reporting-vercel.md](../docs/error-reporting-vercel.md) for full migration instructions.

---

**Last Updated:** 2025-01-02  
**Maintainer:** LightZirconite
