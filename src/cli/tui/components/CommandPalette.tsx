import { useState, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';

interface Command {
  id: string;
  label: string;
  shortcut: string;
}

interface CommandPaletteProps {
  onClose: () => void;
  onSelect: (commandId: string) => void;
}

const commands: Command[] = [
  { id: 'new-chat', label: '新建聊天', shortcut: 'Ctrl+N' },
  { id: 'view-status', label: '查看状态', shortcut: 'Ctrl+S' },
  { id: 'view-config', label: '查看配置', shortcut: 'Ctrl+C' },
  { id: 'exit', label: '退出应用', shortcut: 'Ctrl+Q' },
];

export function CommandPalette({ onClose, onSelect }: CommandPaletteProps) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter(
    cmd =>
      cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.id.toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const handleSelect = () => {
    if (filteredCommands[selectedIndex]) {
      onSelect(filteredCommands[selectedIndex].id);
    }
  };

  useKeyboard(key => {
    if (key.name === 'escape') {
      onClose();
      return;
    }

    if (key.name === 'enter' || key.name === 'return') {
      handleSelect();
      return;
    }

    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }

    if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex(i => Math.min(filteredCommands.length - 1, i + 1));
      return;
    }
  });

  return (
    <box
      border
      borderStyle="double"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={1}
      width={60}
      minHeight={20}
      flexDirection="column"
    >
      <box border borderStyle="single" borderColor={theme.border} padding={1} marginBottom={1}>
        <input
          value={filter}
          onChange={setFilter}
          placeholder="搜索命令..."
          focused
          width="100%"
          backgroundColor={theme.bgSecondary}
          textColor={theme.text}
          placeholderColor={theme.textMuted}
        />
      </box>

      {filteredCommands.length === 0 ? (
        <box padding={1}>
          <text fg={theme.textMuted}>没有找到匹配的命令</text>
        </box>
      ) : (
        <box flexDirection="column">
          {filteredCommands.map((cmd, index) => (
            <box
              key={cmd.id}
              flexDirection="row"
              justifyContent="space-between"
              paddingX={1}
              paddingY={0.5}
              backgroundColor={index === selectedIndex ? theme.accent : 'transparent'}
            >
              <text fg={index === selectedIndex ? theme.bg : theme.text}>
                {index === selectedIndex ? '> ' : '  '}
                {cmd.label}
              </text>
              <text fg={index === selectedIndex ? theme.bg : theme.textMuted}>{cmd.shortcut}</text>
            </box>
          ))}
        </box>
      )}

      <box marginTop={1} paddingTop={1} border borderStyle="single" borderColor={theme.border}>
        <text fg={theme.textMuted}>
          <span fg={theme.accent}>↑↓</span> 选择 · <span fg={theme.accent}>Enter</span> 执行 ·{' '}
          <span fg={theme.accent}>Esc</span> 关闭
        </text>
      </box>
    </box>
  );
}
