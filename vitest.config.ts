import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false, // 修改为false以避免全局变量污染，需要时手动导入
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], // 明确指定测试文件匹配模式
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
    testTimeout: 5000, // 设置默认测试超时时间
    hookTimeout: 10000, // 设置钩子超时时间
  },
});