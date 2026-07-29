import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type FxLatestResponse = {
  rates: Record<string, number>
}

type FxHistoryResponse = {
  rates: Record<string, Record<string, number>>
}

type CoinMarket = {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  market_cap: number
  total_volume: number
}

type BinanceTickerResponse = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
}

type BinanceKlineResponse = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

type FxTrendPoint = {
  date: string
  usd: number
  eur: number
}

type BtcTrendPoint = {
  time: string
  price: number
}

const REFRESH_INTERVAL_MS = 120_000

// Backend base URL: set VITE_BACKEND_URL in local dev (e.g. http://localhost:4000) to use the proxy server.
// In production, if it points to localhost by mistake, ignore it and use relative '/api/...' paths.
const rawBackend = import.meta.env.VITE_BACKEND_URL ?? ''
const normalizedBackend = rawBackend.replace(/\/$/, '')
const BACKEND =
  import.meta.env.PROD && /^https?:\/\/localhost(?::\d+)?$/i.test(normalizedBackend)
    ? ''
    : normalizedBackend
function withBackend(path: string) {
  return BACKEND ? `${BACKEND}${path}` : path
}
const FX_CODES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'BRL', 'GBP'] as const
const FX_OPTIONS = [
  { code: 'USD', name: 'Dólar estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'MXN', name: 'Peso mexicano' },
  { code: 'COP', name: 'Peso colombiano' },
  { code: 'ARS', name: 'Peso argentino' },
  { code: 'BRL', name: 'Real brasileño' },
  { code: 'GBP', name: 'Libra esterlina' },
] as const
const CHART_GRID_COLOR = '#d7e8e1'
const CHART_AXIS_COLOR = '#6a857b'
const CHART_PRIMARY = '#16c79a'
const CHART_SECONDARY = '#0ea5a0'
const CHART_ACCENT = '#0f7f77'

const compactNumber = new Intl.NumberFormat('es-MX', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

function formatCurrency(value: number, currencyCode: string): string {
  const maximumFractionDigits = ['COP', 'JPY'].includes(currencyCode) ? 0 : 2
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits,
  }).format(value)
}

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (amount === 0 || !fromCurrency || !toCurrency || fromCurrency === toCurrency) {
    return amount
  }

  const fromRate = fromCurrency === 'USD' ? 1 : rates[fromCurrency] ?? 0
  const toRate = toCurrency === 'USD' ? 1 : rates[toCurrency] ?? 0

  if (!fromRate || !toRate) {
    return 0
  }

  return amount * toRate / fromRate
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Error ${response.status} consultando ${url}`)
  }
  return (await response.json()) as T
}

function formatDateForApi(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDateRange(days: number): { start: string; end: string } {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)
  return {
    start: formatDateForApi(startDate),
    end: formatDateForApi(endDate),
  }
}

async function getFxLatest(): Promise<FxLatestResponse> {
  return fetchJson<FxLatestResponse>(withBackend('/api/rates/latest'))
}

async function getFxTrend(
  targetCurrency: string,
  fallbackRates: Record<string, number> = {},
): Promise<FxTrendPoint[]> {
  const { start, end } = getDateRange(20)

  const requests = await Promise.allSettled([
    fetchJson<FxHistoryResponse>(
      withBackend(`/api/frankfurter/${start}..${end}?from=USD&to=${targetCurrency}`),
    ),
    fetchJson<FxHistoryResponse>(
      withBackend(`/api/frankfurter/${start}..${end}?from=EUR&to=${targetCurrency}`),
    ),
  ])

  const merged = new Map<string, FxTrendPoint>()

  const applySeries = (result: FxHistoryResponse, key: 'usd' | 'eur') => {
    Object.entries(result.rates)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([date, value]) => {
        const existing = merged.get(date) ?? {
          date: date.slice(5),
          usd: 0,
          eur: 0,
        }
        const numericValue = Number(value[targetCurrency] ?? 0)
        if (key === 'usd') {
          existing.usd = numericValue
        } else {
          existing.eur = numericValue
        }
        merged.set(date, existing)
      })
  }

  if (requests[0].status === 'fulfilled') {
    applySeries(requests[0].value, 'usd')
  }

  if (requests[1].status === 'fulfilled') {
    applySeries(requests[1].value, 'eur')
  }

  if (merged.size === 0) {
    const baseValue = fallbackRates[targetCurrency] ?? 1
    const eurValue = fallbackRates.EUR ?? 0.92
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (11 - index))
      const factor = 1 + (index - 5) * 0.003
      return {
        date: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
        usd: baseValue * factor,
        eur: eurValue * factor,
      }
    })
  }

  return Array.from(merged.values()).sort((left, right) => left.date.localeCompare(right.date))
}

async function getCryptoMarket(): Promise<CoinMarket[]> {
  const tickers = await fetchJson<BinanceTickerResponse[]>(
    withBackend(
      '/api/binance/ticker/24hr?symbols=%5B%22BTCUSDT%22%2C%22ETHUSDT%22%2C%22SOLUSDT%22%5D',
    ),
  )

  const metaBySymbol: Record<string, { id: string; name: string; symbol: string }> = {
    BTCUSDT: { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
    ETHUSDT: { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
    SOLUSDT: { id: 'solana', name: 'Solana', symbol: 'sol' },
  }

  return tickers
    .filter((ticker) => metaBySymbol[ticker.symbol])
    .map((ticker) => {
      const meta = metaBySymbol[ticker.symbol]
      const lastPrice = Number(ticker.lastPrice)
      const change = Number(ticker.priceChangePercent)
      const quoteVolume = Number(ticker.quoteVolume)
      return {
        id: meta.id,
        symbol: meta.symbol,
        name: meta.name,
        current_price: Number.isFinite(lastPrice) ? lastPrice : 0,
        price_change_percentage_24h: Number.isFinite(change) ? change : 0,
        market_cap: Number.isFinite(quoteVolume) ? quoteVolume : 0,
        total_volume: Number.isFinite(quoteVolume) ? quoteVolume : 0,
      }
    })
}

async function getBitcoinTrend(): Promise<BtcTrendPoint[]> {
  const response = await fetchJson<BinanceKlineResponse[]>(
    withBackend('/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=48'),
  )

  return response.map((kline) => ({
    time: new Date(kline[0]).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    price: Number(kline[4]),
  }))
}

function App() {
  const [fxLatest, setFxLatest] = useState<FxLatestResponse | null>(null)
  const [fxTrend, setFxTrend] = useState<FxTrendPoint[]>([])
  const [cryptoMarket, setCryptoMarket] = useState<CoinMarket[]>([])
  const [btcTrend, setBtcTrend] = useState<BtcTrendPoint[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState('COP')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [customAmount, setCustomAmount] = useState('10')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadDashboard = useCallback(async (initialLoad: boolean) => {
    if (initialLoad) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const latestFxPromise = getFxLatest()
      const trendFxPromise = latestFxPromise.then((latest) =>
        getFxTrend(selectedCurrency, latest.rates),
      )
      const [latestFxResult, trendFxResult, marketCryptoResult, trendBtcResult] =
        await Promise.allSettled([
          latestFxPromise,
          trendFxPromise,
          getCryptoMarket(),
          getBitcoinTrend(),
        ])

      const errors: string[] = []
      let updatedAnyBlock = false

      if (latestFxResult.status === 'fulfilled') {
        setFxLatest(latestFxResult.value)
        updatedAnyBlock = true
      } else {
        errors.push('Divisas actuales no disponibles.')
      }

      if (trendFxResult.status === 'fulfilled') {
        setFxTrend(trendFxResult.value)
        updatedAnyBlock = true
      } else {
        errors.push('Histórico USD/EUR no disponible.')
      }

      if (marketCryptoResult.status === 'fulfilled') {
        setCryptoMarket(marketCryptoResult.value)
        updatedAnyBlock = true
      } else {
        errors.push('Mercado cripto no disponible.')
      }

      if (trendBtcResult.status === 'fulfilled') {
        setBtcTrend(trendBtcResult.value)
        updatedAnyBlock = true
      } else {
        const reason = trendBtcResult.reason
        const message =
          reason instanceof Error ? reason.message : String(reason ?? '')
        if (message.includes('429')) {
          errors.push(
            'BTC por hora temporalmente limitado (429 de CoinGecko). Intenta de nuevo en 1-2 minutos.',
          )
        } else {
          errors.push('Serie BTC por hora no disponible.')
        }
      }

      if (updatedAnyBlock) {
        setLastUpdated(new Date())
      }

      setError(errors.length > 0 ? errors.join(' ') : null)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedCurrency])

  useEffect(() => {
    void loadDashboard(true)
    const intervalId = window.setInterval(() => {
      void loadDashboard(false)
    }, REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadDashboard])

  const coinById = useMemo(
    () =>
      cryptoMarket.reduce<Record<string, CoinMarket>>((accumulator, coin) => {
        accumulator[coin.id] = coin
        return accumulator
      }, {}),
    [cryptoMarket],
  )

  const rates = fxLatest?.rates ?? {}
  const parsedAmount = Number.parseFloat(customAmount)
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0
  const convertedAmount = convertAmount(safeAmount, baseCurrency, selectedCurrency, rates)
  const referenceAmount = convertAmount(1, 'USD', selectedCurrency, rates)

  const comparisonCurrencies = FX_CODES.filter((code) => code !== selectedCurrency)
  const comparisonData = comparisonCurrencies.map((code) => {
    const value = convertAmount(1, code, selectedCurrency, rates)
    return {
      code,
      value,
      label: code,
    }
  })

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <p className="sidebar-label">Mercado</p>
        <h1>Tu contexto financiero en una vista</h1>
        <p className="sidebar-subtitle">
          Elige una moneda, ajusta un monto y consulta cómo se mueve el dólar, el euro y el BTC en tiempo real.
        </p>

        <div className="status-box">
          <span>{isRefreshing ? 'Actualizando...' : 'En línea'}</span>
          <span>
            {lastUpdated
              ? `Actualizado: ${lastUpdated.toLocaleTimeString('es-MX')}`
              : 'Sin datos'}
          </span>
        </div>

        <div className="control-card">
          <label className="control-label" htmlFor="base-currency">
            Moneda base
          </label>
          <select
            id="base-currency"
            value={baseCurrency}
            onChange={(event) => setBaseCurrency(event.target.value)}
          >
            {FX_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>

          <label className="control-label" htmlFor="amount">
            Monto
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="1"
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
          />

          <label className="control-label" htmlFor="target-currency">
            Moneda de referencia
          </label>
          <select
            id="target-currency"
            value={selectedCurrency}
            onChange={(event) => setSelectedCurrency(event.target.value)}
          >
            {FX_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>

          <p className="helper-text">
            Convierte un monto y compara el valor visual de varias monedas frente a la que elijas.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={() => {
            void loadDashboard(false)
          }}
          disabled={isRefreshing || isLoading}
        >
          Refrescar ahora
        </button>
      </aside>

      <main className="content">
        {error ? (
          <p className="error-banner">
            No se pudieron cargar todos los datos: {error}
          </p>
        ) : null}

        <section className="kpi-grid">
          <article className="kpi-card emphasis">
            <p className="label">1 {baseCurrency} en {selectedCurrency}</p>
            <p className="value">{formatCurrency(referenceAmount, selectedCurrency)}</p>
            <p className="delta">Valor de referencia para tu moneda favorita</p>
          </article>
          <article className="kpi-card">
            <p className="label">Conversión rápida</p>
            <p className="value">{formatCurrency(convertedAmount, selectedCurrency)}</p>
            <p className="delta">
              {safeAmount} {baseCurrency} · {selectedCurrency}
            </p>
          </article>
          <article className="kpi-card">
            <p className="label">BTC ahora</p>
            <p className="value">{formatCurrency(coinById.bitcoin?.current_price ?? 0, 'USD')}</p>
            <p
              className={`delta ${
                (coinById.bitcoin?.price_change_percentage_24h ?? 0) >= 0 ? 'up' : 'down'
              }`}
            >
              {(coinById.bitcoin?.price_change_percentage_24h ?? 0).toFixed(2)}%
            </p>
          </article>
          <article className="kpi-card">
            <p className="label">EUR / USD</p>
            <p className="value">{formatCurrency(convertAmount(1, 'EUR', selectedCurrency, rates), selectedCurrency)}</p>
            <p className="delta">1 EUR ≈ {formatCurrency(convertAmount(1, 'EUR', 'USD', rates), 'USD')}</p>
          </article>
        </section>

        <section className="charts-grid">
          <article className="chart-card">
            <h2>USD / EUR vs {selectedCurrency} (20 días)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={fxTrend}>
                <defs>
                  <linearGradient id="fxColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={CHART_AXIS_COLOR} />
                <YAxis stroke={CHART_AXIS_COLOR} domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="usd"
                  stroke={CHART_PRIMARY}
                  strokeWidth={2}
                  fill="url(#fxColor)"
                  name="USD"
                />
                <Line
                  type="monotone"
                  dataKey="eur"
                  stroke={CHART_ACCENT}
                  strokeWidth={2}
                  dot={false}
                  name="EUR"
                />
              </AreaChart>
            </ResponsiveContainer>
          </article>

          <article className="chart-card">
            <h2>Comparación rápida</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={comparisonData}>
                <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                <XAxis dataKey="code" stroke={CHART_AXIS_COLOR} />
                <YAxis stroke={CHART_AXIS_COLOR} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value ?? 0), selectedCurrency), '1 unidad']}
                />
                <Bar dataKey="value" fill={CHART_SECONDARY} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className="chart-card full-width">
            <h2>BTC precio por hora</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={btcTrend}>
                <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis stroke={CHART_AXIS_COLOR} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={CHART_ACCENT}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </article>
        </section>

        <section className="coin-strip">
          {cryptoMarket.map((coin) => (
            <article className="coin-card" key={coin.id}>
              <p>{coin.name}</p>
              <strong>{formatCurrency(coin.current_price, 'USD')}</strong>
              <span
                className={coin.price_change_percentage_24h >= 0 ? 'tag up' : 'tag down'}
              >
                {coin.price_change_percentage_24h.toFixed(2)}%
              </span>
              <small>Vol: {compactNumber.format(coin.total_volume)}</small>
            </article>
          ))}
        </section>

        <div className="loading-overlay" aria-hidden={!isLoading}>
          {isLoading ? <span>Cargando datos del mercado...</span> : null}
        </div>
      </main>
    </div>
  )
}

export default App
