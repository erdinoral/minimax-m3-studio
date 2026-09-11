#!/usr/bin/env node
/**
 * Zero-dependency static UI + API proxy for Pinokio.
 * Serves runtime/www and forwards /v1 /setup /engine /health to music-server.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const WWW = path.join(ROOT, 'www')
const HOST = '127.0.0.1'
const PORT = Number(process.env.PINOKIO_UI_PORT || 3000)
const API_HOST = '127.0.0.1'
const API_PORT = Number(process.env.MINIMAX_STUDIO_PORT || 8765)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8'
}

function shouldProxy(urlPath) {
  return (
    urlPath === '/health' ||
    urlPath.startsWith('/health?') ||
    urlPath.startsWith('/v1/') ||
    urlPath.startsWith('/setup') ||
    urlPath.startsWith('/engine')
  )
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` }
  const opts = {
    hostname: API_HOST,
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers
  }
  const upstream = http.request(opts, (up) => {
    res.writeHead(up.statusCode || 502, up.headers)
    up.pipe(res)
  })
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`music-server proxy error: ${err.message}`)
  })
  req.pipe(upstream)
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  fs.createReadStream(filePath).pipe(res)
}

function safeJoin(root, reqPath) {
  const clean = decodeURIComponent(reqPath.split('?')[0].split('#')[0])
  const resolved = path.normalize(path.join(root, clean))
  if (!resolved.startsWith(root)) return null
  return resolved
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/'
  if (shouldProxy(urlPath)) {
    proxy(req, res)
    return
  }

  let filePath = safeJoin(WWW, urlPath === '/' ? '/index.html' : urlPath)
  if (!filePath) {
    res.writeHead(400)
    res.end('bad path')
    return
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }
    fs.stat(filePath, (err2) => {
      if (err2) {
        // SPA fallback
        const index = path.join(WWW, 'index.html')
        fs.stat(index, (err3) => {
          if (err3) {
            res.writeHead(404)
            res.end('UI not found')
            return
          }
          sendFile(res, index)
        })
        return
      }
      sendFile(res, filePath)
    })
  })
})

server.listen(PORT, HOST, () => {
  // Pinokio start.js captures this URL.
  console.log(`http://${HOST}:${PORT}`)
})
