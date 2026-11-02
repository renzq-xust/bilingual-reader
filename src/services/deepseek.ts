import { TranslationConfig } from '../types';
import { API_CONFIG, TRANSLATION_CONFIG } from '../utils/config';

// 统一的 API 错误类型
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// 计算重试延迟（指数退避 + 抖动）
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    API_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt),
    API_CONFIG.RETRY_MAX_DELAY,
  );
  // 添加 20% 随机抖动，避免惊群效应
  return delay * (0.8 + Math.random() * 0.4);
}

// 延迟函数
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// DeepSeek API 调用服务
export class DeepSeekService {
  private config: TranslationConfig;

  constructor(config: TranslationConfig) {
    this.config = config;
  }

  // 统一的 API 请求方法（带重试机制）
  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = API_CONFIG.MAX_RETRIES,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 判断是否可重试
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt === maxRetries) {
          throw lastError;
        }

        const delay = getRetryDelay(attempt);
        console.warn(`[API] 请求失败 (第 ${attempt + 1} 次)，${delay.toFixed(0)}ms 后重试...`, lastError.message);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error('请求失败');
  }

  // 判断错误是否可重试
  private isRetryableError(error: unknown): boolean {
    if (error instanceof APIError) {
      return error.isRetryable;
    }
    // 网络错误通常可重试
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }
    return false;
  }

  // 构建请求头
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  // 获取 API URL
  private getApiUrl(path: string = '/chat/completions'): string {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    return `${baseUrl}${path}`;
  }

  // 翻译文本
  async translate(text: string, targetLanguage: string = 'zh-CN'): Promise<string> {
    return this.requestWithRetry(async () => {
      try {
        const response = await fetch(this.getApiUrl(), {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
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
              { role: 'user', content: text },
            ],
            temperature: TRANSLATION_CONFIG.TEMPERATURE,
            stream: false,
          }),
        });

        if (!response.ok) {
          const isRetryable = response.status === 429 || response.status >= 500;
          throw new APIError(
            `API 请求失败: ${response.status} ${response.statusText}`,
            response.status,
            isRetryable,
          );
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
      } catch (error) {
        if (error instanceof APIError) throw error;
        console.error('[Translation] 请求错误:', error);
        throw new APIError('翻译失败，请检查网络连接', undefined, true);
      }
    });
  }

  // AI对话 - 流式响应（不重试，因为流式中断后无法恢复）
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      const response = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是一个智能助手，帮助用户理解阅读内容。用户可能会询问关于当前阅读文本的问题，请根据上下文给出准确、简洁的回答。回答使用中文。',
            },
            ...messages,
          ],
          temperature: TRANSLATION_CONFIG.CHAT_TEMPERATURE,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new APIError(
          `API 请求失败: ${response.status} ${response.statusText}`,
          response.status,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new APIError('无法读取响应流');
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
              // 忽略解析错误（SSE 协议的一部分）
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      console.error('[Chat] 请求错误:', error);
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
    return this.requestWithRetry(async () => {
      try {
        const response = await fetch(this.getApiUrl(), {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
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
                    image_url: { url: `data:image/png;base64,${imageBase64}` },
                  },
                  {
                    type: 'text',
                    text: '请将这张PDF页面的内容翻译成中文，只返回翻译结果。',
                  },
                ],
              },
            ],
            temperature: TRANSLATION_CONFIG.TEMPERATURE,
            stream: false,
            max_tokens: TRANSLATION_CONFIG.MAX_TOKENS,
          }),
          signal: AbortSignal.timeout(API_CONFIG.DEFAULT_TIMEOUT),
        });

        if (!response.ok) {
          const isRetryable = response.status === 429 || response.status >= 500;
          throw new APIError(
            `视觉翻译 API 请求失败: ${response.status} ${response.statusText}`,
            response.status,
            isRetryable,
          );
        }

        const data = await response.json();
        const translation = data.choices[0].message.content.trim();

        return { extractedText: '', translation };
      } catch (error) {
        if (error instanceof APIError) throw error;
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          throw new APIError('视觉翻译请求超时，请重试', undefined, true);
        }
        console.error('[VisionTranslation] 请求错误:', error);
        throw new APIError('视觉翻译失败，请检查网络连接', undefined, true);
      }
    });
  }
}

// 创建服务实例
export const createDeepSeekService = (config: TranslationConfig): DeepSeekService => {
  return new DeepSeekService(config);
};
