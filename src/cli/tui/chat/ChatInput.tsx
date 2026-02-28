import { useState, useImperativeHandle, forwardRef } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';

export interface ChatInputHandle {
  getValue: () => string;
  submit: () => void;
}

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSubmit, disabled = false, placeholder = 'Type a message...' },
  ref,
) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setValue('');
    }
  };

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    submit: handleSubmit,
  }), [value, disabled]);

  useKeyboard((key) => {
    if (key.name === 'enter' || key.name === 'return') {
      handleSubmit();
    }
  });

  return (
    <box flexDirection="row" width="100%" gap={1} alignItems="center">
      <box flexGrow={1} minWidth={10}>
        <input
          value={value}
          onChange={setValue}
          placeholder={placeholder}
          focused={!disabled}
          width="100%"
          backgroundColor={theme.bgSecondary}
          textColor={theme.text}
          placeholderColor={theme.textMuted}
        />
      </box>
      <box
        focusable
        border
        borderStyle="single"
        borderColor={theme.accent}
        backgroundColor={theme.bgSecondary}
        paddingX={2}
        width={12}
        minWidth={12}
        onMouseDown={() => handleSubmit()}
      >
        <text fg={theme.accent}>Send</text>
      </box>
    </box>
  );
});
