import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 8787
const QUEUE_PATH = path.join(__dirname, 'review-queue.jsonl')
const LATEST_REMAINING_PATH = path.join(__dirname, 'latest-remaining.json')
const FORWARD_WEBHOOK_URL = process.env.FORWARD_WEBHOOK_URL

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function forwardIfConfigured(body) {
  if (!FORWARD_WEBHOOK_URL) return
  try {
    await fetch(FORWARD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (err) {
    console.error('forward failed:', err?.message || err)
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/review') {
    try {
      const raw = await readBody(req)
      let payload
      try {
        payload = JSON.parse(raw || '{}')
      } catch {
        res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'invalid json' }))
        return
      }
      const line = JSON.stringify(payload) + '\n'
      fs.appendFileSync(QUEUE_PATH, line, 'utf8')
      fs.writeFileSync(LATEST_REMAINING_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
      // respond first; forward without failing client
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      void forwardIfConfigured(JSON.stringify(payload))
    } catch (err) {
      console.error('review handler error:', err)
      res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false }))
    }
    return
  }

  res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'not found' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`notify-server listening on http://127.0.0.1:${PORT}`)
})
