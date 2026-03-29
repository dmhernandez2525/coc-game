/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'game-data': [
            'src/data/loaders/index.ts',
            'src/data/loaders/defense-loader.ts',
            'src/data/loaders/resource-loader.ts',
            'src/data/loaders/troop-loader.ts',
            'src/data/loaders/spell-loader.ts',
            'src/data/loaders/hero-loader.ts',
            'src/data/loaders/economy-loader.ts',
            'src/data/loaders/townhall-loader.ts',
            'src/data/loaders/army-building-loader.ts',
          ],
          'battle-engine': [
            'src/engine/battle-engine.ts',
            'src/engine/spell-engine.ts',
            'src/engine/defense-behaviors.ts',
            'src/engine/troop-mechanics.ts',
            'src/engine/targeting-ai.ts',
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/data/loaders/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
    },
  },
})
