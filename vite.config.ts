import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Frankfurter API to avoid CORS in development
      '/api/frankfurter': {
        target: 'https://api.frankfurter.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/frankfurter/, ''),
      },
      // Proxy CoinGecko API to avoid CORS in development
      '/api/coingecko': {
        target: 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, ''),
      },
    },
  },
})
