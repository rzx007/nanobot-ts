import type { ReactNode } from 'react';
import { theme } from '../theme';

interface LayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Layout({ title, children, footer }: LayoutProps) {
  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.bg}>
      {title ? (
        <box
          border
          borderStyle="single"
          borderColor={theme.border}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={0}
          paddingBottom={0}
        >
          <text fg={theme.accent}>{title}</text>
        </box>
      ) : null}
      <box flexGrow={1} flexDirection="column" padding={1}>
        {children}
      </box>
      {footer != null ? (
        <box width="100%" alignItems="center">
          {footer}
        </box>
      ) : null}
    </box>
  );
}
