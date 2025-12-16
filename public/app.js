/**
 * Microsoft Rewards Bot Dashboard - Frontend JavaScript
 * 
 * Handles real-time updates, charts, bot control, and UI interactions
 */

// ============================================================================
// State Management
// ============================================================================

const state = {
    isRunning: false,
    autoScroll: true,
    logs: [],
    accounts: [],
    stats: {
        totalAccounts: 0,
        totalPoints: 0,
        completed: 0,
        errors: 0,
        startTime: null
    },
    pointsHistory: [],
    activityStats: {},
    currentLogFilter: 'all',
    ws: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000
}

// Chart instances
let pointsChart = null
let activityChart = null

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket()
    initializeCharts()
    loadInitialData()
    startUptimeTimer()
    loadThemePreference()
})

// ============================================================================
// WebSocket Connection
// ============================================================================

function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`

    try {
        state.ws = new WebSocket(wsUrl)

        state.ws.onopen = () => {
            updateConnectionStatus(true)
            state.reconnectAttempts = 0
            state.reconnectDelay = 1000
            console.log('[WS] Connected to dashboard server')
        }

        state.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                handleWebSocketMessage(data)
            } catch (error) {
                console.error('[WS] Failed to parse message:', error)
            }
        }

        state.ws.onclose = () => {
            updateConnectionStatus(false)
            console.log('[WS] Connection closed, attempting reconnect...')
            attemptReconnect()
        }

        state.ws.onerror = (error) => {
            console.error('[WS] Error:', error)
        }
    } catch (error) {
        console.error('[WS] Failed to connect:', error)
        attemptReconnect()
    }
}

function attemptReconnect() {
    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
        showToast('Connection lost. Please refresh the page.', 'error')
        return
    }

    state.reconnectAttempts++
    state.reconnectDelay = Math.min(state.reconnectDelay * 1.5, 30000)

    setTimeout(() => {
        console.log(`[WS] Reconnect attempt ${state.reconnectAttempts}/${state.maxReconnectAttempts}`)
        initializeWebSocket()
    }, state.reconnectDelay)
}

function handleWebSocketMessage(data) {
    // Handle init message with all initial data
    if (data.type === 'init' && data.data) {
        if (data.data.logs) {
            data.data.logs.forEach(log => addLogEntry(log))
        }
        if (data.data.status) {
            updateBotStatus(data.data.status)
        }
        if (data.data.accounts) {
            renderAccounts(data.data.accounts)
        }
        return
    }

    // Handle payload format (from state listener) or data format (from broadcast)
    const payload = data.payload || data.data || data

    switch (data.type) {
        case 'log':
            // Handle both { log: {...} } and direct log object
            addLogEntry(payload.log || payload)
            break
        case 'status':
            updateBotStatus(payload)
            break
        case 'stats':
            updateStats(payload)
            break
        case 'account':
        case 'account_update':
            updateAccountStatus(payload)
            break
        case 'accounts':
            renderAccounts(payload)
            break
        case 'points':
            updatePointsHistory(payload)
            break
        case 'activity':
            updateActivityStats(payload)
            break
        default:
            console.log('[WS] Unknown message type:', data.type)
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus')
    if (statusEl) {
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`
        statusEl.innerHTML = `<i class="fas fa-circle"></i> ${connected ? 'Connected' : 'Disconnected'}`
    }
}

// ============================================================================
// Charts Initialization
// ============================================================================

function initializeCharts() {
    initPointsChart()
    initActivityChart()
}

function initPointsChart() {
    const ctx = document.getElementById('pointsChart')
    if (!ctx) return

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250)
    gradient.addColorStop(0, 'rgba(88, 166, 255, 0.3)')
    gradient.addColorStop(1, 'rgba(88, 166, 255, 0)')

    pointsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: generateDateLabels(7),
            datasets: [{
                label: 'Points Earned',
                data: generatePlaceholderData(7),
                borderColor: '#58a6ff',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#58a6ff',
                pointBorderColor: '#0d1117',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#161b22',
                    titleColor: '#f0f6fc',
                    bodyColor: '#8b949e',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `${context.parsed.y.toLocaleString()} points`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#21262d',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8b949e',
                        font: { size: 11 }
                    }
                },
                y: {
                    grid: {
                        color: '#21262d',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8b949e',
                        font: { size: 11 },
                        callback: (value) => value.toLocaleString()
                    },
                    beginAtZero: true
                }
            }
        }
    })
}

