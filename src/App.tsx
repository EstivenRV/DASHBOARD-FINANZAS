import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type FxLatestResponse = {
  base: string
  date: string
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

type CoinHistoryResponse = {
  prices: [number, number][]
}

type FxTrendPoint = {
  date: string
  usdMxn: number
}

type BtcTrendPoint = {
  time: string
  price: number
}

const REFRESH_INTERVAL_MS = 30_000

// Backend base URL: set VITE_BACKEND_URL in .env (e.g. http://localhost:4000) to use the proxy server.
// If empty, the app will use relative '/api/...' paths (useful when backend is same origin or Vite proxy is used).
const BACKEND = (import.meta.env.VITE_BACKEND_URL ?? '').replace(/\/$/, '')
function withBackend(path: string) {
  return BACKEND ? `${BACKEND}${path}` : path
}
const FX_CODES = ['MXN', 'EUR', 'COP', 'ARS'] as const
const ALLOCATION_COLORS = ['#20d4c5', '#4f7cf7', '#9f72ff', '#f7b84f']

const currencyUsd = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const currencyMx = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

const compactNumber = new Intl.NumberFormat('es-MX', {
  notation: 'compact',
  maximumFractionDigits: 2,
})

const percentFormat = new Intl.NumberFormat('es-MX', {
  style: 'percent',
  maximumFractionDigits: 2,
})

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
  const codes = FX_CODES.join(',')
  return fetchJson<FxLatestResponse>(
    withBackend(`/api/frankfurter/latest?from=USD&to=${codes}`),
  )
}

async function getFxTrend(): Promise<FxTrendPoint[]> {
  const { start, end } = getDateRange(20)
  const response = await fetchJson<FxHistoryResponse>(
    withBackend(`/api/frankfurter/${start}..${end}?from=USD&to=MXN`),
  )

  return Object.entries(response.rates)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date: date.slice(5),
      usdMxn: value.MXN,
    }))
}

async function getCryptoMarket(): Promise<CoinMarket[]> {
  return fetchJson<CoinMarket[]>(
    withBackend('/api/coingecko/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&price_change_percentage=24h'),
  )
}

async function getBitcoinTrend(): Promise<BtcTrendPoint[]> {
  const response = await fetchJson<CoinHistoryResponse>(
    withBackend('/api/coingecko/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=hourly'),
  )

  return response.prices.map(([timestamp, price]) => ({
    time: new Date(timestamp).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    price,
  }))
}

