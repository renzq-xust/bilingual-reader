// 应用配置常量，消除魔法数字

/** PDF 渲染相关配置 */
export const PDF_CONFIG = {
  /** 默认缩放比例 */
  DEFAULT_SCALE: 1.5,
  /** 最小缩放比例 */
  MIN_SCALE: 0.5,
  /** 最大缩放比例 */
  MAX_SCALE: 3,
  /** 缩放步进 */
  SCALE_STEP: 0.25,
  /** 视觉翻译渲染分辨率（较高分辨率用于 OCR） */
  TRANSLATION_RENDER_SCALE: 2,
} as const;

/** API 调用相关配置 */
export const API_CONFIG = {
  /** 默认超时时间（毫秒） */
  DEFAULT_TIMEOUT: 60000,
  /** 最大重试次数 */
  MAX_RETRIES: 3,
  /** 重试基础延迟（毫秒） */
  RETRY_BASE_DELAY: 1000,
  /** 重试最大延迟（毫秒） */
  RETRY_MAX_DELAY: 10000,
} as const;

/** 聊天相关配置 */
export const CHAT_CONFIG = {
  /** 保留的最大历史消息数 */
  MAX_HISTORY_MESSAGES: 10,
  /** 流式响应缓冲区大小 */
  STREAM_BUFFER_SIZE: 1024,
} as const;

/** UI 相关配置 */
export const UI_CONFIG = {
  /** 句子高亮持续时间（毫秒） */
  HIGHLIGHT_DURATION: 3000,
  /** 翻译进度提示消失时间（毫秒） */
  PROGRESS_FADE_DELAY: 3000,
} as const;

/** 翻译相关配置 */
export const TRANSLATION_CONFIG = {
  /** 翻译温度（越低越确定性） */
  TEMPERATURE: 0.3,
  /** 对话温度 */
  CHAT_TEMPERATURE: 0.7,
  /** 视觉翻译最大 token 数 */
  MAX_TOKENS: 4096,
} as const;
