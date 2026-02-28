import { useState, useEffect } from 'react';
import { loadConfig } from '@/config/loader';
import { Layout } from '../components/Layout';
import { ConfigForm, getNested } from './ConfigForm';
import { ConfigEditor } from './ConfigEditor';
import { theme } from '../theme';

export function ConfigApp({
  keyOption,
  valueOption,
}: {
  keyOption?: string | undefined;
  valueOption?: string | undefined;
}) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig().then(c => {
      if (c) setConfig(c as Record<string, unknown>);
      else setError('No config found. Run "nanobot init" first.');
    });
  }, []);

  if (error) {
    return (
      <Layout title="Config">
        <text fg={theme.error}>{error}</text>
      </Layout>
    );
  }

  if (!config) {
    return (
      <Layout title="Config">
        <text fg={theme.textMuted}>Loading...</text>
      </Layout>
    );
  }

  const jsonString = JSON.stringify(config, null, 2);

  if (keyOption) {
    const raw = getNested(config, keyOption);
    const valueStr =
      raw === undefined ? '(undefined)' : JSON.stringify(raw, null, 2);
    return (
      <Layout title="Config">
        <ConfigForm keyPath={keyOption} value={valueStr} />
        {valueOption !== undefined ? (
          <box paddingTop={1}>
            <text fg={theme.textMuted}>
              Set not fully implemented. Edit ~/.nanobot/config.json directly.
            </text>
          </box>
        ) : null}
      </Layout>
    );
  }

  return (
    <Layout title="Config">
      <ConfigEditor content={jsonString} readOnly />
    </Layout>
  );
}
