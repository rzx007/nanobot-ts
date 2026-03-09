/// <reference types="bun-types" />

export async function build(): Promise<void> {
  const external = [
    'cheerio',
    'execa',
    'baileys',
    'imapflow',
    'nodemailer',
    '@larksuiteoapi/node-sdk',
    '@modelcontextprotocol/sdk',
    'winston',
    'fs-extra',
  ];

  // 构建顺序：先构建基础包，再构建依赖它们的包
  const buildOrder = [
    'shared',
    'logger',
    'utils',
    'main',
    'providers',
    'tools',
    'channels',
    'skills',
    'mcp',
    'cli',
    'tui',
    'server',
  ];

  // 构建每个包
  for (const pkg of buildOrder) {
    const entrypoint = `./packages/${pkg}/src/index.ts`;
    const outdir = `./packages/${pkg}/dist`;

    // 对于需要使用 workspace 包的包，添加特定的 external 配置
    let pkgExternal = [...external];
    if (pkg === 'mcp' || pkg === 'cli' || pkg === 'tui' || pkg === 'server') {
      pkgExternal = [
        ...external,
        '@nanobot/shared',
        '@nanobot/logger',
        '@nanobot/utils',
        '@nanobot/main',
        '@nanobot/main/bus',
        '@nanobot/main/core',
        '@nanobot/main/subagent',
        '@nanobot/providers',
        '@nanobot/tools',
        '@nanobot/channels',
        '@nanobot/skills',
        '@nanobot/mcp',
        '@nanobot/cli',
        '@nanobot/server',
      ];
    }

    try {
      const buildResult = await Bun.build({
        entrypoints: [entrypoint],
        outdir,
        target: 'bun',
        format: 'esm',
        sourcemap: true,
        minify: false,
        external: pkgExternal,
        splitting: false,
        root: './',
      });

      if (buildResult.logs.length > 0) {
        console.error(`❌ Build failed for ${pkg}:`);
        for (const log of buildResult.logs) {
          console.error(log);
        }
        process.exit(1);
      }

      console.log(`✅ Built ${pkg}`);
    } catch (error) {
      console.error(`❌ Build failed for ${pkg}:`, error);
      process.exit(1);
    }
  }

  console.log('✅ All packages built successfully!');
}

if (import.meta.main) {
  build();
}
