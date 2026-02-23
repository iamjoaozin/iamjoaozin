import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 🚀 ISSO AQUI É O QUE COLOCA O ./ NO HTML AUTOMATICAMENTE
  base: './', 
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})