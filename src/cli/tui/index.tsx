/**
 * TUI 入口：创建 renderer、挂载 React 根、根据 mode 渲染对应子应用
 */

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './App';
import { MainApp } from './MainApp';

export type TuiMode = 'chat' | 'config' | 'status' | 'init' | 'home';

export interface TuiOptions {
  prompt?: string | undefined;
  interactive?: boolean | undefined;
  key?: string | undefined;
  value?: string | undefined;
  force?: boolean | undefined;
}

/**
 * 启动 TUI。命令层调用此函数并传入 mode 与可选参数。
 * 退出请使用 renderer.destroy()，不要直接 process.exit()。
 */
export async function runTui(mode: TuiMode, options?: TuiOptions): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  const root = createRoot(renderer);

  if (mode === 'home') {
    root.render(<MainApp mode={mode} options={options} />);
  } else {
    root.render(<App mode={mode} options={options} />);
  }
}
