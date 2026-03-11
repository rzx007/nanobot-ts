import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useAppContext } from '../context';
import { ChatInput, type ChatInputHandle } from '../components/ChatInput';
import { Layout } from '../components/Layout';
import { Logo } from '../components/Logo';
import { useDialog } from '../components/Dialog';
import { theme } from '../theme';
import { SlashCommandExecutor, createAllHandlers, type SlashCommandContext } from '../commands';
// package.json version
import packageJson from '../../../../package.json';

const VERSION = packageJson.version;

const TIPS = [
  'Press Ctrl+P to open the command palette',
  'Press Enter to send and start a chat',
  'Use /status to view agent and gateway status',
  'Use /config to set API key and model',
];

function getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export function HomeView() {
  const { navigateTo, config, runtime } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [tip] = useState(() => getRandomTip());
  const chatInputRef = useRef<ChatInputHandle | null>(null);
  const dialog = useDialog();

  // 创建 Slash 命令执行器并获取命令列表
  const slashExecutor = useMemo(() => {
    const executor = new SlashCommandExecutor();
    executor.registerAll(createAllHandlers());
    return executor;
  }, []);

  const slashCommands = useMemo(() => {
    return slashExecutor.getSlashCommandOptions();
  }, [slashExecutor]);

  useEffect(() => {
    (async () => {
      setLoading(false);
    })();
  }, []);

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;

    let contentToNavigate = text;

    // 处理 /技能名称 语法
    const skillRegex = /^\/([a-zA-Z0-9_-]+)\s+(.*)$/;
    const match = text.match(skillRegex);

    if (match && runtime?.skills) {
      const skillName = match[1];
      const userMessage = match[2];
      if (skillName) {
        const skill = runtime.skills.getSkill(skillName);

        if (skill) {
          // 构建包含技能内容的消息
          contentToNavigate = `## Skill: ${skill.name}\n\n${skill.content}\n\n---\n\n${userMessage}`;
        }
      }
    }

    // 导航到 gateway
    navigateTo('gateway', contentToNavigate as string);
    // 清空输入框
    setTimeout(() => {
      chatInputRef.current?.clear();
    }, 0);
  };

  const handleSlashCommand = async (commandId: string) => {
    // 构建 Slash 命令执行上下文
    const context: SlashCommandContext = {
      runtime: runtime || null,
      config: config || null,
      navigateTo,
      setMessages: () => {
        // HomeView 不需要消息列表，空实现
      },
      clearMessages: () => {
        // HomeView 不需要消息列表，空实现
      },
      addSystemMessage: (content: string) => {
        // 系统消息可以在这里处理，如果需要的话
        console.log('System message:', content);
      },
      addUserMessage: (content: string) => {
        // 用户消息可以在这里处理
        console.log('User message:', content);
      },
      addAssistantMessage: (content: string) => {
        // 助手消息可以在这里处理
        console.log('Assistant message:', content);
      },
      openDialog: (element: ReactNode, onClose?: () => void) => {
        dialog.replace(element, onClose);
      },
      closeDialog: () => {
        dialog.clear();
      },
      chatInputRef: chatInputRef,
    };

    // 执行命令
    await slashExecutor.execute(commandId, context);
  };

  if (loading) {
    return (
      <Layout title="">
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.textMuted}>Loading...</text>
        </box>
      </Layout>
    );
  }

  return (
    <Layout
      title=""
      footer={
        <box
          flexDirection="row"
          width="100%"
          justifyContent="space-between"
          alignItems="center"
          padding={1}
        >
          <box flexDirection="row" gap={2}>
            <text fg={theme.textMuted}>~</text>
          </box>
          <text fg={theme.textMuted}>{VERSION}</text>
        </box>
      }
    >
      <box
        flexDirection="column"
        flexGrow={1}
        height="100%"
        alignItems="center"
        paddingLeft={2}
        paddingRight={2}
      >
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <box flexShrink={0}>
          <Logo />
        </box>
        <box height={1} minHeight={0} flexShrink={0} />
        <box width="100%" maxWidth={75} flexShrink={0} paddingTop={1}>
          <ChatInput
            ref={chatInputRef}
            onSubmit={handleSubmit}
            placeholder="Ask anything... e.g. 'What is the tech stack of this project?'"
            onSlashCommand={handleSlashCommand}
            slashCommands={slashCommands}
          />
        </box>
        <box
          height={4}
          minHeight={0}
          width="100%"
          maxWidth={75}
          alignItems="center"
          paddingTop={3}
          flexShrink={0}
        >
          <box flexDirection="row" maxWidth="100%">
            <text flexShrink={0} fg={theme.warn}>
              ● Tip{' '}
            </text>
            <text flexShrink={1} fg={theme.textMuted}>
              {tip}
            </text>
          </box>
        </box>
        <box flexGrow={1} minHeight={0} />
      </box>
    </Layout>
  );
}
