import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Vercel Serverless Function for Error Reporting
 * 
 * This endpoint receives error reports from Microsoft Rewards Bot instances
 * and forwards them to a centralized Discord webhook stored in environment variables.
 * 
 * Environment Variables Required:
 * - DISCORD_ERROR_WEBHOOK_URL: Discord webhook URL for error reporting
 * - RATE_LIMIT_SECRET (optional): Secret key for bypassing rate limits (trusted clients)
 * 
 * @see https://vercel.com/docs/functions/serverless-functions
 */

interface ErrorReportPayload {
    error: string
    stack?: string
    context: {
        version: string
        platform: string
        arch: string
        nodeVersion: string
        timestamp: string
        botMode?: string
    }
    additionalContext?: Record<string, unknown>
}

interface DiscordEmbed {
    title: string
    description: string
    color: number
    fields: Array<{ name: string; value: string; inline: boolean }>
    timestamp: string
    footer: { text: string }
}

// Rate limiting configuration (in-memory, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10 // 10 requests per minute per IP

// Discord color constants
const DISCORD_COLOR_RED = 0xdc143c
const DISCORD_AVATAR_URL = 'https://raw.githubusercontent.com/LightZirconite/Microsoft-Rewards-Bot/refs/heads/main/assets/logo.png'

/**
 * Check if IP is rate limited
 */
function isRateLimited(ip: string, secret?: string): boolean {
    // Bypass rate limit if valid secret provided
    const validSecret = process.env.RATE_LIMIT_SECRET
    if (secret && validSecret && secret === validSecret) {
        return false
    }

    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || now > entry.resetTime) {
        // Reset or create new entry
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
        return false
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return true
    }

    entry.count++
    return false
}

/**
 * Build Discord embed from error report
 */
function buildDiscordEmbed(payload: ErrorReportPayload): DiscordEmbed {
    const { error, stack, context } = payload

    const osPlatform = (() => {
        switch (context.platform) {
            case 'win32': return '🪟 Windows'
            case 'darwin': return '🍎 macOS'
            case 'linux': return '🐧 Linux'
            default: return context.platform
        }
    })()

    const embed: DiscordEmbed = {
        title: '🐛 Community Error Report',
        description: `\`\`\`js\n${error.slice(0, 700)}\n\`\`\``,
        color: DISCORD_COLOR_RED,
        fields: [
            { name: '📦 Version', value: context.version === 'unknown' ? '⚠️ Unknown' : `v${context.version}`, inline: true },
            { name: '🤖 Bot Mode', value: context.botMode || 'UNKNOWN', inline: true },
            { name: '💻 OS Platform', value: `${osPlatform} ${context.arch}`, inline: true },
            { name: '⚙️ Node.js', value: context.nodeVersion, inline: true },
            { name: '🕐 Timestamp', value: new Date(context.timestamp).toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' }), inline: false }
        ],
        timestamp: context.timestamp,
        footer: { text: 'Community Error Reporting • Vercel Serverless • Non-sensitive data only' }
    }

    if (stack) {
        const truncated = stack.slice(0, 900)
        const wasTruncated = stack.length > 900
        embed.fields.push({
            name: '📋 Stack Trace' + (wasTruncated ? ' (truncated)' : ''),
            value: `\`\`\`js\n${truncated}${wasTruncated ? '\n... (truncated for display)' : ''}\n\`\`\``,
            inline: false
        })
    }

    return embed
}

/**
 * Main handler for error reporting endpoint
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for all origins (error reporting should be accessible)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Rate-Limit-Secret')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only POST requests are accepted' })
    }

    try {
        // Get client IP for rate limiting
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            (req.headers['x-real-ip'] as string) ||
            'unknown'

        // Get rate limit secret from headers
        const rateLimitSecret = req.headers['x-rate-limit-secret'] as string | undefined

        // Check rate limit
        if (isRateLimited(ip, rateLimitSecret)) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Maximum 10 requests per minute per IP. Please try again later.'
            })
        }

        // Validate Discord webhook URL is configured
        const webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL
        if (!webhookUrl) {
            console.error('[ErrorReporting] DISCORD_ERROR_WEBHOOK_URL not configured')
            return res.status(500).json({
                error: 'Configuration error',
                message: 'Discord webhook not configured. Please contact the administrator.'
            })
        }

        // Validate request body
        const payload = req.body as ErrorReportPayload
        if (!payload || !payload.error || !payload.context) {
            return res.status(400).json({
                error: 'Invalid payload',
                message: 'Missing required fields: error, context'
            })
        }

        // Build Discord embed
        const embed = buildDiscordEmbed(payload)

        // Send to Discord webhook
        const discordPayload = {
            username: 'Microsoft-Rewards-Bot Error Reporter',
            avatar_url: DISCORD_AVATAR_URL,
            embeds: [embed]
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
        })

        if (!response.ok) {
            console.error('[ErrorReporting] Discord webhook failed:', response.status, response.statusText)
            return res.status(502).json({
                error: 'Discord webhook failed',
                message: `HTTP ${response.status}: ${response.statusText}`
            })
        }

        // Success
        return res.status(200).json({
            success: true,
            message: 'Error report sent successfully'
        })

    } catch (error) {
        console.error('[ErrorReporting] Unexpected error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        })
    }
}
