/**
 * 输出清洗工具
 */
export class OutputSanitizer {
  /**
   * 去除思考块（部分模型会在 content 中嵌入思考）
   */
  static stripThink(text: string | null | undefined): string {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim() || '';
  }
}
