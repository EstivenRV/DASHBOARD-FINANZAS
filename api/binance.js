function getJoinedPath(rawPath) {
  if (Array.isArray(rawPath)) return rawPath.join('/')
  if (typeof rawPath === 'string' && rawPath.length > 0) return rawPath
  return ''
}

function getRequestPath(req) {
  const requestUrl = new URL(req.url, 'http://localhost')
  const rewritePath = getJoinedPath(req.query?.path)
  if (rewritePath) return rewritePath

  const pathname = requestUrl.pathname.replace(/^\/api\/binance\/?/, '')
  return pathname
}

function getFallbackPayload(pathname) {
  if (pathname.includes('ticker/24hr')) {
    return [
      {
        symbol: 'BTCUSDT',
        lastPrice: '63000',
        priceChangePercent: '0.8',
        quoteVolume: '850000000',
      },
      {
        symbol: 'ETHUSDT',
        lastPrice: '1900',
        priceChangePercent: '1.2',
        quoteVolume: '500000000',
      },
      {
        symbol: 'SOLUSDT',
        lastPrice: '72',
        priceChangePercent: '-0.2',
        quoteVolume: '110000000',
      },
    ]
  }

  if (pathname.includes('klines')) {
    const now = Date.now()
    return Array.from({ length: 24 }, (_, index) => {
      const timestamp = now - (23 - index) * 60 * 60 * 1000
      const basePrice = 63000 + index * 120
      return [
        timestamp,
        `${basePrice.toFixed(2)}`,
        `${(basePrice + 10).toFixed(2)}`,
        `${(basePrice - 8).toFixed(2)}`,
        `${basePrice.toFixed(2)}`,
        `${(basePrice + 2).toFixed(2)}`,
        `${(basePrice * 1.1).toFixed(2)}`,
        timestamp + 60_000,
        `${(basePrice * 0.8).toFixed(2)}`,
        `${(basePrice * 0.9).toFixed(2)}`,
        `${(basePrice * 1.05).toFixed(2)}`,
        `${(basePrice * 1.02).toFixed(2)}`,
        `${(basePrice * 1.03).toFixed(2)}`,
      ]
    })
  }

  return []
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const requestUrl = new URL(req.url, 'http://localhost')
  const pathFromRewrite = getRequestPath(req)
  requestUrl.searchParams.delete('path')

  const queryString = requestUrl.search
  const target = `https://api.binance.com/api/v3/${pathFromRewrite}${queryString}`

  try {
    const upstream = await fetch(target, {
      headers: { accept: 'application/json' },
    })
    const bodyText = await upstream.text()
    const contentType = upstream.headers.get('content-type') || ''

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(upstream.status)

    if (upstream.ok) {
      if (contentType.includes('application/json')) {
        return res.json(JSON.parse(bodyText))
      }
      return res.send(bodyText)
    }

    return res.json(getFallbackPayload(pathFromRewrite))
  } catch {
    return res.status(200).json(getFallbackPayload(pathFromRewrite))
  }
}
