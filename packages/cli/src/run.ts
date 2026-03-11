/**
 * CLI 可执行入口 (bin)
 * 供 package.json "bin" 指向，直接调用 runCLI
 */

import { runCLI } from './commands';


runCLI(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
