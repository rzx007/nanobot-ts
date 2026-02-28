import { useState, useEffect } from 'react';
import { loadConfig } from '@/config/loader';
import { expandHome } from '@/utils/helpers';
import { SessionManager } from '@/storage';
import { DEFAULT_CONFIG_PATH } from '../../constants';
import { Layout } from '../components/Layout';
import { StatusDashboard } from './StatusDashboard';
import { theme } from '../theme';

export function StatusApp() {
  const [configPath] = useState(DEFAULT_CONFIG_PATH);
  const [workspace, setWorkspace] = useState<string>('');
  const [sessions, setSessions] = useState<Array<{ key: string; messageCount: number; updatedAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await loadConfig();
      if (cancelled) return;
      if (!config) {
        setError('No config found. Run "nanobot init" first.');
        return;
      }
      const ws = expandHome(config.agents.defaults.workspace);
      setWorkspace(ws);
      const manager = new SessionManager(ws);
      await manager.init();
      if (cancelled) return;
      const list = await manager.listSessions();
      if (cancelled) return;
      setSessions(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Layout title="Status">
        <text fg={theme.error}>{error}</text>
      </Layout>
    );
  }

  if (!workspace) {
    return (
      <Layout title="Status">
        <text fg={theme.textMuted}>Loading...</text>
      </Layout>
    );
  }

  return (
    <Layout title="Status">
      <StatusDashboard
        configPath={configPath}
        workspace={workspace}
        sessions={sessions}
      />
    </Layout>
  );
}
