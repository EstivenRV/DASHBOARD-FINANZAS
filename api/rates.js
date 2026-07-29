export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const upstream = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { accept: 'application/json' },
    })
    const bodyText = await upstream.text()
    const contentType = upstream.headers.get('content-type') || ''

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
    res.status(upstream.status)

    if (contentType.includes('application/json')) {
      return res.json(JSON.parse(bodyText))
    }

    return res.send(bodyText)
  } catch {
    return res.status(502).json({ error: 'Bad gateway' })
  }
}
