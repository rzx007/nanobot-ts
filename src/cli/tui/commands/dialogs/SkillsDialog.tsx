import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { useDialog } from '../../components/Dialog';
import type { SkillsDialogProps } from './types';
import { theme } from '../../theme';

/**
 * 技能查看 Dialog
 * 显示已安装的技能及其状态
 */
export function SkillsDialog({
  skills,
  onToggleSkill,
  onViewDetails,
  onUseSkill,
  onRefresh,
}: SkillsDialogProps) {
  const dialog = useDialog();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 切换技能启用状态
  const toggleSkill = (index: number) => {
    const skill = skills[index];
    if (!skill) return;
    const newState = !skill.enabled;
    onToggleSkill(skill.id, newState);
  };

  // 查看技能详情
  const viewDetails = () => {
    const skill = skills[selectedIndex];
    if (skill && onViewDetails) {
      onViewDetails(skill.id);
    }
  };

  // 使用技能
  const useSkill = () => {
    const skill = skills[selectedIndex];
    if (skill && onUseSkill) {
      onUseSkill(skill.id);
    }
  };

  // 刷新技能列表
  const refresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // 键盘导航
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
    if (evt.name === 'space') {
      evt.preventDefault();
      toggleSkill(selectedIndex);
      return;
    }
    if (evt.name === 'return') {
      evt.preventDefault();
      if (evt.shift && onUseSkill) {
        useSkill();
      } else if (onViewDetails) {
        viewDetails();
      }
      return;
    }
    if (evt.name === 'r' && onRefresh) {
      evt.preventDefault();
      refresh();
      return;
    }
  });

  const enabledCount = skills.filter(s => s.enabled).length;
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
        <text fg="#e94560">
          Installed Skills ({enabledCount}/{totalCount})
        </text>
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
                toggleSkill(index);
              }}
            >
              <text>
                {index === selectedIndex ? '> ' : '  '}
                {skill.id}
                {skill.version ? ` (${skill.version})` : ''}
              </text>
              <text fg={skill.enabled ? '#00ff00' : '#ff0000'}>
                {' - '}
                {skill.enabled ? 'Active' : 'Inactive'}
              </text>
            </box>
          ))}
          {/* {skills.map(skill => (
            <box key={`desc-${skill.id}`} paddingLeft={6} paddingBottom={0.5}>
              <text fg="#a0a0a0">{skill.description}</text>
            </box>
          ))} */}
        </box>
      )}

      {/* Footer */}
      {skills.length > 0 && (
        <box paddingLeft={2} paddingRight={2}>
          <text fg="#a0a0a0">
            ↑↓ Navigate {onViewDetails && '• Enter Details • '}
            {onUseSkill && '• Shift+Enter Use • '}
            Space Toggle
            {onRefresh && ' • R Refresh'}
            {' • Esc Close'}
          </text>
        </box>
      )}
    </box>
  );
}
