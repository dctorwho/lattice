import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const rootDirectory = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(rootDirectory, 'src/main/index.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(rootDirectory, 'src/preload/index.ts'),
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(rootDirectory, 'src/renderer'),
    plugins: [react()]
  }
})
