import { create } from 'zustand';
import { Document, ChatMessage, TranslationConfig, Sentence } from '../types';

// 视觉翻译结果（内联定义，待 types 文件解锁后迁移）
export interface VisionTranslationResult {
  extractedText: string;
  translation: string;
}

interface AppState {
  // 文档状态
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  
  // 当前页码
  currentPage: number;
  setCurrentPage: (page: number) => void;
  
  // 视觉翻译结果 (pageNum -> result)
  // 按文档 ID 隔离，切换文档时自动保留
  visionTranslations: Map<number, VisionTranslationResult>;
  setVisionTranslation: (pageNum: number, result: VisionTranslationResult) => void;
  clearVisionTranslations: () => void;
  
  // 已翻译的页面集合（从组件 state 提升到全局 store）
  translatedPages: Set<number>;
  markPageAsTranslated: (pageNum: number) => void;
  clearTranslatedPages: () => void;
  
  // 当前段落索引
  currentParagraphIndex: number;
  setCurrentParagraphIndex: (index: number) => void;
  
  // 选中的句子
  selectedSentence: Sentence | null;
  setSelectedSentence: (sentence: Sentence | null) => void;
  
  // 高亮的句子ID
  highlightedSentenceId: string | null;
  setHighlightedSentenceId: (id: string | null) => void;
  
  // 加载状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // 错误信息
  error: string | null;
  setError: (error: string | null) => void;
  
  // 聊天消息
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;
  
  // 翻译配置
  translationConfig: TranslationConfig;
  setTranslationConfig: (config: Partial<TranslationConfig>) => void;
  
  // AI对话窗口显示状态
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  
  // 设置显示状态
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // 文档状态
  document: null,
  setDocument: (doc) => set((state) => {
    // 切换文档时，清理旧文档的翻译状态
    if (doc && state.document && doc.id !== state.document.id) {
      return {
        document: doc,
        visionTranslations: new Map(),
        translatedPages: new Set(),
        currentPage: 1,
        selectedSentence: null,
        highlightedSentenceId: null,
      };
    }
    return { document: doc };
  }),
  
  // 当前页码
  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),
  
  // 视觉翻译结果
  visionTranslations: new Map(),
  setVisionTranslation: (pageNum, result) => set((state) => {
    const newMap = new Map(state.visionTranslations);
    newMap.set(pageNum, result);
    return { visionTranslations: newMap };
  }),
  clearVisionTranslations: () => set({ visionTranslations: new Map() }),
  
  // 已翻译页面（从组件提升到全局）
  translatedPages: new Set(),
  markPageAsTranslated: (pageNum) => set((state) => {
    const newSet = new Set(state.translatedPages);
    newSet.add(pageNum);
    return { translatedPages: newSet };
  }),
  clearTranslatedPages: () => set({ translatedPages: new Set() }),
  
  // 当前段落索引
  currentParagraphIndex: 0,
  setCurrentParagraphIndex: (index) => set({ currentParagraphIndex: index }),
  
  // 选中的句子
  selectedSentence: null,
  setSelectedSentence: (sentence) => set({ selectedSentence: sentence }),
  
  // 高亮的句子ID
  highlightedSentenceId: null,
  setHighlightedSentenceId: (id) => set({ highlightedSentenceId: id }),
  
  // 加载状态
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  // 错误信息
  error: null,
  setError: (error) => set({ error }),
  
  // 聊天消息
  chatMessages: [],
  addChatMessage: (message) => set((state) => ({ 
    chatMessages: [...state.chatMessages, message] 
  })),
  clearChatMessages: () => set({ chatMessages: [] }),
  
  // 翻译配置
  translationConfig: {
    apiKey: '',
    model: 'deepseek-flash',
    baseUrl: 'https://api.deepseek.com',
    targetLanguage: 'zh-CN',
  },
  setTranslationConfig: (config) => set((state) => ({
    translationConfig: { ...state.translationConfig, ...config }
  })),
  
  // AI对话窗口显示状态
  isChatOpen: false,
  setIsChatOpen: (open) => set({ isChatOpen: open }),
  
  // 设置显示状态
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
}));
