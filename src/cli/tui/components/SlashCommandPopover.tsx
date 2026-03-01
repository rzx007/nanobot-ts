import { useState, useRef, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';

/** 斜杠命令选项 */
export interface SlashCommandOption {
  id: string;
  label: string;
  description: string;
}

/** scrollbox 实例：用于滚动到选中项（与 opencode autocomplete moveTo 一致） */
type ScrollboxRefLike = { scrollTop?: number; scrollBy?(delta: number): void } | null;

const POPOVER_MAX_HEIGHT = 10;

export interface SlashCommandPopoverProps {
  options: SlashCommandOption[];
  onSelect: (option: SlashCommandOption) => void;
  onClose: () => void;
}

export function SlashCommandPopover({ options, onSelect, onClose }: SlashCommandPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollboxRef = useRef<ScrollboxRefLike>(null);

  useEffect(() => {
    setSelectedIndex(i => (options.length > 0 ? Math.min(i, options.length - 1) : 0));
  }, [options.length]);

  const moveTo = (next: number) => {
    setSelectedIndex(next);
    const scroll = scrollboxRef.current;
    if (!scroll?.scrollBy || typeof scroll.scrollTop !== 'number') return;
    const viewportHeight = Math.min(POPOVER_MAX_HEIGHT - 2, options.length);
    const scrollBottom = scroll.scrollTop + viewportHeight;
    if (next < scroll.scrollTop) {
      scroll.scrollBy(next - scroll.scrollTop);
    } else if (next + 1 > scrollBottom) {
      scroll.scrollBy(next + 1 - scrollBottom);
    }
  };

  useKeyboard(key => {
    if (options.length === 0) return;
    if (key.name === 'escape') {
      key.preventDefault?.();
      key.stopPropagation?.();
      onClose();
      return;
    }
    if (key.name === 'up') {
      moveTo(Math.max(0, selectedIndex - 1));
      key.preventDefault?.();
      key.stopPropagation?.();
      return;
    }
    if (key.name === 'down') {
      moveTo(Math.min(options.length - 1, selectedIndex + 1));
      key.preventDefault?.();
      key.stopPropagation?.();
      return;
    }
    if ((key.name === 'enter' || key.name === 'return') && !key.shift && !key.meta) {
      const option = options[selectedIndex];
      if (option) {
        key.preventDefault?.();
        key.stopPropagation?.();
        onSelect(option);
      }
    }
  });

  if (options.length === 0) return null;

  return (
    <box
      width="100%"
      height={POPOVER_MAX_HEIGHT}
      backgroundColor={theme.backgroundElement}
      border={['left', 'right']}
      borderColor={theme.border}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      position="absolute"
      top={POPOVER_MAX_HEIGHT * -1}
      left={0}
      right={0}
    >
      <scrollbox
        ref={(r: ScrollboxRefLike) => {
          scrollboxRef.current = r;
        }}
        height={Math.max(1, POPOVER_MAX_HEIGHT - 2)}
      >
        {options.map((option, index) => (
          <box
            key={option.id}
            flexDirection="row"
            justifyContent="space-between"
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={index === selectedIndex ? theme.success : 'transparent'}
          >
            <text fg={index === selectedIndex ? theme.bg : theme.text} flexShrink={0}>
              {option.label}
            </text>
            <text fg={index === selectedIndex ? theme.bg : theme.textMuted} wrapMode="none">
              {option.description}
            </text>
          </box>
        ))}
      </scrollbox>
    </box>
  );
}
