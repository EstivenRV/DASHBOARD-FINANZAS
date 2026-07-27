export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const rawPath = req.query.path
  const pathParts = Array.isArray(rawPath)
    ? rawPath
    : rawPath
      ? [rawPath]
      : []
  const requestUrl = new URL(req.url, 'http://localhost')
  const queryString = requestUrl.search
  const target = `https://api.coingecko.com/api/v3/${pathParts.join('/')}${queryString}`

  try {
    const upstream = await fetch(target, {
      headers: { accept: 'application/json' },
    })
    const bodyText = await upstream.text()

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    res.status(upstream.status)

    if (!upstream.ok) {
      return res.send(bodyText)
    }

    const contentType = upstream.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return res.json(JSON.parse(bodyText))
    }

    return res.send(bodyText)
  } catch {
    return res.status(502).json({ error: 'Bad gateway' })
  }
}
