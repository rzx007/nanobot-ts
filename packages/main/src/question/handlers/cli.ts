/**
 * CLI Question Handler
 *
 * 处理 CLI 渠道的问题交互
 */

import inquirer from 'inquirer';
import type { Question, QuestionManager } from '@nanobot/shared';

export class CLIQuestionHandler {
  constructor(private questionManager: QuestionManager) { }

  /**
   * 处理 CLI 渠道的问题
   *
   * @param requestID - 请求ID
   * @param questions - 问题列表
   */
  async handleQuestions(requestID: string, questions: Question[]): Promise<void> {
    const answers: string[][] = [];

    for (const q of questions) {
      const result = await inquirer.prompt([
        {
          type: 'list',
          name: 'answer',
          message: q.question,
          choices: q.options.map((opt) => ({
            name: `${opt.label} - ${opt.description}`,
            value: opt.label,
          })),
        },
      ]);

      answers.push([result.answer]);
    }

    try {
      await this.questionManager.reply(requestID, answers);
    } catch (error) {
      console.error('Failed to submit question answers:', error);
      throw error;
    }
  }
}
