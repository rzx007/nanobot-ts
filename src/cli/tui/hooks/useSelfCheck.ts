import { useState, useEffect } from 'react';
import type { Config } from '@/config/schema';
import type { SelfCheckResult, CheckResult } from '../setup/types';

export function useSelfCheck(config: Config | null) {
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!config) {
      setResult(null);
      return;
    }

    (async () => {
      setLoading(true);
      const errors: string[] = [];
      const warnings: string[] = [];
      const results: CheckResult[] = [];

      try {
        const fs = await import('fs/promises');

        // 检查配置文件
        results.push({ name: '配置文件', status: 'done', message: '已加载' });

        // 检查工作区目录
        const workspacePath = config.agents.defaults.workspace.replace(
          '~',
          process.env.HOME ?? process.env.USERPROFILE ?? '~',
        );
        try {
          await fs.access(workspacePath);
          results.push({ name: '工作区目录', status: 'done' });
        } catch {
          results.push({ name: '工作区目录', status: 'error', message: '目录不存在' });
          warnings.push('工作区目录不存在');
        }

        // 检查API密钥
        const hasKey = Object.values(config.providers).some(
          p => p?.apiKey && p.apiKey.trim() !== '',
        );
        if (hasKey) {
          results.push({ name: 'API密钥', status: 'done' });
        } else {
          results.push({ name: 'API密钥', status: 'error', message: '未配置' });
          errors.push('未配置API密钥');
        }

        let severity: SelfCheckResult['severity'] = 'success';
        if (errors.length > 0) {
          severity = 'error';
        } else if (warnings.length > 0) {
          severity = 'warning';
        }

        const canProceed = severity !== 'error' && errors.length === 0;

        setResult({
          severity,
          errors,
          warnings,
          results,
          canProceed,
        });
      } catch (err) {
        setResult({
          severity: 'error',
          errors: [err instanceof Error ? err.message : String(err)],
          warnings: [],
          results: [],
          canProceed: false,
        });
      } finally {
        setLoading(false);
      }
    })();

  }, [config]);

  return { result, loading };
}
