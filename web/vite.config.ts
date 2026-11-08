import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Copy bundled mock data (src/mock/*) into public/data/ at build time so the
 * production bundle is demoable out of the box. Files already present in
 * public/data (e.g. written by the real pipeline) are never overwritten.
 */
function copyMockData(): import('vite').Plugin {
  return {
    name: 'copy-mock-data',
    apply: 'build',
    closeBundle() {
      const srcDir = join(__dirname, 'src', 'mock')
      const outDir = join(__dirname, 'public', 'data')
      if (!existsSync(srcDir)) return
      mkdirSync(outDir, { recursive: true })
      for (const f of readdirSync(srcDir)) {
        const dest = join(outDir, f)
        if (!existsSync(dest)) {
          copyFileSync(join(srcDir, f), dest)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyMockData()],
  server: { port: 5173 },
})
