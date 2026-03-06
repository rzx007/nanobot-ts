import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { useDialog } from '../../components/Dialog';
import type { SkillsDialogProps } from './types';
import { theme } from '../../theme';

/**
 * 技能查看 Dialog
 * 显示已安装的技能，支持选择
 */
export function SkillsDialog({ skills, onSelectSkill, onRefresh }: SkillsDialogProps) {
  const dialog = useDialog();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectSkill = (index: number) => {
    if (!skills || skills.length === 0) return;

    const skill = skills[index];
    if (!skill) return;

    try {
      onSelectSkill(skill.id);
      dialog.clear();
    } catch (error) {
      console.error('Error selecting skill:', error);
    }
  };

  const refresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  useKeyboard(evt => {
    if (evt.name === 'up' || (evt.ctrl && evt.name === 'p')) {
      setSelectedIndex(i => Math.max(0, i - 1));
      evt.preventDefault();
      return;
    }
    if (evt.name === 'down' || (evt.ctrl && evt.name === 'n')) {
      setSelectedIndex(i => Math.min(skills.length - 1, i + 1));
      evt.preventDefault();
      return;
    }
    if (evt.name === 'return') {
      evt.preventDefault();
      evt.stopPropagation();
      selectSkill(selectedIndex);
      return;
    }
    if (evt.name === 'r' && onRefresh) {
      evt.preventDefault();
      evt.stopPropagation();
      refresh();
      return;
    }
  });

  const totalCount = skills.length;

  return (
    <box gap={1} paddingBottom={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2}>
        <box flexDirection="row" justifyContent="space-between">
          <text>Skills</text>
          <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
            esc
          </text>
        </box>
      </box>

      {/* Skills List */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg="#e94560">Installed Skills ({totalCount})</text>
      </box>

      {skills.length === 0 ? (
        <box paddingLeft={2}>
          <text fg="#a0a0a0">No skills installed</text>
          <box paddingTop={1}>
            <text fg="#a0a0a0">Run "npx skills find" to discover skills</text>
          </box>
        </box>
      ) : (
        <box paddingLeft={2} paddingRight={2}>
          {skills.map((skill, index) => (
            <box
              key={skill.id}
              flexDirection="row"
              backgroundColor={index === selectedIndex ? theme.success : 'transparent'}
              onMouseDown={() => setSelectedIndex(index)}
              onMouseUp={evt => {
                evt.stopPropagation();
                selectSkill(index);
              }}
            >
              <text>
                {index === selectedIndex ? '> ' : '  '}
                {skill.id}
                {skill.version ? ` (${skill.version})` : ''}
              </text>
            </box>
          ))}
        </box>
      )}

      {/* Footer */}
      {skills.length > 0 && (
        <box paddingLeft={2} paddingRight={2}>
          <text fg="#a0a0a0">↑↓ Navigate • Enter Select • R Refresh • Esc Close</text>
        </box>
      )}
    </box>
  );
}