function initActivityChart() {
    const ctx = document.getElementById('activityChart')
    if (!ctx) return

    activityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Searches', 'Daily Set', 'Punch Cards', 'Quizzes', 'Other'],
            datasets: [{
                data: [45, 25, 15, 10, 5],
                backgroundColor: [
                    '#58a6ff',
                    '#3fb950',
                    '#d29922',
                    '#a371f7',
                    '#39c5cf'
                ],
                borderColor: '#161b22',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#8b949e',
                        font: { size: 11 },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#161b22',
                    titleColor: '#f0f6fc',
                    bodyColor: '#8b949e',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context) => `${context.label}: ${context.parsed}%`
                    }
                }
            }
        }
    })
}

function generateDateLabels(days) {
    const labels = []
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    }
    return labels
}

function generatePlaceholderData(count) {
    // Generate realistic-looking placeholder data
    const data = []
    let base = 150
    for (let i = 0; i < count; i++) {
        base += Math.floor(Math.random() * 50) - 20
        data.push(Math.max(50, base))
    }
    return data
}

function setChartPeriod(period, btn) {
    // Update button states
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')

    // Update chart data
    const days = period === '7d' ? 7 : 30
    if (pointsChart) {
        pointsChart.data.labels = generateDateLabels(days)
        pointsChart.data.datasets[0].data = generatePlaceholderData(days)
        pointsChart.update('none')
    }
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadInitialData() {
    try {
        const [statusRes, accountsRes] = await Promise.all([
            fetch('/api/status'),
            fetch('/api/accounts')
        ])

        if (statusRes.ok) {
            const status = await statusRes.json()
            updateBotStatus(status)
        }

        if (accountsRes.ok) {
            const accounts = await accountsRes.json()
            renderAccounts(accounts)
        }
    } catch (error) {
        console.error('Failed to load initial data:', error)
    }
}

async function refreshData() {
    const btn = document.querySelector('[onclick="refreshData()"]')
    if (btn) {
        btn.querySelector('i').classList.add('fa-spin')
    }

    await loadInitialData()

    setTimeout(() => {
        if (btn) {
            btn.querySelector('i').classList.remove('fa-spin')
        }
        showToast('Data refreshed', 'success')
    }, 500)
}

// ============================================================================
// Bot Control
// ============================================================================

async function startBot() {
    try {
        updateButtonStates(true)
        const response = await fetch('/api/start', { method: 'POST' })
        const result = await response.json()

        if (response.ok) {
            state.isRunning = true
            state.stats.startTime = Date.now()
            updateBotStatus({ running: true })
            showToast('Bot started successfully', 'success')
        } else {
            updateButtonStates(false)
            showToast(result.error || 'Failed to start bot', 'error')
        }
    } catch (error) {
        updateButtonStates(false)
        showToast('Failed to start bot: ' + error.message, 'error')
    }
}

async function stopBot() {
    try {
        const response = await fetch('/api/stop', { method: 'POST' })
        const result = await response.json()

        if (response.ok) {
            state.isRunning = false
            updateBotStatus({ running: false })
            showToast('Bot stopped', 'info')
        } else {
            showToast(result.error || 'Failed to stop bot', 'error')
        }
    } catch (error) {
        showToast('Failed to stop bot: ' + error.message, 'error')
    }
}

async function restartBot() {
    try {
        showToast('Restarting bot...', 'info')
        const response = await fetch('/api/restart', { method: 'POST' })
        const result = await response.json()

        if (response.ok) {
            state.stats.startTime = Date.now()
            showToast('Bot restarted successfully', 'success')
        } else {
            showToast(result.error || 'Failed to restart bot', 'error')
        }
    } catch (error) {
        showToast('Failed to restart bot: ' + error.message, 'error')
    }
}

async function resetJobState() {
    showModal(
        'Reset Job State',
        '<p>This will clear all completed task records for today, allowing the bot to re-run all activities.</p><p style="color: var(--accent-orange); margin-top: 1rem;"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>',
        [
            { text: 'Cancel', class: 'btn btn-secondary', onclick: 'closeModal()' },
            { text: 'Reset', class: 'btn btn-danger', onclick: 'confirmResetJobState()' }
        ]
    )
}

async function confirmResetJobState() {
    closeModal()
    try {
        const response = await fetch('/api/reset-state', { method: 'POST' })
        const result = await response.json()

        if (response.ok) {
            showToast('Job state reset successfully', 'success')
            state.stats.completed = 0
            state.stats.errors = 0
            updateStatsDisplay()
        } else {
            showToast(result.error || 'Failed to reset state', 'error')
        }
    } catch (error) {
        showToast('Failed to reset state: ' + error.message, 'error')
    }
}

function updateButtonStates(running) {
    const btnStart = document.getElementById('btnStart')
    const btnStop = document.getElementById('btnStop')

    if (btnStart) btnStart.disabled = running
    if (btnStop) btnStop.disabled = !running
}

// ============================================================================
// Status Updates
// ============================================================================

function updateBotStatus(status) {
    state.isRunning = status.running
    updateButtonStates(status.running)

    const badge = document.getElementById('statusBadge')
    if (badge) {
        badge.className = `status-badge ${status.running ? 'status-running' : 'status-stopped'}`
        badge.innerHTML = `<i class="fas fa-circle"></i><span>${status.running ? 'RUNNING' : 'STOPPED'}</span>`
    }

    if (status.startTime) {
        state.stats.startTime = new Date(status.startTime).getTime()
    }

    if (status.memory) {
        document.getElementById('memory').textContent = formatBytes(status.memory)
    }
}

function updateStats(stats) {
    if (stats.totalAccounts !== undefined) state.stats.totalAccounts = stats.totalAccounts
    if (stats.totalPoints !== undefined) state.stats.totalPoints = stats.totalPoints
    if (stats.completed !== undefined) state.stats.completed = stats.completed
    if (stats.errors !== undefined) state.stats.errors = stats.errors

    updateStatsDisplay()
}

function updateStatsDisplay() {
    document.getElementById('totalAccounts').textContent = state.stats.totalAccounts
    document.getElementById('totalPoints').textContent = state.stats.totalPoints.toLocaleString()
    document.getElementById('completed').textContent = state.stats.completed
    document.getElementById('errors').textContent = state.stats.errors

    // Update accounts badge
    const badge = document.getElementById('accountsBadge')
    if (badge) badge.textContent = state.stats.totalAccounts
}

function updatePointsHistory(data) {
    if (pointsChart && data.labels && data.values) {
        pointsChart.data.labels = data.labels
        pointsChart.data.datasets[0].data = data.values
        pointsChart.update('none')
    }
}

function updateActivityStats(data) {
    if (activityChart && data.labels && data.values) {
        activityChart.data.labels = data.labels
        activityChart.data.datasets[0].data = data.values
        activityChart.update('none')
    }
}

// ============================================================================
// Accounts Management
// ============================================================================

function renderAccounts(accounts) {
    state.accounts = accounts
    state.stats.totalAccounts = accounts.length

    const container = document.getElementById('accountsList')
    if (!container) return

    if (accounts.length === 0) {
        container.innerHTML = '<div class="log-empty">No accounts configured</div>'
        return
    }

    container.innerHTML = accounts.map(account => {
        const initial = (account.email || 'U')[0].toUpperCase()
        const displayEmail = account.email ? maskEmail(account.email) : 'Unknown'
        const statusClass = account.status || 'pending'
        const statusText = statusClass.charAt(0).toUpperCase() + statusClass.slice(1)

        return `
            <div class="account-item" data-email="${account.email || ''}">
                <div class="account-info">
                    <div class="account-avatar">${initial}</div>
                    <span class="account-email">${displayEmail}</span>
                </div>
                <span class="account-status ${statusClass}">${statusText}</span>
            </div>
        `
    }).join('')

    updateStatsDisplay()
}

function updateAccountStatus(data) {
    const accountEl = document.querySelector(`.account-item[data-email="${data.email}"]`)
    if (accountEl) {
        const statusEl = accountEl.querySelector('.account-status')
        if (statusEl) {
            statusEl.className = `account-status ${data.status}`
            statusEl.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1)
        }
    }
}

