import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'node18',
  external: ['pino', 'pino-pretty', 'cheerio', 'execa'],
  treeshake: true,
  minify: false,
});
