# Dashboard de finanzas personales

Dashboard en React + TypeScript con estilo oscuro y métricas en tiempo real.

## Incluye

- Tipos de cambio con [Frankfurter API](https://www.frankfurter.app/)
- Mercado cripto y series de tiempo con [CoinGecko API](https://www.coingecko.com/en/api)
- Gráficas con Recharts:
  - Área: USD/MXN (20 días)
  - Línea: precio de BTC por hora
  - Barras: comparativa de monedas
  - Pie: distribución del portafolio

## Ejecutar

Instalar dependencias y ejecutar en modo desarrollo (Vite):

```bash
npm install
npm run dev
```

En desarrollo el frontend hace peticiones directamente al origen. Para evitar problemas de CORS y obtener datos de las APIs externas, se puede ejecutar el proxy local que también sirve la build en producción:

1. Ejecutar el proxy local (Express):

```bash
npm run server
# o
npm start
```

2. (Opcional) Configurar la app para que use el proxy en desarrollo mediante la variable de entorno VITE_BACKEND_URL:

Crea un archivo `.env` en la raíz del proyecto con:

```
VITE_BACKEND_URL=http://localhost:4000
```

y reinicia `npm run dev`.

## Build y servir en producción

1. Generar la build de Vite:

```bash
npm run build
```

2. Iniciar el servidor Express que sirve la build y proxifica las APIs:

```bash
npm start
# escucha en http://localhost:4000
```

Ahora abre `http://localhost:4000` y la aplicación servirá los archivos estáticos y las rutas API (`/api/frankfurter/*`, `/api/coingecko/*`) desde el mismo origen, evitando CORS en producción.

## Notas y recomendaciones

- El proxy implementado en `server/index.js`:
  - Proxifica `GET /api/frankfurter/*` -> `https://api.frankfurter.app/*` (cache 60s)
  - Proxifica `GET /api/coingecko/*` -> `https://api.coingecko.com/api/v3/*` (cache 30s)
  - Añade cabeceras CORS y un fallback SPA para servir `dist/index.html` cuando exista la build.

- Rate limits:
  - CoinGecko puede devolver 429 (Too Many Requests) si hay muchas peticiones seguidas. El proxy aplica cache en memoria para mitigar, pero en producción se recomienda usar un cache externo (por ejemplo Redis) y una estrategia de backoff/retries.

- Opciones de despliegue:
  - Servir el proyecto en un VPS o en una plataforma de PaaS (Heroku, Render, DigitalOcean) ejecutando `npm start` en producción.
  - Para escalado y estabilidad, mover la caché a Redis y ejecutar el servidor con un proceso monitor (PM2, systemd, Docker).

## Scripts útiles

- `npm run dev` — arranca Vite en modo desarrollo (hot reload)
- `npm run build` — compila la aplicación para producción
- `npm start` / `npm run server` — inicia el servidor Express (proxy + sirve `dist/` si existe)
- `npm run lint` — ejecuta linter (oxlint)

## Desarrollo adicional

Si quieres que implemente la persistencia de caché (Redis) o un script de arranque con PM2 para producción, dímelo y lo preparo.