function App() {
  const [fxLatest, setFxLatest] = useState<FxLatestResponse | null>(null)
  const [fxTrend, setFxTrend] = useState<FxTrendPoint[]>([])
  const [cryptoMarket, setCryptoMarket] = useState<CoinMarket[]>([])
  const [btcTrend, setBtcTrend] = useState<BtcTrendPoint[]>([])
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
      const [latestFx, trendFx, marketCrypto, trendBtc] = await Promise.all([
        getFxLatest(),
        getFxTrend(),
        getCryptoMarket(),
        getBitcoinTrend(),
      ])

      setFxLatest(latestFx)
      setFxTrend(trendFx)
      setCryptoMarket(marketCrypto)
      setBtcTrend(trendBtc)
      setError(null)
      setLastUpdated(new Date())
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible obtener datos de mercado.'
      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

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

  const usdCash = 6000
  const cryptoExposure =
    (coinById.bitcoin?.current_price ?? 0) * 0.08 +
    (coinById.ethereum?.current_price ?? 0) * 0.9 +
    (coinById.solana?.current_price ?? 0) * 8
  const emergencyFund = 3500
  const monthlyBudget = 1900

  const totalPatrimony = usdCash + cryptoExposure + emergencyFund
  const mxnPatrimony =
    totalPatrimony * (fxLatest?.rates.MXN ? fxLatest.rates.MXN : 0)

  const allocationData = [
    { name: 'Efectivo USD', value: usdCash },
    { name: 'Cripto', value: cryptoExposure },
    { name: 'Fondo emergencia', value: emergencyFund },
    { name: 'Presupuesto mes', value: monthlyBudget },
  ]

  const fxBars = FX_CODES.map((code) => ({
    code,
    rate: fxLatest?.rates[code] ?? 0,
  }))

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <p className="sidebar-label">Finanzas</p>
        <h1>Panel personal</h1>
        <p className="sidebar-subtitle">
          Monitorea divisas, cripto y estado global de tu patrimonio en tiempo
          real.
        </p>

        <div className="status-box">
          <span>{isRefreshing ? 'Actualizando...' : 'En línea'}</span>
          <span>
            {lastUpdated
              ? `Actualizado: ${lastUpdated.toLocaleTimeString('es-MX')}`
              : 'Sin datos'}
          </span>
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
          <article className="kpi-card">
            <p className="label">Patrimonio total (USD)</p>
            <p className="value">{currencyUsd.format(totalPatrimony)}</p>
          </article>
          <article className="kpi-card">
            <p className="label">Patrimonio convertido (MXN)</p>
            <p className="value">{currencyMx.format(mxnPatrimony)}</p>
          </article>
          <article className="kpi-card">
            <p className="label">BTC (24h)</p>
            <p className="value">
              {currencyUsd.format(coinById.bitcoin?.current_price ?? 0)}
            </p>
            <p
              className={`delta ${
                (coinById.bitcoin?.price_change_percentage_24h ?? 0) >= 0
                  ? 'up'
                  : 'down'
              }`}
            >
              {(coinById.bitcoin?.price_change_percentage_24h ?? 0).toFixed(2)}%
            </p>
          </article>
          <article className="kpi-card">
            <p className="label">Volumen ETH (24h)</p>
            <p className="value">
              {currencyUsd.format(coinById.ethereum?.total_volume ?? 0)}
            </p>
          </article>
        </section>

        <section className="charts-grid">
          <article className="chart-card">
            <h2>USD / MXN (20 días)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={fxTrend}>
                <defs>
                  <linearGradient id="fxColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#20d4c5" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#20d4c5" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2a3140" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8691a8" />
                <YAxis stroke="#8691a8" domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="usdMxn"
                  stroke="#20d4c5"
                  strokeWidth={2}
                  fill="url(#fxColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </article>

          <article className="chart-card">
            <h2>BTC precio por hora</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={btcTrend}>
                <CartesianGrid stroke="#2a3140" strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#8691a8" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#9f72ff"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </article>

          <article className="chart-card">
            <h2>Tipo de cambio por moneda</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={fxBars}>
                <CartesianGrid stroke="#2a3140" strokeDasharray="3 3" />
                <XAxis dataKey="code" stroke="#8691a8" />
                <YAxis stroke="#8691a8" />
                <Tooltip />
                <Bar dataKey="rate" fill="#4f7cf7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className="chart-card">
            <h2>Distribución del portafolio</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={allocationData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                >
                  {allocationData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${entry.value}`}
                      fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => {
                    const numericValue =
                      typeof value === 'number' ? value : Number(value ?? 0)
                    return [currencyUsd.format(numericValue), 'Asignación']
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="legend">
              {allocationData.map((item, index) => (
                <li key={item.name}>
                  <span
                    className="dot"
                    style={{
                      backgroundColor:
                        ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                    }}
                  />
                  <span>{item.name}</span>
                  <strong>
                    {percentFormat.format(item.value / (totalPatrimony || 1))}
                  </strong>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="coin-strip">
          {cryptoMarket.map((coin) => (
            <article className="coin-card" key={coin.id}>
              <p>{coin.name}</p>
              <strong>{currencyUsd.format(coin.current_price)}</strong>
              <span
                className={
                  coin.price_change_percentage_24h >= 0 ? 'tag up' : 'tag down'
                }
              >
                {coin.price_change_percentage_24h.toFixed(2)}%
              </span>
              <small>Cap: {compactNumber.format(coin.market_cap)}</small>
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
