import express from 'express'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import QRCode from 'qrcode'
import pino from 'pino'

const logger = pino({ level: 'info' })
const app = express()
app.use(express.json())

const SESSION_DIR = './session'
const PORT = 3005

let sock = null
let qrDataUrl = null
let isConnected = false
let connectionStatus = 'disconnected' // disconnected | connecting | qr_ready | connected

async function startWhatsApp() {
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys')

  if (!existsSync(SESSION_DIR)) {
    await mkdir(SESSION_DIR, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  connectionStatus = 'connecting'

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['BR RetailFlow', 'Chrome', '1.0.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrDataUrl = await QRCode.toDataURL(qr)
      connectionStatus = 'qr_ready'
      isConnected = false
      logger.info('QR code ready — scan with WhatsApp')
    }

    if (connection === 'open') {
      isConnected = true
      connectionStatus = 'connected'
      qrDataUrl = null
      logger.info('WhatsApp connected!')
    }

    if (connection === 'close') {
      isConnected = false
      connectionStatus = 'disconnected'
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      logger.info(`Connection closed (${statusCode}), reconnect: ${shouldReconnect}`)
      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000)
      } else {
        // Logged out — clear session
        connectionStatus = 'logged_out'
      }
    }
  })
}

// ============ ROUTES ============

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', whatsapp: connectionStatus })
})

// Get connection status + QR code
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    connected: isConnected,
    qr: qrDataUrl || null,
  })
})

// Send a message
app.post('/send', async (req, res) => {
  const { to, message } = req.body

  if (!to || !message) {
    return res.status(400).json({ error: 'to and message are required' })
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp not connected', status: connectionStatus })
  }

  try {
    // Format number: add @s.whatsapp.net if not already formatted
    const numbers = Array.isArray(to) ? to : [to]
    const results = []

    for (const num of numbers) {
      const jid = num.includes('@') ? num : `${num.replace(/[^0-9]/g, '')}@s.whatsapp.net`
      await sock.sendMessage(jid, { text: message })
      results.push({ to: jid, sent: true })
      logger.info(`Message sent to ${jid}`)
    }

    res.json({ success: true, results })
  } catch (err) {
    logger.error(`Send failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// Send to multiple numbers (bulk)
app.post('/send-bulk', async (req, res) => {
  const { recipients, message } = req.body

  if (!recipients?.length || !message) {
    return res.status(400).json({ error: 'recipients array and message are required' })
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp not connected' })
  }

  const results = []
  for (const num of recipients) {
    try {
      const jid = num.includes('@') ? num : `${num.replace(/[^0-9]/g, '')}@s.whatsapp.net`
      await sock.sendMessage(jid, { text: message })
      results.push({ to: num, sent: true })
      await new Promise(r => setTimeout(r, 500)) // small delay between messages
    } catch (err) {
      results.push({ to: num, sent: false, error: err.message })
    }
  }

  res.json({ success: true, results })
})

// Logout / disconnect
app.post('/logout', async (req, res) => {
  try {
    if (sock) await sock.logout()
    isConnected = false
    connectionStatus = 'disconnected'
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  logger.info(`WhatsApp service running on port ${PORT}`)
  startWhatsApp()
})
