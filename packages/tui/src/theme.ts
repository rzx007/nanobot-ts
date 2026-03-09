/**
 * TUI 主题配置
 */
export const theme = {
  primary: '#5ea500',
  bg: '#0e0e0e',
  bgSecondary: '#16213e',
  backgroundElement: '#1c1c1c',
  border: '#ffffff26',
  text: '#e8e8e8',
  textMuted: '#a0a0a0',
  textSecondary: '#606060',
  /** 更淡，用于说明/备注，视觉上像小字 */
  textTertiary: '#404040',
  accent: '#e94560',
  success: '#4ecca3',
  error: '#e94560',
  warn: '#ffc93c',
} as const;

export type Theme = typeof theme;
