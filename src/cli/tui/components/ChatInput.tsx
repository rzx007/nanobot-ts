import { useState, useImperativeHandle, forwardRef, useRef, useMemo, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import "opentui-spinner/react"
import { theme } from '../theme';
import { EmptyBorder } from './Border';
import { loadConfig } from '@/config/loader';
import { SlashCommandPopover, type SlashCommandOption } from './SlashCommandPopover';
import { createColors, createFrames } from './spinner';

/** opentui textarea 实例：与 opencode 一致用 ref + onContentChange 非受控 */
type TextareaRef = { plainText: string; clear(): void };

export type { SlashCommandOption };

export const SLASH_COMMANDS: SlashCommandOption[] = [
  { id: 'help', label: '/help', description: 'Help' },
  { id: 'init', label: '/init', description: 'create/update AGENTS.md' },
  { id: 'mcps', label: '/mcps', description: 'Toggle MCPs' },
  { id: 'models', label: '/models', description: 'Switch model' },
  { id: 'new', label: '/new', description: 'New session' },
  {
    id: 'review',
    label: '/review',
    description: 'review changes [commit|branch|pr], defaults to uncommitted',
  },
  { id: 'sessions', label: '/sessions', description: 'Switch session' },
  { id: 'skills', label: '/skills', description: 'Skills' },
  { id: 'status', label: '/status', description: 'View status' },
  { id: 'themes', label: '/themes', description: 'Switch theme' },
];

/** 与 opencode textarea-keybindings 一致：Enter 提交，Shift+Enter / Meta+Enter 换行 */
const CHAT_TEXTAREA_KEYBINDINGS = [
  { name: 'return', action: 'submit' as const },
  { name: 'return', shift: true, action: 'newline' as const },
  { name: 'return', meta: true, action: 'newline' as const },
] as const;

export interface ChatInputHandle {
  getValue: () => string;
  submit: () => void;
}

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  status?: 'idle' | 'responding' ;
  onSlashCommand?: (commandId: string) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSubmit, disabled = false, placeholder = 'Ask anything...', onSlashCommand, status = 'idle' },
  ref,
) {
  const [currentModel, setCurrentModel] = useState<string>('');
  const [value, setValue] = useState('');
  const textareaRef = useRef<TextareaRef | null>(null);

  const slashOpen = value === '/' || value.startsWith('/');
  const query = slashOpen ? value.slice(1).toLowerCase() : '';
  const filtered = useMemo(() => {
    if (!slashOpen) return [];
    if (!query) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      c => c.id.toLowerCase().startsWith(query) || c.label.toLowerCase().startsWith('/' + query),
    );
  }, [slashOpen, query]);

  useEffect(() => {
    (async () => {
      const config = await loadConfig();
      if (config) {
        setCurrentModel(config.agents.defaults.model);
      }
    })();
  }, []);

  const closeSlashAndClear = () => {
    textareaRef.current?.clear();
    setValue('');
  };

  const handleSubmit = () => {
    const text = textareaRef.current?.plainText ?? value;
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      textareaRef.current?.clear();
      setValue('');
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => textareaRef.current?.plainText ?? value,
      submit: handleSubmit,
    }),
    [value, disabled],
  );

  useKeyboard(key => {
    if (slashOpen && filtered.length > 0) return;
    if (slashOpen && key.name === 'escape') {
      key.preventDefault?.();
      key.stopPropagation?.();
      closeSlashAndClear();
      return;
    }
    if ((key.name === 'enter' || key.name === 'return') && !key.shift && !key.meta) {
      handleSubmit();
    }
  });

  const keyBindings = useMemo(() => [...CHAT_TEXTAREA_KEYBINDINGS], []);

  const highlight = useMemo(() => {
    return theme.primary;
  }, []);

  
  const spinnerDef = useMemo(() => {
    const color = theme.primary;
    return {
      frames: createFrames({
        color,
        style: "blocks",
        inactiveFactor: 0.6,
        // enableFading: false,
        minAlpha: 0.3,
      }),
      color: createColors({
        color,
        style: "blocks",
        inactiveFactor: 0.6,
        // enableFading: false,
        minAlpha: 0.3,
      }),
    }
  }, []);

  return (
    <box flexDirection="column" width="100%" position="relative">
      {slashOpen && filtered.length > 0 && (
        <SlashCommandPopover
          options={filtered}
          onSelect={(option: SlashCommandOption) => {
            onSlashCommand?.(option.id);
            closeSlashAndClear();
          }}
          onClose={closeSlashAndClear}
        />
      )}
      {/* 左侧指示条：opencode 为 border left + customBorderChars "┃"，此处用 1 单位色条模拟 */}
      <box
        border={['left']}
        borderColor={highlight}
        customBorderChars={{
          ...EmptyBorder,
          vertical: '┃',
          bottomLeft: '╹',
        }}
      >
        <box width="100%" backgroundColor={theme.backgroundElement}>
          <box
            flexGrow={1}
            flexShrink={0}
            minHeight={3}
            alignItems="center"
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            backgroundColor={theme.backgroundElement}
          >
            <textarea
              {...({
                ref: (r: TextareaRef | null) => {
                  textareaRef.current = r;
                },
                placeholder,
                focused: !disabled,
                width: '100%',
                minHeight: 1,
                maxHeight: 6,
                alignSelf: 'center',
                textColor: theme.text,
                focusedTextColor: theme.text,
                placeholderColor: theme.textMuted,
                backgroundColor: 'transparent',
                focusedBackgroundColor: theme.backgroundElement,
                cursorColor: theme.text,
                keyBindings,
                onContentChange: () => {
                  const v = textareaRef.current?.plainText ?? '';
                  setValue(v);
                },
                onSubmit: handleSubmit,
                onMouseDown: (e: { target?: { focus?: () => void } }) => e.target?.focus?.(),
              } as unknown as Record<string, unknown>)}
            />
          </box>
          {/* 底部提示 */}
          <box width="100%" paddingLeft={2} paddingRight={2} paddingBottom={1}>
            <box flexDirection="row" gap={2}>
              {currentModel ? (
                <text fg={theme.primary}>
                  Cli <span fg={theme.text}>{currentModel.split(':')[1]}</span>
                </text>
              ) : null}
            </box>
          </box>
        </box>
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingTop={1}>
        <box flexDirection="row"><spinner color={spinnerDef.color} frames={spinnerDef.frames} interval={40} visible={status === 'responding'} /></box>
        <box flexDirection="row" >
          <text fg={theme.textMuted}>
            <span fg={theme.warn}>Ctrl+P</span> commands
          </text>
          <text fg={theme.textMuted}> </text>
          <text fg={theme.textMuted}>
            <span fg={theme.warn}>Enter</span> to send
          </text>
        </box>
      </box>
    </box>
  );
});
