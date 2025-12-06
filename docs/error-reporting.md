# Error Reporting API

## What it does
Accepts structured error reports and forwards them to Discord in a clean format.

## How to use
- Set `DISCORD_WEBHOOK_URL` in your environment.
- Send a POST request to `/api/report-error` with JSON that includes at least `error`.
- Optional fields: `summary`, `type`, `metadata` (object), `environment` (string or object with `name`).

## Example
```bash
curl -X POST https://your-deployment.vercel.app/api/report-error \
  -H "Content-Type: application/json" \
  -d '{"error":"Search job failed","type":"search","metadata":{"account":"user@contoso.com"}}'
```
