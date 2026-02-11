import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const isNodeModule = /node_modules[\\/]/.test(id)
          if (!isNodeModule) return

          if (/node_modules[\\/]react-router-dom[\\/]/.test(id)) return 'router'
          if (/node_modules[\\/]framer-motion[\\/]/.test(id)) return 'motion'
          if (/node_modules[\\/]@supabase[\\/]supabase-js[\\/]/.test(id)) return 'supabase'
          if (/node_modules[\\/]@vercel[\\/]analytics[\\/]/.test(id)) return 'analytics'
          if (/node_modules[\\/]react-icons[\\/]/.test(id)) return 'icons'
          if (/node_modules[\\/]stripe[\\/]/.test(id)) return 'stripe'
          // Keep React + its runtime scheduler in the same chunk to avoid
          // circular chunk imports (e.g. react -> vendor -> react) that can
          // lead to `createContext` being undefined at runtime.
          if (/node_modules[\\/]scheduler[\\/]/.test(id)) return 'react'
          if (/node_modules[\\/]react-dom[\\/]/.test(id)) return 'react'
          if (/node_modules[\\/]react[\\/]/.test(id)) return 'react'

          return 'vendor'
        },
      },
    },
  },
})
