import { useState } from 'react';
import { X } from 'lucide-react';
import { replyQuestion, cancelQuestion } from '@/services';
import type { QuestionEvent } from '@nanobot/shared';
import { Button } from '@/components/ui/button';

interface QuestionDialogProps {
  questionEvent: QuestionEvent;
  onClose: () => void;
}

export function QuestionDialog({ questionEvent, onClose }: QuestionDialogProps) {
  const [answers, setAnswers] = useState<string[][]>(
    questionEvent.questions.map(() => [])
  );
  const [loading, setLoading] = useState(false);

  const handleOptionToggle = (questionIndex: number, optionLabel: string) => {
    const question = questionEvent.questions[questionIndex];

    setAnswers(prev => {
      const newAnswers = [...prev];
      if (question.multiple) {
        const currentAnswer = newAnswers[questionIndex];
        if (currentAnswer.includes(optionLabel)) {
          newAnswers[questionIndex] = currentAnswer.filter(l => l !== optionLabel);
        } else {
          newAnswers[questionIndex] = [...currentAnswer, optionLabel];
        }
      } else {
        newAnswers[questionIndex] = [optionLabel];
      }
      return newAnswers;
    });
  };

  const handleSubmit = async () => {
    const allAnswered = questionEvent.questions.every((q, i) => {
      if (q.multiple) return answers[i].length >= 1;
      return answers[i].length === 1;
    });

    if (!allAnswered) {
      alert('请回答所有问题');
      return;
    }

    setLoading(true);
    try {
      await replyQuestion(questionEvent.requestID, { answers });
      onClose();
    } catch (error) {
      console.error('Failed to reply question:', error);
      alert('提交回答失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelQuestion(questionEvent.requestID);
      onClose();
    } catch (error) {
      console.error('Failed to cancel question:', error);
      alert('取消失败');
    }
  };

  return (
    <div className="border rounded-lg bg-card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">问题确认</h3>
        <button
          onClick={handleCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {questionEvent.questions.map((question, qIndex) => (
          <div key={qIndex} className="space-y-2">
            <div className="font-medium">
              {question.header}
            </div>
            <div className="text-sm text-muted-foreground">
              {question.question}
            </div>
            <div className="space-y-2">
              {question.options.map((option, oIndex) => {
                const isSelected = answers[qIndex].includes(option.label);
                const inputType = question.multiple ? 'checkbox' : 'radio';

                return (
                  <label
                    key={oIndex}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted'
                      }`}
                  >
                    <input
                      type={inputType}
                      name={`question-${qIndex}`}
                      value={option.label}
                      checked={isSelected}
                      onChange={() => handleOptionToggle(qIndex, option.label)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {option.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={loading}
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '提交中...' : '确认回答'}
        </Button>
      </div>
    </div>
  );
}
