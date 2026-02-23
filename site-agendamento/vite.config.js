import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 🚀 MUDE PARA '/' (Caminho Absoluto)
  // Isso garante que os scripts sejam achados em qualquer sub-rota
  base: '/', 
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})