function maskEmail(email) {
    if (!email) return 'Unknown'
    const [local, domain] = email.split('@')
    if (!domain) return email
    const masked = local.length > 3
        ? local.slice(0, 2) + '***' + local.slice(-1)
        : local[0] + '***'
    return `${masked}@${domain}`
}

// ============================================================================
// Logging
// ============================================================================

function addLogEntry(log) {
    const container = document.getElementById('logsContainer')
    if (!container) return

    // Remove empty state message
    const emptyMsg = container.querySelector('.log-empty')
    if (emptyMsg) emptyMsg.remove()

    // Normalize log format (server uses 'title' and 'platform', frontend uses 'source')
    const normalizedLog = {
        timestamp: log.timestamp || new Date().toISOString(),
        level: log.level || 'log',
        source: log.source || log.title || 'BOT',
        message: log.message || '',
        platform: log.platform
    }

    // Store log
    state.logs.push(normalizedLog)

    // Check filter
    if (state.currentLogFilter !== 'all' && normalizedLog.level !== state.currentLogFilter) {
        return
    }

    // Create log entry
    const entry = document.createElement('div')
    entry.className = 'log-entry'
    entry.innerHTML = `
        <span class="log-time">${formatTime(normalizedLog.timestamp)}</span>
        <span class="log-level ${normalizedLog.level}">${normalizedLog.level}</span>
        <span class="log-source">[${normalizedLog.source}]</span>
        <span class="log-message">${escapeHtml(normalizedLog.message)}</span>

    // Auto-scroll
    if (state.autoScroll) {
        container.scrollTop = container.scrollHeight
    }
}

function filterLogs() {
    const filter = document.getElementById('logFilter')
    if (!filter) return

    state.currentLogFilter = filter.value

    const container = document.getElementById('logsContainer')
    if (!container) return

    // Clear and re-render
    container.innerHTML = ''

    const filteredLogs = state.currentLogFilter === 'all'
        ? state.logs
        : state.logs.filter(log => log.level === state.currentLogFilter)

    if (filteredLogs.length === 0) {
        container.innerHTML = '<div class="log-empty">No logs to display</div>'
        return
    }

    filteredLogs.forEach(log => {
        const entry = document.createElement('div')
        entry.className = 'log-entry'
        entry.innerHTML = `
        < span class="log-time" > ${ formatTime(log.timestamp || new Date()) }</span >
            <span class="log-level ${log.level || 'log'}">${log.level || 'log'}</span>
            <span class="log-source">[${log.source || 'BOT'}]</span>
            <span class="log-message">${escapeHtml(log.message || '')}</span>
    `
        container.appendChild(entry)
    })
}

function clearLogs() {
    state.logs = []
    const container = document.getElementById('logsContainer')
    if (container) {
        container.innerHTML = '<div class="log-empty">No logs to display</div>'
    }
    showToast('Logs cleared', 'info')
}

function toggleAutoScroll() {
    state.autoScroll = !state.autoScroll
    const btn = document.getElementById('btnAutoScroll')
    if (btn) {
        btn.classList.toggle('btn-primary', state.autoScroll)
        btn.classList.toggle('btn-secondary', !state.autoScroll)
    }
    showToast(`Auto - scroll ${ state.autoScroll ? 'enabled' : 'disabled' } `, 'info')
}

// ============================================================================
// Quick Actions
// ============================================================================

function runSingleAccount() {
    if (state.accounts.length === 0) {
        showToast('No accounts available', 'warning')
        return
    }

    const options = state.accounts.map(a =>
        `< option value = "${a.email}" > ${ maskEmail(a.email) }</option > `
    ).join('')

    showModal(
        'Run Single Account',
        `< p style = "margin-bottom: 1rem;" > Select an account to run:</p >
        <select id="singleAccountSelect" class="log-filter" style="width: 100%; padding: 0.5rem;">
            ${options}
        </select>`,
        [
            { text: 'Cancel', class: 'btn btn-secondary', onclick: 'closeModal()' },
            { text: 'Run', class: 'btn btn-primary', onclick: 'executeSingleAccount()' }
        ]
    )
}

async function executeSingleAccount() {
    const select = document.getElementById('singleAccountSelect')
    if (!select) return

    const email = select.value
    closeModal()

    try {
        showToast(`Running account: ${ maskEmail(email) } `, 'info')
        // API call would go here
        // await fetch('/api/run-single', { method: 'POST', body: JSON.stringify({ email }) })
    } catch (error) {
        showToast('Failed to run account: ' + error.message, 'error')
    }
}

function exportLogs() {
    if (state.logs.length === 0) {
        showToast('No logs to export', 'warning')
        return
    }

    const logText = state.logs.map(log =>
        `[${ formatTime(log.timestamp) }][${ log.level?.toUpperCase() || 'LOG' }][${ log.source || 'BOT' }] ${ log.message } `
    ).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rewards - bot - logs - ${ new Date().toISOString().slice(0, 10) }.txt`
    a.click()
    URL.revokeObjectURL(url)

    showToast('Logs exported', 'success')
}

