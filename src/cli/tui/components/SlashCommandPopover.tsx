import { useState, useRef, useEffect, useMemo } from 'react';
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

const POPOVER_MAX_HEIGHT = 11;

export interface SlashCommandPopoverProps {
  options: SlashCommandOption[];
  onSelect: (option: SlashCommandOption) => void;
  onClose: () => void;
  searchQuery?: string; // 新增：接收来自 ChatInput 的搜索查询
}

export function SlashCommandPopover({ options, onSelect, onClose, searchQuery = '' }: SlashCommandPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollboxRef = useRef<ScrollboxRefLike>(null);

  // 根据搜索查询过滤命令
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(query) ||
      option.id.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // 重置选中索引到第一个可见项
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredOptions.length]);

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
    // Escape 关闭 Popover
    if (key.name === 'escape') {
      key.preventDefault?.();
      key.stopPropagation?.();
      onClose();
      return;
    }

    // 上下选择
    if (filteredOptions.length === 0) return;
    if (key.name === 'up') {
      moveTo(Math.max(0, selectedIndex - 1));
      key.preventDefault?.();
      key.stopPropagation?.();
      return;
    }
    if (key.name === 'down') {
      moveTo(Math.min(filteredOptions.length - 1, selectedIndex + 1));
      key.preventDefault?.();
      key.stopPropagation?.();
      return;
    }

    // 回车选中
    if ((key.name === 'enter' || key.name === 'return') && !key.shift && !key.meta) {
      const option = filteredOptions[selectedIndex];
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
      {/* 命令列表 */}
      <scrollbox
        ref={(r: ScrollboxRefLike) => {
          scrollboxRef.current = r;
        }}
        height={Math.max(1, POPOVER_MAX_HEIGHT - 2)}
      >
        {filteredOptions.length === 0 ? (
          <box paddingLeft={1} paddingTop={1}>
            <text fg={theme.textMuted}>No results</text>
          </box>
        ) : (
          filteredOptions.map((option, index) => (
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
          ))
        )}
      </scrollbox>
    </box>
  );
}
