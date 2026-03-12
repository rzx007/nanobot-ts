import { useEffect, useState } from 'react';
import { theme } from '../theme';

export function SubagentPanel({ runtime }: { runtime: any }) {
  const [tasks, setTasks] = useState<Array<{ taskId?: string; status?: string; startedAt?: string }>>([]);

  useEffect(() => {
    let mounted = true;
    const fetchStatuses = () => {
      try {
        const m = runtime?.subagentManager?.getAllTaskStatuses?.() as Map<string, any> | undefined;
        if (!m) return;
        const arr = Array.from(m.entries()).map(([id, status]) => ({ taskId: id, status, startedAt: status?.startedAt }));
        if (mounted) setTasks(arr);
      } catch {
        // ignore
      }
    };
    fetchStatuses();
    const t = setInterval(fetchStatuses, 2000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [runtime]);

  const onCancel = (taskId: string) => {
    runtime?.subagentManager?.cancel(taskId);
  };

  return (
    <>
      {tasks.length ?
        <box flexDirection="column" padding={1} border borderStyle="rounded" borderColor={theme.border}>
          <text>Subagent Tasks (live)</text>
          {tasks.map((t, i) => (
            <box key={t.taskId ?? `task-${i}`} flexDirection="row" justifyContent="space-between" width="100%">
              <text>{t.taskId ?? ''} - {t.status ?? ''}</text>
              <box
                border
                borderStyle="single"
                paddingLeft={1}
                paddingRight={1}
                onMouseDown={evt => evt.stopPropagation()}
                onMouseUp={evt => {
                  evt.stopPropagation();
                  onCancel(t.taskId!);
                }}
              >
                <text fg={theme.accent}>Cancel</text>
              </box>
            </box>
          ))}
        </box> : null}
    </>

  );
}
