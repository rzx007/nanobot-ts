import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    fileParallelism: false, // 禁用文件并行
    maxConcurrency: 1, // 串行运行测试
    coverage: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/templates/**',
        '**/tests/**',
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**',
        '**/coverage/**',
        '**/docs/**',
        '**/.git/**',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/pnpm-lock.yaml',
      ],
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 30000,
  },
});
