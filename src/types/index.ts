// 句子类型定义
export interface Sentence {
  id: string;
  text: string;
  translation: string;
  index: number;
}

// 段落类型定义
export interface Paragraph {
  id: string;
  sentences: Sentence[];
  pageIndex?: number;
}

// PDF页面信息
export interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  textContent: string;
  sentences: Sentence[];
}

// 文档类型定义
export interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'epub';
  paragraphs: Paragraph[];
  pdfPages?: PDFPageInfo[];  // PDF页面信息（方案A使用）
  pdfFile?: File;  // PDF文件对象（用于渲染）
  totalPages?: number;
  currentPage?: number;
}

// 聊天消息类型定义
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: {
    sentence?: Sentence;
    paragraph?: Paragraph;
  };
}

// 翻译配置
export interface TranslationConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  targetLanguage: string;
}

// 阅读器状态
export interface ReaderState {
  document: Document | null;
  currentParagraphIndex: number;
  selectedSentenceId: string | null;
  highlightedSentenceId: string | null;
  isLoading: boolean;
  error: string | null;
}

// 应用配置
export interface AppConfig {
  translation: TranslationConfig;
  theme: 'light' | 'dark';
  fontSize: number;
  syncScroll: boolean;
}
