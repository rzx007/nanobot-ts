import { useDialog } from './Dialog';
import { DialogSelect, type DialogSelectOption } from './DialogSelect';
import { useEffect } from 'react';

interface CommandPaletteProps {
  onClose?: () => void;
  onSelect?: (commandId: string) => void;
}

const commands: DialogSelectOption<string>[] = [
  { value: 'new-chat', title: '新建聊天', description: 'Ctrl+N', category: 'Chat' },
  { value: 'view-status', title: '查看状态', description: 'Ctrl+S', category: 'System' },
  { value: 'view-config', title: '查看配置', description: 'Ctrl+C', category: 'System' },
  { value: 'exit', title: '退出应用', description: 'Ctrl+Q', category: 'System' },
];

export function CommandPalette({ onClose, onSelect }: CommandPaletteProps) {
  const dialog = useDialog();

  const handleSelect = (option: DialogSelectOption<string>) => {
    dialog.clear();
    onClose?.();
    onSelect?.(option.value);
  };

  const element = (
    <DialogSelect
      title="Commands"
      placeholder="Search commands..."
      options={commands}
      onSelect={handleSelect}
    />
  );

  useEffect(() => {
    dialog.replace(element, () => onClose?.());
  }, [dialog, onClose]);

  return null;
}
