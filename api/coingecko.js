function getJoinedPath(rawPath) {
  if (Array.isArray(rawPath)) return rawPath.join('/')
  if (typeof rawPath === 'string' && rawPath.length > 0) return rawPath
  return ''
}

function generateCoingeckoFallback(pathname, query) {
  // if market_chart requested, return synthetic hourly prices for 48 points
  if (pathname.includes('market_chart')) {
    const now = Date.now()
    const points = 48
    const prices = Array.from({ length: points }, (_, i) => {
      const t = now - (points - 1 - i) * 60 * 60 * 1000
      const base = 63000 + (i - 24) * 20
      return [t, Number(base.toFixed(2))]
    })
    return {
      prices,
      market_caps: prices.map(([t, p]) => [t, Number((p * 20_000_000).toFixed(2))]),
      total_volumes: prices.map(([t, p]) => [t, Number((p * 10_000).toFixed(2))]),
    }
  }
  // default minimal response
  return { prices: [], market_caps: [], total_volumes: [] }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const requestUrl = new URL(req.url, 'http://localhost')
  const pathFromRewrite = getJoinedPath(req.query.path)
  requestUrl.searchParams.delete('path')

  const queryString = requestUrl.search
  const target = `https://api.coingecko.com/api/v3/${pathFromRewrite}${queryString}`

  try {
    const upstream = await fetch(target, {
      headers: { accept: 'application/json' },
    })
    const bodyText = await upstream.text()
    const contentType = upstream.headers.get('content-type') || ''

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    res.status(upstream.status)

    if (upstream.ok) {
      if (contentType.includes('application/json')) {
        return res.json(JSON.parse(bodyText))
      }
      return res.send(bodyText)
    }

    // upstream returned non-ok -> fallback
    const fallback = generateCoingeckoFallback(pathFromRewrite, queryString)
    return res.status(200).json(fallback)
  } catch (err) {
    // network error -> fallback and log
    // eslint-disable-next-line no-console
    console.error('Coingecko handler error:', err && err.message ? err.message : err)
    const fallback = generateCoingeckoFallback(pathFromRewrite, requestUrl.search)
    return res.status(200).json(fallback)
  }
}
