function getJoinedPath(rawPath) {
  if (Array.isArray(rawPath)) return rawPath.join('/')
  if (typeof rawPath === 'string' && rawPath.length > 0) return rawPath
  return ''
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

    if (contentType.includes('application/json')) {
      return res.json(JSON.parse(bodyText))
    }

    return res.send(bodyText)
  } catch {
    return res.status(502).json({ error: 'Bad gateway' })
  }
}
