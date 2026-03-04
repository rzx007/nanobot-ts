import { useState, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { useDialog } from '../../components/Dialog';

/**
 * 技能搜索对话框参数
 */
export interface SkillFindDialogProps {
  onSearch: (
    query: string,
  ) => Promise<
    Array<{ name: string; description: string; version?: string; author?: string; files: string[] }>
  >;
  onInstall: (skill: any, baseUrl: string) => Promise<boolean>;
}

/**
 * 创建技能搜索对话框
 */
export function createSkillFindDialog({ onSearch, onInstall }: SkillFindDialogProps) {
  const dialog = useDialog();
  const [results, setResults] = useState<Array<any>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // 执行搜索（默认搜索所有技能）
  useEffect(() => {
    setIsSearching(true);
    onSearch('')
      .then(searchResults => {
        setResults(searchResults);
        setSelectedIndex(0);
        setIsSearching(false);
      })
      .catch(() => {
        setResults([]);
        setIsSearching(false);
      });
  }, [onSearch]);

  const installSkill = async (skill: any) => {
    setIsInstalling(true);
    try {
      const success = await onInstall(skill, 'https://skills.opencode.ai/');
      if (success) {
        dialog.clear();
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  useKeyboard(evt => {
    if (evt.name === 'escape') {
      evt.preventDefault();
      dialog.clear();
      return;
    }
    if (evt.name === 'up' || (evt.ctrl && evt.name === 'p')) {
      setSelectedIndex(i => Math.max(0, i - 1));
      evt.preventDefault();
      return;
    }
    if (evt.name === 'down' || (evt.ctrl && evt.name === 'n')) {
      setSelectedIndex(i => Math.min(results.length - 1, i + 1));
      evt.preventDefault();
      return;
    }
    if (evt.name === 'return') {
      evt.preventDefault();
      if (selectedIndex < results.length) {
        installSkill(results[selectedIndex]);
      }
      return;
    }
  });

  return {
    element: (
      <box gap={1} paddingBottom={1}>
        {/* Header */}
        <box paddingLeft={2} paddingRight={2}>
          <box flexDirection="row" justifyContent="space-between">
            <text>Search Skills</text>
            <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
              esc
            </text>
          </box>
        </box>

        {/* Search Results */}
        <box paddingLeft={2} paddingRight={2}>
          {isSearching ? (
            <text fg="#a0a0a0">Searching...</text>
          ) : results.length === 0 ? (
            <text fg="#a0a0a0">No skills found</text>
          ) : (
            results.map((skill, index) => (
              <box
                key={skill.name}
                flexDirection="column"
                padding={0.5}
                backgroundColor={index === selectedIndex ? '#e94560' : 'transparent'}
                onMouseDown={() => setSelectedIndex(index)}
                onMouseUp={evt => {
                  evt.stopPropagation();
                  installSkill(skill);
                }}
              >
                <text>
                  {index === selectedIndex ? '> ' : '  '}
                  {skill.name}
                  {skill.version ? ` (${skill.version})` : ''}
                  {skill.author && ` by ${skill.author}`}
                </text>
                <text fg="#a0a0a0" paddingLeft={2}>
                  {skill.description}
                </text>
              </box>
            ))
          )}
        </box>

        {/* Footer */}
        <box paddingLeft={2} paddingRight={2}>
          <text fg="#a0a0a0">↑↓ Navigate • Enter Install • Esc Close</text>
        </box>

        {/* Installing Status */}
        {isInstalling && (
          <box paddingLeft={2} paddingRight={2}>
            <text fg="#00ff00">Installing skill...</text>
          </box>
        )}
      </box>
    ),
    onClose: () => dialog.clear(),
  };
}
