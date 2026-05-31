import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Vercel serves from the domain root, so base is '/'.
// (If you ever deploy to GitHub Pages again, set base to '/topgainer-hq/'.)
export default defineConfig({
  plugins: [react()],
  base: '/',
})
