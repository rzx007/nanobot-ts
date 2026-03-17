import { useState, useEffect } from 'react';
import type { QuestionEvent } from '@nanobot/shared';

interface QuestionDialogProps {
  eventSource: EventSource | null;
  onReply: (requestID: string, answers: string[][]) => Promise<void>;
}

export function QuestionDialog({ eventSource, onReply }: QuestionDialogProps) {
  const [currentQuestion, setCurrentQuestion] = useState<{
    event: QuestionEvent;
    currentIndex: number;
    answers: string[][];
  } | null>(null);

  useEffect(() => {
    if (!eventSource) return;

    const handler = (e: MessageEvent) => {
      try {
        const event: QuestionEvent = JSON.parse(e.data);
        if (event.type === 'question.asked') {
          setCurrentQuestion({
            event,
            currentIndex: 0,
            answers: [],
          });
        }
      } catch (error) {
        console.error('Failed to parse question event:', error);
      }
    };

    eventSource.addEventListener('question', handler);
    return () => eventSource.removeEventListener('question', handler);
  }, [eventSource]);

  if (!currentQuestion) return null;

  const { event, currentIndex, answers } = currentQuestion;
  const question = event.questions[currentIndex];

  const handleSelect = (optionLabel: string) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = [optionLabel];

    if (currentIndex < event.questions.length - 1) {
      setCurrentQuestion({
        event,
        currentIndex: currentIndex + 1,
        answers: newAnswers,
      });
    } else {
      void onReply(event.requestID, newAnswers);
      setCurrentQuestion(null);
    }
  };

  const handleCancel = () => {
    setCurrentQuestion(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            问题 {currentIndex + 1} / {event.questions.length}
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <h2 className="text-lg font-semibold mb-2">{question.header}</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{question.question}</p>

        <div className="space-y-2">
          {question.options.map((option) => (
            <button
              key={option.label}
              onClick={() => handleSelect(option.label)}
              className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
