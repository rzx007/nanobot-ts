/// <reference types="bun-types" />

export async function build(): Promise<void> {
  const buildResult = await Bun.build({
    entrypoints: ['./src/index.ts', './src/cli/run.ts', './src/cli/index.ts'],
    outdir: './dist',
    target: 'bun',
    format: 'esm',
    sourcemap: true,
    minify: false,
    external: [
      'cheerio',
      'execa',
      'baileys',
      'imapflow',
      'nodemailer',
      '@larksuiteoapi/node-sdk',
      '@modelcontextprotocol/sdk',
    ],
    splitting: false,
    root: './src',
  });

  if (buildResult.logs.length > 0) {
    console.error('Build failed:');
    for (const log of buildResult.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console -- build script
  console.log('✅ Build completed successfully!');
}

if (import.meta.main) {
  build();
}
