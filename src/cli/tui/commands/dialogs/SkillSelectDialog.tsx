import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { useDialog } from '../../components/Dialog';

/**
 * 技能选择对话框参数
 */
export interface SkillSelectDialogProps {
  skills: Array<{ id: string; name: string; description: string }>;
  onSelect: (skillName: string) => void;
}

/**
 * 创建技能选择对话框
 */
export function createSkillSelectDialog({ skills, onSelect }: SkillSelectDialogProps) {
  const dialog = useDialog();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectSkill = () => {
    const skill = skills[selectedIndex];
    if (skill) {
      dialog.clear();
      onSelect(skill.name);
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
      selectSkill();
      return;
    }
  });

  return {
    element: (
      <box gap={1} paddingBottom={1}>
        {/* Header */}
        <box paddingLeft={2} paddingRight={2}>
          <box flexDirection="row" justifyContent="space-between">
            <text>Select Skill</text>
            <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
              esc
            </text>
          </box>
        </box>

        {/* Skills List */}
        {skills.length === 0 ? (
          <box paddingLeft={2}>
            <text fg="#a0a0a0">No skills available</text>
            <box paddingTop={1}>
              <text fg="#a0a0a0">Run /skills to view installed skills</text>
            </box>
          </box>
        ) : (
          <box paddingLeft={2} paddingRight={2}>
            {skills.map((skill, index) => (
              <box
                key={skill.id}
                flexDirection="column"
                padding={0.5}
                backgroundColor={index === selectedIndex ? '#e94560' : 'transparent'}
                onMouseDown={() => setSelectedIndex(index)}
                onMouseUp={evt => {
                  evt.stopPropagation();
                  dialog.clear();
                  onSelect(skill.name);
                }}
              >
                <text>
                  {index === selectedIndex ? '> ' : '  '}
                  {skill.name}
                </text>
                <text fg="#a0a0a0" paddingLeft={2}>
                  {skill.description}
                </text>
              </box>
            ))}
          </box>
        )}

        {/* Footer */}
        {skills.length > 0 && (
          <box paddingLeft={2} paddingRight={2}>
            <text fg="#a0a0a0">↑↓ Navigate • Enter Select • Esc Close</text>
          </box>
        )}
      </box>
    ),
    onClose: () => dialog.clear(),
  };
}
