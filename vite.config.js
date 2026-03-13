import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function localApiPlugin() {
  return {
    name: 'local-api-handlers',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url || !req.url.startsWith('/api/')) return next();

          const pathname = req.url.split('?')[0];
          const relative = pathname.replace(/^\/api\//, 'api/');

          let filePath = path.resolve(process.cwd(), relative);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.js');
          } else if (!filePath.endsWith('.js')) {
            const withJs = `${filePath}.js`;
            if (fs.existsSync(withJs)) filePath = withJs;
          }

          if (!fs.existsSync(filePath)) return next();

          const mod = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
          const handler = mod?.default;

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: `Invalid handler export for ${pathname}` }));
            return;
          }

          await handler(req, res);
        } catch (err) {
          res.statusCode = err?.status || 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Local API error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Ensure server-side handlers can read env vars from `.env*` files via process.env.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
    plugins: [
      react(),
      localApiPlugin(),
      ViteImageOptimizer({
        jpg: { quality: 80 },
        jpeg: { quality: 80 },
        png: { quality: 80 },
        webp: { quality: 80 },
        avif: { quality: 60 },
        svg: { multipass: true },
      }),
    ],
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
  }
})
