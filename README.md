# Dashboard de finanzas e información de mercado

Este proyecto es un dashboard minimalista pensado como una vista informativa para seguir divisas, criptomonedas y contexto económico de forma rápida.

No está pensado como un sistema de cuentas bancarias reales, sino como una herramienta visual para entender:
- cuánto vale una moneda frente a otra,
- cómo convertir montos entre distintas monedas,
- cómo se mueve el dólar o el euro en el tiempo,
- y qué pasa con criptomonedas como Bitcoin, Ethereum y Solana.

## Qué incluye

- Selector de moneda base y moneda de referencia.
- Conversión editable de montos entre monedas como USD, EUR, MXN, COP, ARS, BRL y GBP.
- Gráfica histórica para comparar USD/EUR frente a la moneda seleccionada.
- Visualización rápida del precio de BTC y otras criptomonedas.
- Diseño limpio, minimalista y enfocado en la información.

## Tecnologías

- React + TypeScript + Vite
- Recharts para visualizaciones
- Express para proxy local
- Vercel Serverless Functions para despliegue en producción

## Ejecutar localmente

Instala dependencias:

```bash
npm install
```

Inicia el frontend:

```bash
npm run dev
```

Si quieres que el frontend use un proxy local para evitar problemas de CORS, ejecuta también:

```bash
npm run server
```

Y opcionalmente configura una variable de entorno:

```bash
VITE_BACKEND_URL=http://localhost:4000
```

## Build y producción

Genera la build:

```bash
npm run build
```

Sirve la app localmente con el proxy:

```bash
npm start
```

Esto levantará un servidor en `http://localhost:4000` y servirá la app junto con las rutas API necesarias.

## Scripts útiles

```bash
npm run dev      # modo desarrollo
npm run server   # proxy local y servidor express
npm run build    # build de producción
npm run lint     # linter
```
