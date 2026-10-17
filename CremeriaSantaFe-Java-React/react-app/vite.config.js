import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativo: el build se carga desde file:///android_asset/www/index.html
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