function openConfig() {
    showToast('Config editor coming soon', 'info')
}

function viewHistory() {
    showToast('History viewer coming soon', 'info')
}

// ============================================================================
// UI Utilities
// ============================================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer')
    if (!container) return

    const toast = document.createElement('div')
    toast.className = `toast ${ type } `

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    }

    toast.innerHTML = `
        < i class="fas ${icons[type] || icons.info}" ></i >
            <span>${message}</span>
    `

    container.appendChild(toast)

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse'
        setTimeout(() => toast.remove(), 300)
    }, 4000)
}

function showModal(title, body, buttons = []) {
    const modal = document.getElementById('modal')
    const modalTitle = document.getElementById('modalTitle')
    const modalBody = document.getElementById('modalBody')
    const modalFooter = document.getElementById('modalFooter')

    if (!modal || !modalTitle || !modalBody || !modalFooter) return

    modalTitle.textContent = title
    modalBody.innerHTML = body

    modalFooter.innerHTML = buttons.map(btn =>
        `< button class="${btn.class}" onclick = "${btn.onclick}" > ${ btn.text }</button > `
    ).join('')

    modal.classList.add('show')
}

function closeModal() {
    const modal = document.getElementById('modal')
    if (modal) modal.classList.remove('show')
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal()
    }
})

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal()
    }
})

