import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Loader2, X, Bot, User } from 'lucide-react';
import { useAppStore } from '../store';
import { createDeepSeekService } from '../services/deepseek';
import { ChatMessage } from '../types';
import { CHAT_CONFIG } from '../utils/config';
import { Toast } from './ConfirmDialog';

export function ChatPanel() {
  const { 
    chatMessages, 
    addChatMessage, 
    clearChatMessages, 
    translationConfig,
    setIsChatOpen,
    selectedSentence,
    document: doc,
    currentPage,
    visionTranslations,
  } = useAppStore();
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; isVisible: boolean }>({
    message: '', type: 'info', isVisible: false,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef('');

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type, isVisible: true });
  }, []);

  // 获取当前页的翻译内容作为上下文
  const getPageContext = () => {
    if (!doc?.pdfPages) return null;
    const pageInfo = doc.pdfPages[currentPage - 1];
    if (!pageInfo) return null;
    
    const visionTranslation = visionTranslations.get(currentPage);
    if (visionTranslation?.translation) {
      return { pageNumber: currentPage, translation: visionTranslation.translation };
    }
    
    if (pageInfo.sentences.length > 0) {
      const text = pageInfo.sentences.map(s => s.text).join(' ');
      const translation = pageInfo.sentences.map(s => s.translation).filter(Boolean).join(' ');
      return { pageNumber: currentPage, text, translation };
    }
    
    return null;
  };

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!translationConfig.apiKey) {
      showToast('请先在设置中配置 API Key', 'warning');
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      context: selectedSentence ? { sentence: selectedSentence } : undefined,
    };

    addChatMessage(userMessage);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    streamingRef.current = '';

    const historyMessages = [...chatMessages, userMessage]
      .slice(-CHAT_CONFIG.MAX_HISTORY_MESSAGES)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const pageContext = getPageContext();
    
    let finalContent = userMessage.content;
    if (pageContext) {
      finalContent = `[当前阅读内容 - 第 ${pageContext.pageNumber} 页]\n${pageContext.translation || pageContext.text || ''}\n\n[用户问题]\n${userMessage.content}`;
    } else if (selectedSentence) {
      finalContent = `当前阅读的英文句子: "${selectedSentence.text}"\n中文翻译: "${selectedSentence.translation || '暂无翻译'}"\n\n用户问题: ${userMessage.content}`;
    }
    
    historyMessages[historyMessages.length - 1].content = finalContent;

    const service = createDeepSeekService(translationConfig);

    await service.chat(
      historyMessages,
      (chunk) => {
        streamingRef.current += chunk;
        setStreamingContent(prev => prev + chunk);
      },
      () => {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: streamingRef.current,
          timestamp: Date.now(),
        };
        addChatMessage(assistantMessage);
        setStreamingContent('');
        setIsLoading(false);
      },
      (error) => {
        console.error('[ChatPanel] 对话请求错误:', error);
        
        if (streamingRef.current.length > 0) {
          const partialMessage: ChatMessage = {
            id: `msg-${Date.now()}-partial`,
            role: 'assistant',
            content: streamingRef.current + '\n\n[⚠️ 响应中断，请重试]',
            timestamp: Date.now(),
          };
          addChatMessage(partialMessage);
        } else {
          showToast('对话请求失败，请检查网络和 API 配置', 'error');
        }
        
        setStreamingContent('');
        setIsLoading(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    '解释这句话',
    '分析语法结构',
    '有什么关键词',
    '总结这段内容',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <h3 className="font-medium text-gray-200">AI 助手</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChatMessages}
            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
            title="清空对话"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsChatOpen(false)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">你好！我是 AI 助手</p>
            <p className="text-xs mt-1">有什么可以帮助你的？</p>
            
            {selectedSentence && (
              <div className="mt-4 p-3 bg-gray-700/50 rounded-lg text-left">
                <p className="text-xs text-gray-400 mb-1">当前选中的句子:</p>
                <p className="text-sm text-gray-200">{selectedSentence.text}</p>
              </div>
            )}
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
            )}
            <div
              className={`
                max-w-[80%] rounded-2xl px-4 py-2
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
                }
              `}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              
              {msg.context?.sentence && (
                <div className="mt-2 pt-2 border-t border-gray-600 text-xs opacity-75">
                  <p>参考: {msg.context.sentence.text.slice(0, 50)}...</p>
                </div>
              )}
              
              <p className="text-xs opacity-50 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {/* 流式响应 */}
        {isLoading && streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-700 text-gray-200">
              <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
            </div>
          </div>
        )}

        {/* 加载指示器 */}
        {isLoading && !streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="rounded-2xl px-4 py-2 bg-gray-700">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快捷提问 */}
      {selectedSentence && (
        <div className="px-4 py-2 border-t border-gray-700">
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  inputRef.current?.focus();
                }}
                className="text-xs px-3 py-1 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toast 通知 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}
