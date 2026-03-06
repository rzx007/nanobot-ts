import { useState } from 'react';
import { useRenderer, useKeyboard } from '@opentui/react';
import { useAppContext } from '../context';
import { Layout } from '../components/Layout';
import { theme } from '../theme';
import { SETUP_STEPS } from './constants';
import { ProviderForm } from './ProviderForm';
import { ApprovalForm } from './ApprovalForm';
import { ChannelForm } from './ChannelForm';
import type { ProviderConfig, ChannelConfig } from './types';
import { saveConfig, createDefaultConfig, getChannelsFromConfig } from '@/config/loader';
import type { Config } from '@/config/schema';
import path from 'path';
import os from 'os';

export function SetupWizard() {
  const renderer = useRenderer();
  const { config: appConfig, reloadConfig, navigateTo } = useAppContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [childEditing, setChildEditing] = useState(false);
  const [providerSkipped, setProviderSkipped] = useState(false);

  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    type: 'openai',
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  });

  const [approvalEnabled, setApprovalEnabled] = useState(true);
  const [channelsConfig, setChannelsConfig] = useState<ChannelConfig>(() =>
    getChannelsFromConfig(appConfig),
  );

  const handleNext = async () => {
    if (currentStep < SETUP_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkipProvider = () => {
    setProviderSkipped(true);
    setCurrentStep(1);
  };

  const handleFinish = async () => {
    if (!providerSkipped && !providerConfig.apiKey?.trim()) {
      setError('请先填写 API Key');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const defaultConfig = createDefaultConfig();

      const config = providerSkipped
        ? {
            ...defaultConfig,
            tools: {
              ...defaultConfig.tools,
              approval: {
                ...defaultConfig.tools.approval,
                enabled: approvalEnabled,
              },
            },
            channels: Object.fromEntries(
              Object.entries(defaultConfig.channels).map(([k, ch]) => [
                k,
                {
                  ...ch,
                  enabled: channelsConfig[k]?.enabled ?? (ch as { enabled?: boolean }).enabled,
                },
              ]),
            ) as Config['channels'],
          }
        : {
            ...defaultConfig,
            providers: {
              ...defaultConfig.providers,
              [providerConfig.type]: {
                apiKey: providerConfig.apiKey,
                apiBase:
                  providerConfig.apiBase ||
                  defaultConfig.providers[
                    providerConfig.type as keyof typeof defaultConfig.providers
                  ]?.apiBase,
              },
            },
            agents: {
              defaults: {
                ...defaultConfig.agents.defaults,
                model: `${providerConfig.type}:${providerConfig.model || defaultConfig.agents.defaults.model}`,
              },
            },
            tools: {
              ...defaultConfig.tools,
              approval: {
                ...defaultConfig.tools.approval,
                enabled: approvalEnabled,
              },
            },
            channels: Object.fromEntries(
              Object.entries(defaultConfig.channels).map(([k, ch]) => [
                k,
                {
                  ...ch,
                  enabled: channelsConfig[k]?.enabled ?? (ch as { enabled?: boolean }).enabled,
                },
              ]),
            ) as Config['channels'],
          };

      const configPath = path.join(os.homedir(), '.nanobot', 'config.json');

      await saveConfig(config, configPath);

      await reloadConfig();
      navigateTo('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (currentStep < SETUP_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  useKeyboard((key: { name: string }) => {
    if (key.name === 'escape') {
      if (childEditing) return;
      if (currentStep > 0) {
        setCurrentStep(prev => prev - 1);
      } else {
        renderer.destroy();
      }
      return;
    }
    if (key.name === 'enter' || key.name === 'return') {
      if (loading || childEditing) return;
      if (currentStep < SETUP_STEPS.length - 1) {
        handleNext();
      } else {
        handleFinish();
      }
      return;
    }
  });

  return (
    <Layout title="配置向导" footer={error ? <text fg={theme.error}>{error}</text> : undefined}>
      {loading ? (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.textMuted}>保存配置中...</text>
        </box>
      ) : (
        <box flexDirection="column" flexGrow={1}>
          <box flexDirection="column" gap={1} flexGrow={1}>
            <text fg={theme.primary}>
              步骤 {currentStep + 1}/{SETUP_STEPS.length}: {SETUP_STEPS[currentStep]!.title}
            </text>
            {/* <text fg={theme.textMuted}>{SETUP_STEPS[currentStep]!.description}</text> */}

            <box flexGrow={1} paddingTop={1}>
              {currentStep === 0 && (
                <ProviderForm
                  config={providerConfig}
                  onChange={c => {
                    setProviderConfig(c);
                    setProviderSkipped(false);
                  }}
                  onEditingChange={setChildEditing}
                  onSkipProvider={handleSkipProvider}
                  onNext={handleNext}
                  providerSkipped={providerSkipped}
                />
              )}
              {currentStep === 1 && (
                <ApprovalForm enabled={approvalEnabled} onChange={setApprovalEnabled} />
              )}
              {currentStep === 2 && (
                <ChannelForm config={channelsConfig} onChange={setChannelsConfig} />
              )}
            </box>
          </box>

          <box flexDirection="row" gap={2} paddingTop={1} paddingBottom={1}>
            {currentStep > 0 && (
              <box onMouseDown={handlePrev}>
                <text fg={theme.text}>[上一步]</text>
              </box>
            )}
            {currentStep < SETUP_STEPS.length - 1 ? (
              <box onMouseDown={handleNext}>
                <text fg={theme.accent}>[下一步]</text>
              </box>
            ) : (
              <box onMouseDown={handleFinish}>
                <text fg={theme.success}>[完成配置]</text>
              </box>
            )}
            {currentStep < SETUP_STEPS.length - 1 && currentStep > 0 && (
              <box onMouseDown={handleSkip}>
                <text fg={theme.textMuted}>[跳过]</text>
              </box>
            )}
          </box>
        </box>
      )}
    </Layout>
  );
}
