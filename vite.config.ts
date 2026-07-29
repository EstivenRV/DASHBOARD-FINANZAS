import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Frankfurter API to avoid CORS in development
      '/api/frankfurter': {
        target: 'https://api.frankfurter.dev/v1',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/frankfurter/, ''),
      },
      // Proxy Binance API to avoid CORS and rate limiting in development
      '/api/binance': {
        target: 'https://api.binance.com/api/v3',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/binance/, ''),
      },
      // Proxy USD rates API with COP support
      '/api/rates/latest': {
        target: 'https://open.er-api.com/v6/latest/USD',
        changeOrigin: true,
        secure: true,
        rewrite: () => '',
      },
    },
  },
})
