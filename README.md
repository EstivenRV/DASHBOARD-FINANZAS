## VERCEL
https://dashboard-finanzas-azure.vercel.app

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

- `npm start` / `npm run server` — inicia el servidor Express (proxy + sirve `dist/` si existe)
- `npm run lint` — ejecuta linter (oxlint)
