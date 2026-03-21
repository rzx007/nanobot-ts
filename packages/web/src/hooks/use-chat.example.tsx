/**
 * useChat 使用示例
 *
 * 演示如何使用 Nanobot 自定义的 useChat hook
 * 处理自定义数据类型（question、approval）
 */

import { useChat } from '@/hooks/use-chat';

export function ChatExample() {
  const { messages, status } = useChat({
    chatId: 'chat-123',
    onQuestion: (dataPart) => {
      if (dataPart.type === 'data-question') {
        console.log('收到问题:', dataPart.data);

        // 处理问题
        const questions = dataPart.data.questions;
        questions.forEach((q) => {
          console.log(`问题: ${q.question}`);
          console.log(`选项: ${q.options.map(o => o.label).join(', ')}`);
        });
      }
    },
    onApproval: (dataPart) => {
      if (dataPart.type === 'data-approval') {
        console.log('收到审批请求:', dataPart.data);

        // 处理审批
        const { toolName, params } = dataPart.data;
        console.log(`工具: ${toolName}`);
        console.log(`参数:`, params);

        // 这里可以显示审批 UI，用户确认后调用 API
        // POST /api/v1/approval/{requestID} { approved: true }
      }
    },
    onFinish: ({ finishReason, messageMetadata }) => {
      console.log('流式响应完成:', finishReason);
      console.log('元数据:', messageMetadata);

      // 保存 token 使用情况
      if (messageMetadata?.usage) {
        console.log('Token 使用:', messageMetadata.usage);
      }
    },
  });

  return (
    <div>
      {/* 状态指示器 */}
      <div>状态: {status}</div>

      {/* 消息列表 */}
      {messages.map((message) => (
        <div key={message.id}>
          <div>{message.role}</div>

          {/* 渲染文本内容 */}
          {message.parts
            .filter((part) => part.type === 'text')
            .map((part, idx) => (
              <div key={idx}>{part.text}</div>
            ))}

          {/* 渲染问题数据 */}
          {message.parts
            .filter((part) => part.type === 'data-question')
            .map((part, idx) => (
              <div key={idx}>
                <h3>问题</h3>
                {part.data.questions.map((q, qIdx) => (
                  <div key={qIdx}>
                    <p>{q.question}</p>
                    <ul>
                      {q.options.map((opt, optIdx) => (
                        <li key={optIdx}>
                          {opt.label}: {opt.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}

          {/* 渲染审批数据 */}
          {message.parts
            .filter((part) => part.type === 'data-approval')
            .map((part, idx) => (
              <div key={idx}>
                <h3>需要审批</h3>
                <p>工具: {part.data.toolName}</p>
                <pre>{JSON.stringify(part.data.params, null, 2)}</pre>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/**
 * 高级示例：使用类型安全的 message.parts
 */
import type { NanobotUIMessage } from '@/types/ai-message';

export function AdvancedChatExample() {
  const { messages, sendMessage } = useChat();

  const renderPart = (part: NanobotUIMessage['parts'][number], idx: number) => {
    switch (part.type) {
      case 'text':
        return <p key={idx}>{part.text}</p>;

      case 'data-question':
        return (
          <div key={idx}>
            <strong>问题:</strong>
            <pre>{JSON.stringify(part.data, null, 2)}</pre>
          </div>
        );

      case 'data-approval':
        return (
          <div key={idx}>
            <strong>审批请求:</strong>
            <pre>{JSON.stringify(part.data, null, 2)}</pre>
          </div>
        );

      case 'tool-input-available':
        return (
          <div key={idx}>
            <strong>工具调用:</strong>
            <pre>{JSON.stringify(part.input, null, 2)}</pre>
          </div>
        );

      default:
        // TypeScript 会确保处理所有类型
        return null;
    }
  };

  return (
    <div>
      {messages.map((message) => {
        return (
          <div key={message.id}>
            <h4>{message.role}</h4>

            {/* 遍历所有 parts */}
            {message.parts.map((part, idx) => renderPart(part, idx))}
          </div>
        );
      })}

      <button onClick={() => sendMessage({ text: 'Hello' })}>
        发送消息
      </button>
    </div>
  );
}

/**
 * 示例：从消息历史获取数据
 */
export function MessageHistoryExample() {
  const { messages } = useChat();

  // 获取所有问题
  const allQuestions = messages.flatMap((message) =>
    message.parts
      .filter((part): part is { type: 'data-question'; data: unknown } => part.type === 'data-question')
      .map((part) => part.data),
  );

  // 获取所有审批请求
  const allApprovals = messages.flatMap((message) =>
    message.parts
      .filter((part): part is { type: 'data-approval'; data: unknown } => part.type === 'data-approval')
      .map((part) => part.data),
  );

  // 获取所有文本
  const allText = messages.flatMap((message) =>
    message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text),
  );

  return (
    <div>
      <h2>消息历史</h2>
      <h3>问题 ({allQuestions.length})</h3>
      <pre>{JSON.stringify(allQuestions, null, 2)}</pre>

      <h3>审批 ({allApprovals.length})</h3>
      <pre>{JSON.stringify(allApprovals, null, 2)}</pre>

      <h3>文本</h3>
      {allText.map((text, idx) => (
        <p key={idx}>{text}</p>
      ))}
    </div>
  );
}
