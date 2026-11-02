import { Languages, Loader2 } from 'lucide-react';
import { Sentence } from '../types';

interface TranslationPanelProps {
  currentPage: number;
  translationProgress: string;
  isTranslated: boolean;
  hasVisionTranslation: boolean;
  visionTranslation?: { extractedText: string; translation: string };
  sentences: Sentence[];
  selectedSentence: Sentence | null;
  highlightedSentenceId: string | null;
  isTranslating: boolean;
  onSentenceClick: (sentence: Sentence) => void;
  onTranslateSentence: (sentence: Sentence) => void;
}

/**
 * 翻译面板组件 - 显示右侧翻译结果
 */
export function TranslationPanel({
  currentPage,
  translationProgress,
  isTranslated,
  hasVisionTranslation,
  visionTranslation,
  sentences,
  selectedSentence,
  highlightedSentenceId,
  isTranslating,
  onSentenceClick,
  onTranslateSentence,
}: TranslationPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 border-l border-gray-700">
      {/* 面板头部 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium text-green-400 bg-green-500/20 px-2 py-1 rounded">
          第 {currentPage} 页翻译
        </span>
        
        {/* 翻译进度 */}
        {translationProgress && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{translationProgress}</span>
          </div>
        )}
        
        {/* 已翻译标记 */}
        {isTranslated && !translationProgress && (
          <span className="text-xs text-gray-500">✓ 已翻译</span>
        )}
      </div>
      
      {/* 翻译内容 */}
      {hasVisionTranslation && visionTranslation ? (
        /* 视觉翻译结果 */
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
              <Languages className="w-3 h-3" />
              第 {currentPage} 页翻译
            </h4>
            <div className="bg-green-500/10 rounded-lg p-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {visionTranslation.translation}
            </div>
          </div>
        </div>
      ) : sentences.length > 0 ? (
        /* 句子级别翻译 */
        <div className="space-y-4">
          {sentences.map((sentence) => (
            <div
              key={sentence.id}
              className={`
                p-3 rounded-lg cursor-pointer transition-all duration-200
                ${selectedSentence?.id === sentence.id 
                  ? 'bg-green-500/20 border-l-3 border-green-500' 
                  : 'hover:bg-gray-700/50'
                }
                ${highlightedSentenceId === sentence.id ? 'sentence-highlight' : ''}
              `}
              onClick={() => onSentenceClick(sentence)}
            >
              {/* 英文原文 */}
              <p className="text-sm text-gray-400 mb-2 italic">
                {sentence.text}
              </p>
              
              {/* 中文翻译 */}
              {sentence.translation ? (
                <p className="text-gray-200 leading-relaxed">
                  {sentence.translation}
                </p>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTranslateSentence(sentence);
                  }}
                  disabled={isTranslating}
                  className="text-sm text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      翻译中...
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4" />
                      点击翻译
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* 空状态 */
        <div className="text-center text-gray-500 mt-8">
          <p>点击翻译按钮开始视觉翻译</p>
          <p className="text-sm mt-2">将使用 AI 视觉模型识别并翻译页面内容</p>
        </div>
      )}
    </div>
  );
}
