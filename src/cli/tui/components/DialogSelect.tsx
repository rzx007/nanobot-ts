import { useState, useMemo, useRef } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { useDialog } from './Dialog';

export interface DialogSelectOption<T = string> {
  title: string;
  value: T;
  description?: string;
  footer?: string;
  category?: string;
  disabled?: boolean;
  onSelect?: (option: DialogSelectOption<T>) => void;
}

export interface DialogSelectProps<T = string> {
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  flat?: boolean;
  onFilter?: (query: string) => void;
  onSelect?: (option: DialogSelectOption<T>) => void;
}

export function DialogSelect<T = string>(props: DialogSelectProps<T>) {
  const dialog = useDialog();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<{ focus: () => void } | null>(null);

  const filtered = useMemo(() => {
    if (!filter) return props.options.filter(x => !x.disabled);
    const lowerFilter = filter.toLowerCase();
    return props.options.filter(x => {
      if (x.disabled) return false;
      return (
        x.title.toLowerCase().includes(lowerFilter) ||
        (typeof x.value === 'string' && x.value.toLowerCase().includes(lowerFilter))
      );
    });
  }, [props.options, filter]);

  const dimensions = useTerminalDimensions();
  const maxHeight = Math.floor((dimensions.height - 10) / 2);

  const moveUp = () => {
    setSelectedIndex(i => Math.max(0, i - 1));
  };

  const moveDown = () => {
    setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
  };

  const moveToStart = () => {
    setSelectedIndex(0);
  };

  const moveToEnd = () => {
    setSelectedIndex(filtered.length - 1);
  };

  useKeyboard(evt => {
    if (evt.name === 'up' || (evt.ctrl && evt.name === 'p')) {
      moveUp();
      return;
    }
    if (evt.name === 'down' || (evt.ctrl && evt.name === 'n')) {
      moveDown();
      return;
    }
    if (evt.name === 'pageup') {
      setSelectedIndex(i => Math.max(0, i - 10));
      return;
    }
    if (evt.name === 'pagedown') {
      setSelectedIndex(i => Math.min(filtered.length - 1, i + 10));
      return;
    }
    if (evt.name === 'home') {
      moveToStart();
      return;
    }
    if (evt.name === 'end') {
      moveToEnd();
      return;
    }
    if (evt.name === 'return') {
      const option = filtered[selectedIndex];
      if (option) {
        evt.preventDefault();
        evt.stopPropagation();
        dialog.clear();
        option.onSelect?.(option);
        props.onSelect?.(option);
      }
    }
  });

  return (
    <box gap={1} paddingBottom={1}>
      <box paddingLeft={2} paddingRight={2}>
        <box flexDirection="row" justifyContent="space-between">
          <text>Command Palette</text>
          <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
            esc
          </text>
        </box>
        <box paddingTop={1}>
          <input
            ref={r => {
              inputRef.current = r as unknown as { focus: () => void } | null;
              setTimeout(() => {
                const input = inputRef.current;
                if (!input) return;
                if ('isDestroyed' in input && input.isDestroyed) return;
                input.focus();
              }, 1);
            }}
            value={filter}
            onChange={setFilter}
            placeholder={props.placeholder ?? 'Search...'}
            width="100%"
          />
        </box>
      </box>
      {filtered.length === 0 ? (
        <box paddingLeft={2}>
          <text>No commands found</text>
        </box>
      ) : (
        <box paddingLeft={2} paddingRight={2} maxHeight={maxHeight} overflow="hidden">
          {filtered.map((option, index) => (
            <box
              key={String(option.value)}
              flexDirection="row"
              justifyContent="space-between"
              padding={0.5}
              backgroundColor={index === selectedIndex ? '#e94560' : 'transparent'}
              onMouseDown={() => setSelectedIndex(index)}
            >
              <text>
                {index === selectedIndex ? '> ' : '  '}
                {option.title}
              </text>
              <text fg={index === selectedIndex ? '#1a1a2e' : '#a0a0a0'}>
                {option.description || String(option.value)}
              </text>
            </box>
          ))}
        </box>
      )}
    </box>
  );
}
