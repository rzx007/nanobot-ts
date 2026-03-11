/**
 * CLI 构建配置
 * 将 @opentui/* 标为 external，运行时从 node_modules 解析，避免打包后找不到 @opentui/core-win32-x64 等平台包
 */

/// <reference types="bun-types" />


async function build() {
  const result = await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    minify: false,
    external: [
      "react", 
      "@opentui/core",
      "@opentui/react",
    ],
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  build();
}

export { build };
