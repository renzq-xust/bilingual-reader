import { create } from 'zustand';
import { Document, ChatMessage, TranslationConfig, Sentence } from '../types';

interface AppState {
  // 文档状态
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  
  // 当前页码
  currentPage: number;
  setCurrentPage: (page: number) => void;
  
  // 视觉翻译结果 (pageNum -> { extractedText, translation })
  visionTranslations: Map<number, { extractedText: string; translation: string }>;
  setVisionTranslation: (pageNum: number, result: { extractedText: string; translation: string }) => void;
  clearVisionTranslations: () => void;
  
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
  setDocument: (doc) => set({ document: doc }),
  
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
    model: 'deepseek-flash',  // 默认使用 Flash 模型（支持视觉）
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
