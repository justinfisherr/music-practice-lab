import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages at https://justinfisherr.github.io/music-practice-lab/
// so built asset URLs default to the repo-name prefix. Vercel overrides this to
// '/' via the VITE_BASE_URL build env var.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE_URL || '/music-practice-lab/') : '/',
  plugins: [react()],
}))
