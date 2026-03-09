import { StatusDialog } from './StatusDialog';
import { HelpDialog } from './HelpDialog';
import { ModelsDialog } from './ModelsDialog';
import { McpDialog } from './McpDialog';
import { SkillsDialog } from './SkillsDialog';
import type {
  CreateStatusDialogParams,
  CreateHelpDialogParams,
  CreateModelsDialogParams,
  CreateMcpDialogParams,
  CreateSkillsDialogParams,
  DialogCreatorResult,
} from './types';

/**
 * 创建状态 Dialog
 */
export function createStatusDialog(params: CreateStatusDialogParams): DialogCreatorResult {
  const { runtime, config } = params;

  return {
    element: <StatusDialog runtime={runtime} config={config} />,
  };
}

/**
 * 创建帮助 Dialog
 */
export function createHelpDialog(params?: CreateHelpDialogParams): DialogCreatorResult {
  const { customContent } = params || {};

  return {
    element: <HelpDialog customContent={customContent} />,
  };
}

/**
 * 创建模型选择 Dialog
 */
export function createModelsDialog(params: CreateModelsDialogParams): DialogCreatorResult {
  const { currentModel, models, onSelectModel } = params;

  return {
    element: (
      <ModelsDialog currentModel={currentModel} models={models} onSelectModel={onSelectModel} />
    ),
  };
}

/**
 * 创建 MCP 切换 Dialog
 */
export function createMcpDialog(params: CreateMcpDialogParams): DialogCreatorResult {
  const { mcps, onToggleMcp, onApplyChanges } = params;

  return {
    element: <McpDialog mcps={mcps} onToggleMcp={onToggleMcp} onApplyChanges={onApplyChanges} />,
  };
}

/**
 * 创建技能查看 Dialog
 */
export function createSkillsDialog(params: CreateSkillsDialogParams): DialogCreatorResult {
  const { skills, onSelectSkill, onRefresh } = params;

  return {
    element: <SkillsDialog skills={skills} onSelectSkill={onSelectSkill} onRefresh={onRefresh} />,
  };
}
