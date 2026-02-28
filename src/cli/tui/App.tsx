import type { TuiOptions } from './index';
import { ChatApp } from './chat';
import { ConfigApp } from './config';
import { StatusApp } from './status';
import { InitWizard } from './init';

type AppMode = 'chat' | 'config' | 'status' | 'init';

export function App({
  mode,
  options,
}: {
  mode: AppMode;
  options?: TuiOptions | undefined;
}) {
  switch (mode) {
    case 'chat':
      return (
        <ChatApp
          prompt={options?.prompt}
          interactive={options?.interactive ?? false}
        />
      );
    case 'config':
      return (
        <ConfigApp
          keyOption={options?.key}
          valueOption={options?.value}
        />
      );
    case 'status':
      return <StatusApp />;
    case 'init':
      return <InitWizard force={options?.force ?? false} />;
    default:
      return (
        <box padding={2}>
          <text>Unknown mode: {String(mode)}</text>
        </box>
      );
  }
}
