import { 
  ChevronLeft, 
  ChevronRight, 
  Languages, 
  Loader2,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Square,
  List,
} from 'lucide-react';
import { Document } from '../types';

interface ReaderToolbarProps {
  document: Document;
  currentPage: number;
  totalPages: number;
  scale: number;
  isTranslating: boolean;
  showTranslateMenu: boolean;
  showToc: boolean;
  hasToc: boolean;
  translationProgress: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onTranslateMenuToggle: () => void;
  onTranslateCurrentPage: () => void;
  onTranslateAllPages: () => void;
  onOpenTocForChapterTranslate: () => void;
  onToggleToc: () => void;
  onCancelTranslation: () => void;
}

export function ReaderToolbar({
  document: doc,
  currentPage,
  totalPages,
  scale,
  isTranslating,
  showTranslateMenu,
  showToc,
  hasToc,
  translationProgress,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPrevPage,
  onNextPage,
  onTranslateMenuToggle,
  onTranslateCurrentPage,
  onTranslateAllPages,
  onOpenTocForChapterTranslate,
  onToggleToc,
  onCancelTranslation,
}: ReaderToolbarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-4">
        <BookOpen className="w-5 h-5 text-blue-400" />
        <span className="text-sm text-gray-300">{doc.title}</span>
        
        {/* 翻译进度 */}
        {translationProgress && (
          <div className="flex items-center gap-2 text-xs text-blue-400 ml-4">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{translationProgress}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {/* 目录按钮 */}
        <button
          onClick={onToggleToc}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            showToc
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title={hasToc ? '目录 / 按章节翻译' : '目录（当前文档无大纲）'}
        >
          <List className="w-4 h-4" />
          <span className="text-sm font-medium">目录</span>
        </button>

        {/* 翻译按钮 */}
        <div className="relative" data-translate-menu>
          <button
            onClick={onTranslateMenuToggle}
            disabled={isTranslating}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isTranslating
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } disabled:opacity-50`}
            title="翻译"
          >
            {isTranslating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Languages className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">翻译</span>
          </button>
          
          {/* 翻译菜单 */}
          {showTranslateMenu && !isTranslating && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-2 z-50">
              <button
                onClick={onTranslateCurrentPage}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                翻译当前页
              </button>
              <button
                onClick={onOpenTocForChapterTranslate}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                按章节翻译…
              </button>
              <button
                onClick={onTranslateAllPages}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                翻译所有页
              </button>
            </div>
          )}
          
          {/* 取消翻译按钮 */}
          {isTranslating && (
            <button
              onClick={onCancelTranslation}
              className="absolute top-full right-0 mt-2 px-3 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 flex items-center gap-2 z-50"
            >
              <Square className="w-4 h-4" />
              <span className="text-sm">取消</span>
            </button>
          )}
        </div>
        
        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <button onClick={onZoomOut} className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600" title="缩小">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={onZoomIn} className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600" title="放大">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={onResetZoom} className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600" title="重置缩放">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        
        {/* 翻页按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevPage}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 min-w-[80px] text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
