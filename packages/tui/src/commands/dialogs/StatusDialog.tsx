import { useDialog } from '../../components/Dialog';
import type { StatusDialogProps } from './types';
import { theme } from '../../theme';

/**
 * 状态信息展示 Dialog
 * 显示 Agent、Gateway 和配置的状态信息
 */
export function StatusDialog({ runtime, config }: StatusDialogProps) {
  const dialog = useDialog();

  // 构建 StatusInfo
  const statusInfo = {
    agentStatus: runtime ? 'running' : 'stopped',
    agentModel: config?.agents.defaults.model || 'unknown',
    agentSession: runtime ? 'active' : 'none',
    gatewayStatus: runtime ? 'connected' : 'disconnected',
    gatewayUrl: runtime ? 'ws://localhost:8080' : null,
    gatewayMessages: 0, // TODO: 从 runtime 获取
    config: {
      theme: 'dark', // TODO: 从 config 获取
      language: 'zh-CN', // TODO: 从 config 获取
    },
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      running: 'Running',
      stopped: 'Stopped',
      error: 'Error',
      connected: 'Connected',
      disconnected: 'Disconnected',
    };
    return statusMap[status] || status;
  };

  return (
    <box gap={1} paddingBottom={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2}>
        <box flexDirection="row" justifyContent="space-between">
          <text>System Status</text>
          <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
            esc
          </text>
        </box>
      </box>

      {/* Agent Runtime */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>
          Agent Runtime
        </text>
        <box paddingLeft={2} paddingTop={1}>
          <text>
            Status: {statusInfo.agentStatus === 'running' ? '✓ ' : '✗ '}
            {formatStatus(statusInfo.agentStatus)}
          </text>
          <text>Model: {statusInfo.agentModel}</text>
          <text>
            Session: {statusInfo.agentSession || 'No active session'}
          </text>
        </box>
      </box>

      {/* Gateway */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>
          Gateway
        </text>
        <box paddingLeft={2} paddingTop={1}>
          <text>
            Status: {statusInfo.gatewayStatus === 'connected' ? '✓ ' : '✗ '}
            {formatStatus(statusInfo.gatewayStatus)}
          </text>
          <text>URL: {statusInfo.gatewayUrl || 'Not connected'}</text>
          <text>Messages: {statusInfo.gatewayMessages}</text>
        </box>
      </box>

      {/* Config */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>
          Config
        </text>
        <box paddingLeft={2} paddingTop={1}>
          <text>Theme: {statusInfo.config.theme}</text>
          <text>Language: {statusInfo.config.language}</text>
        </box>
      </box>
    </box>
  );
}
