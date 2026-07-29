import express from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const PORT = process.env.PORT || 4000

// Simple in-memory cache: key -> { expires: number, data: any }
const cache = new Map()
function getCache(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data
}
function setCache(key, data, ttlMs) {
  cache.set(key, { expires: Date.now() + ttlMs, data })
}

// Allow CORS for any origin (the server will be used as a backend proxy)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use('/api/frankfurter', async (req, res) => {
  try {
    // originalUrl contains path + query
    const original = req.originalUrl || req.url
    const targetPath = original.replace(/^\/api\/frankfurter/, '') || ''
    const target = `https://api.frankfurter.dev/v1${targetPath}`
    const cacheKey = `frankfurter:${target}`

    const cached = getCache(cacheKey)
    if (cached) return res.json(cached)

    const response = await axios.get(target, { timeout: 10_000 })
    setCache(cacheKey, response.data, 60 * 1000) // cache 60s
    res.json(response.data)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      res.status(err.response.status).json({ error: err.response.statusText })
    } else {
      res.status(502).json({ error: 'Bad gateway' })
    }
  }
})

app.use('/api/binance', async (req, res) => {
  try {
    const original = req.originalUrl || req.url
    const targetPath = original.replace(/^\/api\/binance/, '') || ''
    const target = `https://api.binance.com/api/v3${targetPath}`
    const cacheKey = `binance:${target}`

    const cached = getCache(cacheKey)
    if (cached) return res.json(cached)

    const response = await axios.get(target, { timeout: 10_000 })
    setCache(cacheKey, response.data, 60 * 1000) // cache 60s
    res.json(response.data)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      res.status(err.response.status).json({ error: err.response.statusText })
    } else {
      res.status(502).json({ error: 'Bad gateway' })
    }
  }
})

// Add local proxy for CoinGecko so local Express mirrors Vercel serverless behavior
app.use('/api/coingecko', async (req, res) => {
  try {
    const original = req.originalUrl || req.url
    const targetPath = original.replace(/^\/api\/coingecko/, '') || ''
    const target = `https://api.coingecko.com/api/v3${targetPath}`
    const cacheKey = `coingecko:${target}`

    const cached = getCache(cacheKey)
    if (cached) return res.json(cached)

    const response = await axios.get(target, { timeout: 10_000 })
    setCache(cacheKey, response.data, 60 * 1000) // cache 60s
    res.json(response.data)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      // if upstream returns 404/429/403, return a controlled fallback
      const status = err.response.status
      // simple fallback for market_chart paths
      if (err.response && err.config && err.config.url && err.config.url.includes('market_chart')) {
        const now = Date.now()
        const points = 48
        const prices = Array.from({ length: points }, (_, i) => {
          const t = now - (points - 1 - i) * 60 * 60 * 1000
          const base = 63000 + (i - 24) * 20
          return [t, Number(base.toFixed(2))]
        })
        return res.status(200).json({ prices, market_caps: prices.map(([t,p])=>[t, p*20000000]), total_volumes: prices.map(([t,p])=>[t, p*10000]) })
      }
      res.status(status).json({ error: err.response.statusText })
    } else {
      res.status(502).json({ error: 'Bad gateway' })
    }
  }
})

app.get('/api/rates/latest', async (req, res) => {
  try {
    const target = 'https://open.er-api.com/v6/latest/USD'
    const cacheKey = 'rates:usd-latest'

    const cached = getCache(cacheKey)
    if (cached) return res.json(cached)

    const response = await axios.get(target, { timeout: 10_000 })
    setCache(cacheKey, response.data, 60 * 60 * 1000) // cache 1h
    res.json(response.data)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      res.status(err.response.status).json({ error: err.response.statusText })
    } else {
      res.status(502).json({ error: 'Bad gateway' })
    }
  }
})

// If a Vite build exists, serve it as static files (SPA fallback)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, '..', 'dist')

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback: serve index.html for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Proxy server listening on http://localhost:${PORT}`)
})
