import { theme } from '../theme';

interface ConfigEditorProps {
  content: string;
  readOnly?: boolean;
}

export function ConfigEditor({ content }: ConfigEditorProps) {
  return (
    <scrollbox flexGrow={1} flexDirection="column">
      <text fg={theme.text}>{content}</text>
    </scrollbox>
  );
}
