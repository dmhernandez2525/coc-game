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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      include: [
        'src/engine/**/*.ts',
        'src/data/loaders/**/*.ts',
        'src/utils/**/*.ts',
        'src/hooks/useResources.ts',
        'src/store/game-store.ts',
        'src/components/BuildingPanel.tsx',
        'src/components/DefenseLogPanel.tsx',
        'src/components/LabPanel.tsx',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
    },
  },
})
