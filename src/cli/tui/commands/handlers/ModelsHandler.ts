import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createModelsDialog } from '../dialogs';
import type { ModelInfo } from '../dialogs/types';

/**
 * 可用的模型列表
 * TODO: 从配置或环境变量中读取
 */
const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: '平衡性能和速度的最新模型',
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    description: '最强性能的顶级模型',
  },
  {
    id: 'claude-haiku-4-5-20250929',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    description: '快速响应的轻量级模型',
  },
];

/**
 * /models 命令处理器
 * 使用 Dialog 切换模型
 */
export class ModelsHandler implements SlashCommandHandler {
  id = 'models';
  label = '/models';
  description = 'Switch model';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { config, openDialog, addSystemMessage } = context;

    if (!config) {
      addSystemMessage('错误: 配置未加载');
      return;
    }

    const currentModel = config.agents.defaults.model;

    // 标记当前模型
    const models = AVAILABLE_MODELS.map(model => ({
      ...model,
      current: model.id === currentModel,
    }));

    // 创建并打开模型选择 Dialog
    const { element } = createModelsDialog({
      currentModel,
      models,
      onSelectModel: async (modelId: string) => {
        // TODO: 实现模型切换逻辑
        // 需要更新配置并重新加载运行时
        addSystemMessage(`模型切换功能尚未实现: ${modelId}`);
      },
    });

    openDialog(element);
  }
}
