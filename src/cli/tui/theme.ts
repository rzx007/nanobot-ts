/**
 * TUI 主题配置
 */

export const theme = {
  bg: '#1a1a2e',
  bgSecondary: '#16213e',
  border: '#0f3460',
  text: '#e8e8e8',
  textMuted: '#a0a0a0',
  accent: '#e94560',
  success: '#4ecca3',
  error: '#e94560',
  warn: '#ffc93c',
} as const;

export type Theme = typeof theme;
