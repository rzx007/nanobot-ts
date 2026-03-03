import { DialogSelect, type DialogSelectOption } from '../../components/DialogSelect';
import type { ModelsDialogProps } from './types';

/**
 * 模型选择 Dialog
 * 使用 DialogSelect 组件实现模型切换
 */
export function ModelsDialog({
  models,
  onSelectModel,
  onClose,
}: ModelsDialogProps) {
  // 将 ModelInfo 转换为 DialogSelectOption
  const options: DialogSelectOption<string>[] = models.map(model => ({
    value: model.id,
    title: model.name,
    description: `${model.provider}${model.current ? ' (当前)' : ''}`,
    category: model.provider,
    onSelect: option => {
      onSelectModel(option.value);
      onClose?.();
    },
  }));

  return (
    <DialogSelect
      title="Select Model"
      placeholder="Search models..."
      options={options}
      onSelect={option => {
        onSelectModel(option.value);
        onClose?.();
      }}
    />
  );
}
