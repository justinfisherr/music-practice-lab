import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages at https://justinfisherr.github.io/music-practice-lab/
// so built asset URLs must be prefixed with the repo name. Locally (dev/preview)
// we keep '/' so nothing breaks.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/music-practice-lab/' : '/',
  plugins: [react()],
}))
