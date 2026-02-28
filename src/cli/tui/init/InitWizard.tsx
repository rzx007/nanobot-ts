import path from 'path';
import fs from 'fs/promises';
import { useState, useEffect, useRef } from 'react';
import { useRenderer } from '@opentui/react';
import { saveConfig, createDefaultConfig } from '@/config/loader';
import { saveMCPConfig, createDefaultMCPConfig } from '@/mcp/loader';
import { expandHome, ensureDir } from '@/utils/helpers';
import { NANOBOT_HOME, getPackageRoot, getTemplatesWorkspace } from '../../constants';
import { Layout } from '../components/Layout';
import { InitProgress, type StepResult } from './InitProgress';
import { theme } from '../theme';

export function InitWizard({ force }: { force: boolean }) {
  const renderer = useRenderer();
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    const addStep = (
      name: string,
      status: StepResult['status'],
      message?: string | undefined
    ) => {
      setSteps(prev => {
        const next = [...prev];
        const i = next.findIndex(s => s.name === name);
        const step: StepResult = { name, status, message };
        if (i >= 0) next[i] = step;
        else next.push(step);
        return next;
      });
    };

    (async () => {
      try {
        addStep('Directories', 'running');
        await ensureDir(NANOBOT_HOME);
        const workspacePath = expandHome('~/.nanobot/workspace');
        await ensureDir(workspacePath);
        await ensureDir(path.join(workspacePath, 'memory'));
        await ensureDir(path.join(workspacePath, 'sessions'));
        await ensureDir(path.join(workspacePath, 'skills'));
        addStep('Directories', 'done');

        addStep('MCP config', 'running');
        const mcpConfigPath = path.join(workspacePath, 'mcp.json');
        try {
          await fs.access(mcpConfigPath);
          addStep('MCP config', 'done', 'already exists');
        } catch {
          await saveMCPConfig(createDefaultMCPConfig(), workspacePath);
          addStep('MCP config', 'done', 'created');
        }

        const configPath = path.join(NANOBOT_HOME, 'config.json');
        addStep('Config', 'running');
        if (!force) {
          try {
            await fs.access(configPath);
            addStep('Config', 'done', 'already exists (use --force to overwrite)');
            setDone(true);
            return;
          } catch {
            // continue
          }
        }
        const config = createDefaultConfig();
        await saveConfig(config, configPath);
        addStep('Config', 'done', 'created');

        addStep('Templates', 'running');
        const packageRoot = getPackageRoot(import.meta.url);
        const templatesWorkspace = getTemplatesWorkspace(packageRoot);
        try {
          const stat = await fs.stat(templatesWorkspace);
          if (!stat.isDirectory()) throw new Error('Not a directory');
        } catch {
          addStep('Templates', 'done', 'no templates found');
          setDone(true);
          return;
        }

        const templateFiles = await fs.readdir(templatesWorkspace);
        for (const name of templateFiles) {
          const src = path.join(templatesWorkspace, name);
          const dest = path.join(workspacePath, name);
          try {
            await fs.access(dest);
          } catch {
            const stat = await fs.stat(src);
            if (stat.isDirectory()) {
              await fs.cp(src, dest, { recursive: true });
            } else {
              await fs.copyFile(src, dest);
            }
          }
        }
        addStep('Templates', 'done');

        addStep('Memory templates', 'running');
        const memoryDir = path.join(templatesWorkspace, 'memory');
        try {
          const entries = await fs.readdir(memoryDir);
          const destMemory = path.join(workspacePath, 'memory');
          for (const name of entries) {
            const dest = path.join(destMemory, name);
            try {
              await fs.access(dest);
            } catch {
              await fs.copyFile(path.join(memoryDir, name), dest);
            }
          }
          addStep('Memory templates', 'done');
        } catch {
          addStep('Memory templates', 'done', 'none');
        }

        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [force]);

  const handleExit = () => {
    renderer.destroy();
  };

  return (
    <Layout
      title="Init"
      footer={
        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted}>Press Ctrl+C to exit</text>
          {done ? (
            <box onMouseDown={handleExit}>
              <text fg={theme.accent}> Exit</text>
            </box>
          ) : null}
        </box>
      }
    >
      <box flexDirection="column" gap={1}>
        {error ? (
          <text fg={theme.error}>{error}</text>
        ) : null}
        <InitProgress steps={steps} />
        {done ? (
          <box paddingTop={1}>
            <text fg={theme.success}>
              Init done. Edit ~/.nanobot/config.json and run "nanobot gateway".
            </text>
          </box>
        ) : null}
      </box>
    </Layout>
  );
}