// ============================================================================
// Theme
// ============================================================================

function toggleTheme() {
    document.body.classList.toggle('light-theme')
    const isLight = document.body.classList.contains('light-theme')
    localStorage.setItem('theme', isLight ? 'light' : 'dark')

    // Update icon
    const btn = document.querySelector('.theme-toggle i')
    if (btn) {
        btn.className = isLight ? 'fas fa-sun' : 'fas fa-moon'
    }

    // Update charts for theme
    updateChartsTheme(isLight)
}

function loadThemePreference() {
    const theme = localStorage.getItem('theme')
    if (theme === 'light') {
        document.body.classList.add('light-theme')
        const btn = document.querySelector('.theme-toggle i')
        if (btn) btn.className = 'fas fa-sun'
        updateChartsTheme(true)
    }
}

function updateChartsTheme(isLight) {
    const gridColor = isLight ? '#eaeef2' : '#21262d'
    const textColor = isLight ? '#656d76' : '#8b949e'

    if (pointsChart) {
        pointsChart.options.scales.x.grid.color = gridColor
        pointsChart.options.scales.y.grid.color = gridColor
        pointsChart.options.scales.x.ticks.color = textColor
        pointsChart.options.scales.y.ticks.color = textColor
        pointsChart.update('none')
    }

    if (activityChart) {
        activityChart.options.plugins.legend.labels.color = textColor
        activityChart.update('none')
    }
}

// ============================================================================
// Uptime Timer
// ============================================================================

function startUptimeTimer() {
    setInterval(() => {
        if (state.isRunning && state.stats.startTime) {
            const elapsed = Date.now() - state.stats.startTime
            document.getElementById('uptime').textContent = formatDuration(elapsed)
        }
    }, 1000)
}

// ============================================================================
// Formatting Utilities
// ============================================================================

function formatTime(timestamp) {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return [hours, minutes, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':')
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${ mb.toFixed(1) } MB`
}

function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// ============================================================================
// Global Error Handler
// ============================================================================

window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', { message, source, lineno, colno, error })
    return false
}

window.onunhandledrejection = (event) => {
    console.error('Unhandled rejection:', event.reason)
}
