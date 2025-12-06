# Scheduling

## What it does
Runs the bot automatically at set times.

## How to use
- Turn on scheduling in `src/config.jsonc` under `scheduling.enabled`.
- Choose a time using the cron or Task Scheduler fields already in the config.
- Leave the machine or container running so the schedule can trigger.

## Example
```jsonc
{
  "scheduling": {
    "enabled": true,
    "cron": { "schedule": "0 9 * * *" }
  }
}
```
