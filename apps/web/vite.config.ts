/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Local development only: lets the browser call a same-origin relative
    // `/api/...` path instead of requiring the backend to expand CORS for
    // the web dev server's origin (see apps/api's `local` profile, which
    // already grants CORS to Expo Web's origin for the same reason).
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // `changeOrigin` only rewrites the Host header, not Origin — the
        // browser's real `Origin: http://localhost:5173` was still reaching
        // Spring untouched, and since only `http://localhost:8081` (Expo
        // Web) is CORS-allowed there, every proxied request was rejected
        // with 403 before it ever reached a controller. Overriding Origin
        // to match the proxy target makes Spring's `CorsUtils.isCorsRequest`
        // see a same-origin request (Origin == the request's own host), so
        // it never invokes CORS checking at all — no backend CORS change.
        headers: {
          Origin: 'http://localhost:8080',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
