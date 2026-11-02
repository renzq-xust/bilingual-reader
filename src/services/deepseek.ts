import axios from 'axios';
import { TranslationConfig } from '../types';

// DeepSeek API 调用服务
export class DeepSeekService {
  private config: TranslationConfig;

  constructor(config: TranslationConfig) {
    this.config = config;
  }

  // 翻译文本
  async translate(text: string, targetLanguage: string = 'zh-CN'): Promise<string> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: `你是一个专业的翻译助手。请将用户提供的英文文本翻译成${targetLanguage === 'zh-CN' ? '简体中文' : targetLanguage}。要求：
1. 翻译要准确、自然、流畅
2. 保持原文的段落结构
3. 专业术语要准确
4. 只返回翻译结果，不要添加解释`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.3,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error('翻译失败，请检查API配置');
    }
  }

  // AI对话 - 流式响应
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是一个智能助手，帮助用户理解阅读内容。用户可能会询问关于当前阅读文本的问题，请根据上下文给出准确、简洁的回答。回答使用中文。',
            },
            ...messages,
          ],
          temperature: 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                onChunk(content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      console.error('Chat error:', error);
      onError(error instanceof Error ? error : new Error('未知错误'));
    }
  }

  // 批量翻译句子
  async translateSentences(sentences: string[]): Promise<string[]> {
    const text = sentences.join('\n');
    const result = await this.translate(text);
    return result.split('\n').filter((line) => line.trim());
  }

  // 视觉翻译：将 PDF 页面图片发送给视觉模型，直接翻译
  async translatePageImage(imageBase64: string, targetLanguage: string = 'zh-CN'): Promise<{
    extractedText: string;
    translation: string;
  }> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: `你是一个专业的 PDF 文档翻译助手。请识别图片中的英文文本并翻译成${targetLanguage === 'zh-CN' ? '简体中文' : targetLanguage}。

要求：
- 保持原文的段落结构
- 专业术语要准确
- 翻译要准确、自然、流畅
- 只返回翻译结果，不要返回英文原文`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                  },
                },
                {
                  type: 'text',
                  text: '请将这张PDF页面的内容翻译成中文，只返回翻译结果。',
                },
              ],
            },
          ],
          temperature: 0.3,
          stream: false,
          max_tokens: 4096,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: 60000, // 60秒超时
        }
      );

      const translation = response.data.choices[0].message.content.trim();
      
      return {
        extractedText: '',  // 不返回原文
        translation,
      };
    } catch (error) {
      console.error('Vision translation error:', error);
      throw new Error('视觉翻译失败，请检查API配置');
    }
  }
}

// 创建服务实例
export const createDeepSeekService = (config: TranslationConfig): DeepSeekService => {
  return new DeepSeekService(config);
};
