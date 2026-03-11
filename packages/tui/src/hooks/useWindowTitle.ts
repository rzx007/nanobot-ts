import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

/**
 * 动态设置终端窗口标题
 * 使用 opentui 的 renderer.setTerminalTitle() 方法
 */
export function useWindowTitle(title: string) {
  const { renderer } = useAppContext();

  useEffect(() => {
    if (!renderer) return;

    // 使用 opentui 的 setTerminalTitle 方法
    renderer.setTerminalTitle(title);
  }, [title, renderer]);
}
