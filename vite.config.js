import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
