import { app, BrowserWindow, shell } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

app.disableHardwareAcceleration()

const DEFAULT_SERVER_URL = 'http://192.168.31.19:5000'
const SERVER_HOSTNAME_URL = 'http://DESKTOP-2T3MG9J:5000'

function normalizeServerUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function readServerConfig() {
  const candidates = [
    process.env.MEDICORE_SERVER_URL,
    path.join(path.dirname(process.execPath), 'server-config.json'),
    path.join(app.getPath('userData'), 'server-config.json'),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (/^https?:\/\//i.test(candidate)) return normalizeServerUrl(candidate)

    try {
      if (!fs.existsSync(candidate)) continue
      const config = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      const configuredUrl = normalizeServerUrl(config.serverUrl || config.url)
      if (configuredUrl) return configuredUrl
    } catch (err) {
      console.error(`Could not read server config from ${candidate}:`, err.message)
    }
  }

  return DEFAULT_SERVER_URL
}

async function canReachServer(serverUrl) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const response = await fetch(`${serverUrl}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}

async function resolveServerUrl() {
  const configuredUrl = readServerConfig()
  const candidates = [...new Set([
    configuredUrl,
    DEFAULT_SERVER_URL,
    SERVER_HOSTNAME_URL,
    'http://localhost:5000',
  ])]

  for (const candidate of candidates) {
    if (await canReachServer(candidate)) return candidate
  }

  const discoveredUrl = await discoverLanServer()
  if (discoveredUrl) return discoveredUrl

  return configuredUrl
}

function getPrivateLanPrefixes() {
  const prefixes = []
  const interfaces = os.networkInterfaces()

  for (const items of Object.values(interfaces)) {
    for (const item of items || []) {
      if (item.family !== 'IPv4' || item.internal) continue
      const parts = item.address.split('.')
      if (parts.length !== 4) continue
      const [a, b, c] = parts.map(Number)
      const isPrivate =
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      if (isPrivate) prefixes.push(`${a}.${b}.${c}`)
    }
  }

  return [...new Set(prefixes)]
}

async function discoverLanServer() {
  const prefixes = getPrivateLanPrefixes()

  for (const prefix of prefixes) {
    const urls = Array.from({ length: 254 }, (_value, index) => `http://${prefix}.${index + 1}:5000`)
    const batchSize = 32

    for (let index = 0; index < urls.length; index += batchSize) {
      const batch = urls.slice(index, index + batchSize)
      const results = await Promise.all(batch.map(async (url) => ((await canReachServer(url)) ? url : null)))
      const found = results.find(Boolean)
      if (found) return found
    }
  }

  return null
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MediCore HMS',
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const showMessage = (title, body) => {
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <head><title>MediCore HMS</title></head>
        <body style="font-family:Segoe UI,Arial,sans-serif;margin:48px;color:#172033;background:#fff">
          <h2>${title}</h2>
          <p>${body}</p>
          <p>Server URLs tried:</p>
          <ul>
            <li>${SERVER_HOSTNAME_URL}</li>
            <li>${DEFAULT_SERVER_URL}</li>
            <li>http://localhost:5000</li>
          </ul>
        </body>
      </html>
    `)}`)
  }

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('did-fail-load', (_event, _code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    showMessage('MediCore HMS server is not reachable', `${description || 'Connection failed'}: ${validatedURL || ''}`)
  })

  showMessage('Opening MediCore HMS...', 'Connecting to the server on this network.')

  const serverUrl = await resolveServerUrl()
  if (!(await canReachServer(serverUrl))) {
    showMessage('MediCore HMS server is not reachable', 'Start the server PC backend and confirm both PCs are on the same network.')
    return
  }

  win.loadURL(`${serverUrl}/login`)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
