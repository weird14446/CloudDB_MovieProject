import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawApiBase = env.VITE_API_BASE_URL || 'http://localhost:4000/api'
  const proxyTarget = rawApiBase.startsWith('http')
    ? rawApiBase.replace(/\/api\/?$/, '')
    : 'http://localhost:4000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
