import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // '/' for GitHub Pages (calendar.yayoe.org, the live calendar today).
  // The Netlify build sets VITE_BASE=/calendar/ (see netlify.toml) so the same
  // source can also be served under tools.yayoe.org/calendar/ behind a proxy.
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // pptxgenjs uses Node.js https module — shim for browser
      https: 'https-browserify',
    }
  },
  optimizeDeps: {
    include: ['jspdf', 'file-saver']
  },
  define: {
    global: 'globalThis'
  }
})
