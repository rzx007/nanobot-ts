/**
 * 单条消息内容：使用 OpenTUI 的 markdown 组件渲染，支持代码高亮等。
 * 供 MessageList 使用。
 * @see https://opentui.com/docs/components/markdown/
 */
import { SyntaxStyle, RGBA } from '@opentui/core';
import { theme } from '../theme';

interface MessageContentProps {
  content: string;
  /** 为 true 时隐藏 markdown 语法符号，只显示渲染结果（默认 true） */
  conceal?: boolean;
}

const defaultSyntaxStyle = SyntaxStyle.fromStyles({
  'markup.heading.1': { fg: RGBA.fromHex(theme.accent), bold: true },
  'markup.heading.2': { fg: RGBA.fromHex(theme.primary), bold: true },
  'markup.list': { fg: RGBA.fromHex(theme.textMuted) },
  'markup.raw': { fg: RGBA.fromHex(theme.primary) },
  default: { fg: RGBA.fromHex(theme.text) },
});

export function MessageContent({ content, conceal = true }: MessageContentProps) {
  if (!content.trim()) {
    return null;
  }
  return (
    <markdown
      content={content}
      syntaxStyle={defaultSyntaxStyle}
      conceal={conceal}
    />
  );
}
