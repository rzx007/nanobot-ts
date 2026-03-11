import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { useDialog } from '../../components/Dialog';
import type { McpDialogProps, McpInfo } from './types';

/**
 * MCP 配置切换 Dialog
 * 支持启用/禁用 MCP 服务
 */
export function McpDialog({
  mcps,
  onToggleMcp,
  onApplyChanges,
  onClose,
}: McpDialogProps) {
  const dialog = useDialog();
  const [selectedIndex, setSelectedIndex] = useState(0);
  // 本地状态，存储启用/禁用状态
  const [localMcps, setLocalMcps] = useState<McpInfo[]>(mcps);

  // 切换 MCP 启用状态
  const toggleMcp = (index: number) => {
    const mcp = localMcps[index];
    if (!mcp) return;
    const newState = !mcp.enabled;
    setLocalMcps(prev =>
      prev.map((m, i) => (i === index ? { ...m, enabled: newState } : m))
    );
    onToggleMcp(mcp.id, newState);
  };

  // 应用更改
  const applyChanges = () => {
    const enabledMcps = localMcps.filter(m => m.enabled).map(m => m.id);
    onApplyChanges(enabledMcps);
    dialog.clear();
    onClose?.();
  };

  // 键盘导航
  useKeyboard(evt => {

    if (evt.name === 'up' || (evt.ctrl && evt.name === 'p')) {
      setSelectedIndex(i => Math.max(0, i - 1));
      evt.preventDefault();
      return;
    }
    if (evt.name === 'down' || (evt.ctrl && evt.name === 'n')) {
      setSelectedIndex(i => Math.min(localMcps.length - 1, i + 1));
      evt.preventDefault();
      return;
    }
    if (evt.name === 'space') {
      evt.preventDefault();
      toggleMcp(selectedIndex);
      return;
    }
    if (evt.name === 'return') {
      evt.preventDefault();
      applyChanges();
      return;
    }
  });

  return (
    <box gap={1} paddingBottom={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2}>
        <box flexDirection="row" justifyContent="space-between">
          <text>Toggle MCPs</text>
          <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
            esc
          </text>
        </box>
      </box>

      {/* MCP List */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg="#e94560">
          Available MCPs
        </text>
      </box>

      {localMcps.length === 0 ? (
        <box paddingLeft={2}>
          <text fg="#a0a0a0">No MCPs configured</text>
        </box>
      ) : (
        <box paddingLeft={2} paddingRight={2}>
          {localMcps.map((mcp, index) => (
            <box
              key={mcp.id}
              flexDirection="row"
              padding={0.5}
              backgroundColor={index === selectedIndex ? '#e94560' : 'transparent'}
              onMouseDown={() => setSelectedIndex(index)}
              onMouseUp={evt => {
                evt.stopPropagation();
                toggleMcp(index);
              }}
            >
              <text>
                {index === selectedIndex ? '> ' : '  '}
                [{mcp.enabled ? '✓' : ' '}] {mcp.id}
              </text>
            </box>
          ))}
          {localMcps.map((mcp) => (
            <box
              key={`desc-${mcp.id}`}
              paddingLeft={6}
              paddingBottom={0.5}
            >
              <text fg="#a0a0a0">{mcp.description}</text>
            </box>
          ))}
        </box>
      )}

      {/* Footer */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg="#a0a0a0">
          Use ↑↓ to navigate, Space to toggle, Enter to apply
        </text>
      </box>
    </box>
  );
}
