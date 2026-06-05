import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))

export default {
  root,
  test: {
    environment: 'node',
    globals: true,
    include: ['lib/convex/**/*.test.ts'],
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': root,
    },
  },
}
