import { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore } from '../store';
import { Sentence, Paragraph } from '../types';
import { createDeepSeekService } from '../services/deepseek';
import { 
  ChevronLeft, 
  ChevronRight, 
  Languages, 
  Loader2,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Play,
  Square
} from 'lucide-react';

// 配置 PDF.js worker
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

export function BilingualReader() {
  const { 
    document, 
    currentParagraphIndex, 
    setCurrentParagraphIndex,
    selectedSentence,
    setSelectedSentence,
    highlightedSentenceId,
    setHighlightedSentenceId,
    translationConfig,
    setDocument,
    currentPage,
    setCurrentPage,
    visionTranslations,
    setVisionTranslation,
  } = useAppStore();
  
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);  // 是否正在翻译全部
  const [scale, setScale] = useState(1.5);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [translatedPages, setTranslatedPages] = useState<Set<number>>(new Set());  // 已翻译的页面
  const [translationProgress, setTranslationProgress] = useState('');  // 翻译进度
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);  // 显示翻译菜单
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);  // PDF是否已加载
  const abortTranslationRef = useRef<boolean>(false);  // 取消翻译标志
  
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const arrayBufferRef = useRef<ArrayBuffer | null>(null);  // 缓存arrayBuffer

  // 初始化PDF文档
  useEffect(() => {
    if (!document?.pdfFile) return;

    console.log('开始初始化PDF文档:', document.title);
    setRenderError(null);
    
    // 重置缓存（新文档时）
    arrayBufferRef.current = null;
    pdfDocRef.current = null;
    setIsPdfLoaded(false);  // 重置加载状态

    const initPDF = async () => {
      try {
        // 缓存arrayBuffer，避免多次读取
        if (!arrayBufferRef.current) {
          arrayBufferRef.current = await document.pdfFile.arrayBuffer();
          console.log('PDF文件读取完成，大小:', arrayBufferRef.current.byteLength, 'bytes');
        }
        
        const pdf = await pdfjsLib.getDocument({ data: arrayBufferRef.current }).promise;
        console.log('PDF文档加载成功，总页数:', pdf.numPages);
        
        pdfDocRef.current = pdf;
        setIsPdfLoaded(true);  // 触发重新渲染
        setCurrentPage(1);
        setRenderError(null);
      } catch (error) {
        console.error('PDF初始化失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setRenderError(`PDF初始化失败: ${errorMessage}`);
      }
    };

    initPDF();
  }, [document?.pdfFile, document?.id]);  // 使用document.id而不是title，确保新文档时重新初始化

  // 渲染当前页面
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !pdfCanvasRef.current) {
      console.log('PDF文档或Canvas未就绪');
      return;
    }

    console.log('开始渲染页面:', pageNum, '缩放:', scale);
    setIsRendering(true);
    setRenderError(null);
    
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      console.log('页面尺寸:', viewport.width, 'x', viewport.height);
      
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('无法获取Canvas上下文');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      console.log('开始渲染...');
      await page.render(renderContext).promise;
      console.log('页面渲染完成');
    } catch (error) {
      console.error('页面渲染失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setRenderError(`页面渲染失败: ${errorMessage}`);
    } finally {
      setIsRendering(false);
    }
  }, [scale]);

  // 页面变化时重新渲染
  useEffect(() => {
    if (isPdfLoaded && pdfDocRef.current && pdfCanvasRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, scale, renderPage, isPdfLoaded]);

  // 将 PDF 页面渲染为 base64 图片
  const renderPageToBase64 = async (pageNum: number): Promise<string> => {
    if (!pdfDocRef.current) throw new Error('PDF文档未加载');
    
    const page = await pdfDocRef.current.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });  // 使用较高分辨率以便OCR
    
    const canvas = window.document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建Canvas上下文');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    // 转换为 base64（去掉 data:image/png;base64, 前缀）
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  };

  // 翻译单个页面（直接使用视觉模型）
  const translatePage = async (pageNum: number, service: any) => {
    console.log(`开始翻译页面 ${pageNum}...`);
    setTranslationProgress(`正在识别页面 ${pageNum}...`);
    
    try {
      // 渲染页面为图片
      const imageBase64 = await renderPageToBase64(pageNum);
      console.log(`页面 ${pageNum} 图片生成完成`);
      
      // 使用视觉模型 OCR + 翻译
      const result = await service.translatePageImage(imageBase64, translationConfig.targetLanguage);
      console.log(`页面 ${pageNum} 视觉翻译完成`);
      
      // 保存翻译结果到全局 store
      setVisionTranslation(pageNum, result);
    } catch (err) {
      console.error(`页面 ${pageNum} 翻译失败:`, err);
      throw err;
    }
  };

  // 翻译当前页面
  const handleTranslateCurrentPage = useCallback(async () => {
    if (!document?.pdfPages) {
      console.warn('没有PDF页面数据');
      return;
    }
    if (!translationConfig.apiKey) {
      alert('请先在设置中配置 API Key');
      console.warn('API Key 未配置');
      return;
    }
    
    console.log('翻译配置:', { baseUrl: translationConfig.baseUrl, model: translationConfig.model });
    
    // 检查是否已经翻译过
    if (translatedPages.has(currentPage)) {
      if (!confirm('当前页面已翻译，是否重新翻译？')) {
        return;
      }
    }
    
    console.log('开始翻译页面:', currentPage);
    setIsTranslating(true);
    setTranslationProgress('正在翻译...');
    abortTranslationRef.current = false;
    
    try {
      const service = createDeepSeekService(translationConfig);
      await translatePage(currentPage, service);
      
      // 标记为已翻译
      setTranslatedPages(prev => new Set([...prev, currentPage]));
      setTranslationProgress('翻译完成');
      console.log('页面翻译完成:', currentPage);
    } catch (error) {
      if (error instanceof Error && error.message === '翻译已取消') {
        setTranslationProgress('翻译已取消');
      } else {
        console.error('页面翻译失败:', error);
        setTranslationProgress('翻译失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }
    } finally {
      setIsTranslating(false);
      setTimeout(() => {
        setTranslationProgress('');
      }, 3000);
    }
  }, [currentPage, document, translationConfig, translatedPages]);

  // 翻译所有页面
  const handleTranslateAllPages = useCallback(async () => {
    if (!document?.pdfPages) return;
    if (!translationConfig.apiKey) {
      alert('请先在设置中配置 API Key');
      return;
    }
    
    const totalPages = document.pdfPages.length;
    const untranslatedPages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(pageNum => !translatedPages.has(pageNum));
    
    if (untranslatedPages.length === 0) {
      if (!confirm('所有页面都已翻译，是否重新翻译全部？')) {
        return;
      }
    } else {
      if (!confirm(`共有 ${totalPages} 页，其中 ${untranslatedPages.length} 页未翻译。开始翻译？`)) {
        return;
      }
    }
    
    console.log('开始翻译所有页面...');
    setIsTranslating(true);
    setIsTranslatingAll(true);
    abortTranslationRef.current = false;
    
    try {
      const service = createDeepSeekService(translationConfig);
      const pagesToTranslate = untranslatedPages.length > 0 ? untranslatedPages : Array.from({ length: totalPages }, (_, i) => i + 1);
      
      for (const pageNum of pagesToTranslate) {
        if (abortTranslationRef.current) {
          setTranslationProgress('翻译已取消');
          break;
        }
        
        setTranslationProgress(`正在翻译... 第 ${pageNum}/${totalPages} 页`);
        
        try {
          await translatePage(pageNum, service);
          setTranslatedPages(prev => new Set([...prev, pageNum]));
        } catch (err) {
          console.error(`页面 ${pageNum} 翻译失败:`, err);
        }
      }
      
      if (!abortTranslationRef.current) {
        setTranslationProgress('全部翻译完成');
      }
      console.log('翻译完成');
      
      // 更新文档状态
      if (document) {
        setDocument({ ...document });
      }
    } catch (error) {
      console.error('翻译失败:', error);
      setTranslationProgress('翻译失败');
    } finally {
      setIsTranslating(false);
      setIsTranslatingAll(false);
      setTimeout(() => {
        setTranslationProgress('');
      }, 3000);
    }
  }, [document, translationConfig, translatedPages, setDocument]);

  // 取消翻译
  const handleCancelTranslation = useCallback(() => {
    abortTranslationRef.current = true;
    setTranslationProgress('正在取消...');
  }, []);

  // 页面变化时自动翻译（仅当未翻译过时）
  useEffect(() => {
    if (isPdfLoaded && document?.pdfPages && !isTranslatingAll) {
      // 只在页面未翻译时自动翻译
      if (!translatedPages.has(currentPage)) {
        handleTranslateCurrentPage();
      }
    }
  }, [currentPage, handleTranslateCurrentPage, document?.pdfPages, isTranslatingAll, translatedPages, isPdfLoaded]);

  // 点击外部关闭翻译菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-translate-menu]')) {
        setShowTranslateMenu(false);
      }
    };

    if (showTranslateMenu) {
      window.document.addEventListener('click', handleClickOutside);
    }

    return () => {
      window.document.removeEventListener('click', handleClickOutside);
    };
  }, [showTranslateMenu]);

  // 句子点击处理
  const handleSentenceClick = useCallback((sentence: Sentence) => {
    if (selectedSentence?.id === sentence.id) {
      setSelectedSentence(null);
      setHighlightedSentenceId(null);
    } else {
      setSelectedSentence(sentence);
      setHighlightedSentenceId(sentence.id);
      
      setTimeout(() => {
        setHighlightedSentenceId(null);
      }, 3000);
    }
  }, [selectedSentence, setSelectedSentence, setHighlightedSentenceId]);

  // 翻译单个句子
  const handleTranslate = useCallback(async (sentence: Sentence) => {
    if (!translationConfig.apiKey) {
      alert('请先在设置中配置 API Key');
      return;
    }

    setIsTranslating(true);
    try {
      const service = createDeepSeekService(translationConfig);
      const translation = await service.translate(sentence.text);
      
      if (document) {
        const newDoc = { ...document };
        const targetParagraph = newDoc.paragraphs.find(p => 
          p.sentences.some(s => s.id === sentence.id)
        );
        const targetSentence = targetParagraph?.sentences.find(s => s.id === sentence.id);
        if (targetSentence) {
          targetSentence.translation = translation;
        }
        setDocument(newDoc);
      }
    } catch (error) {
      console.error('翻译失败:', error);
    } finally {
      setIsTranslating(false);
    }
  }, [translationConfig, document, setDocument]);

  // 获取当前页面的翻译文本
  const getCurrentPageTranslation = () => {
    if (!document?.pdfPages) return null;
    const pageInfo = document.pdfPages[currentPage - 1];
    if (!pageInfo) return null;
    
    return {
      pageNumber: currentPage,
      sentences: pageInfo.sentences,
      hasVisionTranslation: visionTranslations.has(currentPage),
    };
  };

  const pageTranslation = getCurrentPageTranslation();

  // 翻页
  const goToPage = (page: number) => {
    if (page >= 1 && page <= (document?.totalPages || 1)) {
      setCurrentPage(page);
    }
  };

  // 缩放
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.5);
  };

  if (!document) return null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <span className="text-sm text-gray-300">
            {document.title}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 翻译按钮 */}
          <div className="relative" data-translate-menu>
            <button
              onClick={() => setShowTranslateMenu(!showTranslateMenu)}
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
              <div className="absolute top-full right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-2 z-50">
                <button
                  onClick={() => {
                    setShowTranslateMenu(false);
                    handleTranslateCurrentPage();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  翻译当前页
                </button>
                <button
                  onClick={() => {
                    setShowTranslateMenu(false);
                    handleTranslateAllPages();
                  }}
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
                onClick={handleCancelTranslation}
                className="absolute top-full right-0 mt-2 px-3 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 flex items-center gap-2 z-50"
              >
                <Square className="w-4 h-4" />
                <span className="text-sm">取消</span>
              </button>
            )}
          </div>
          
          {/* 缩放控制 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="重置缩放"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          
          {/* 翻页按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400 min-w-[80px] text-center">
              {currentPage} / {document.totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= (document.totalPages || 1)}
              className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 双语对照阅读区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧 - PDF渲染 */}
        <div className="flex-1 overflow-auto bg-gray-900 p-6 flex justify-center">
          <div className="relative min-h-full flex items-center justify-center">
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            )}
            
            {renderError ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-200 mb-2">PDF渲染失败</h3>
                <p className="text-sm text-gray-400 mb-4">{renderError}</p>
                <p className="text-xs text-gray-500">请检查浏览器控制台获取详细错误信息</p>
              </div>
            ) : !isPdfLoaded ? (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <Loader2 className="w-16 h-16 text-blue-400 animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-gray-200 mb-2">正在加载PDF...</h3>
                <p className="text-sm text-gray-400">请稍候</p>
              </div>
            ) : (
              <canvas
                ref={pdfCanvasRef}
                className="shadow-2xl bg-white"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            )}
          </div>
        </div>

        {/* 右侧 - 翻译文本 */}
        <div 
          ref={rightPanelRef}
          className="w-[45%] overflow-y-auto p-6 border-l border-gray-700"
        >
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
            {translatedPages.has(currentPage) && !translationProgress && (
              <span className="text-xs text-gray-500">✓ 已翻译</span>
            )}
          </div>
          
          {pageTranslation ? (
            <div className="space-y-4">
              {/* 检查是否有视觉翻译结果 */}
              {visionTranslations.has(currentPage) ? (
                <div className="space-y-4">
                  {/* 只显示中文翻译 */}
                  <div>
                    <h4 className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                      <Languages className="w-3 h-3" />
                      第 {currentPage} 页翻译
                    </h4>
                    <div className="bg-green-500/10 rounded-lg p-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {visionTranslations.get(currentPage)?.translation}
                    </div>
                  </div>
                </div>
              ) : pageTranslation.sentences.length > 0 ? (
                // 传统句子级别翻译
                pageTranslation.sentences.map((sentence) => (
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
                    onClick={() => handleSentenceClick(sentence)}
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
                          handleTranslate(sentence);
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
                ))
              ) : (
                // 没有句子，显示提示
                <div className="text-center text-gray-500 mt-8">
                  <p>点击翻译按钮开始视觉翻译</p>
                  <p className="text-sm mt-2">将使用 AI 视觉模型识别并翻译页面内容</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-8">
              <p>暂无翻译内容</p>
              <p className="text-sm mt-2">点击翻译按钮开始翻译</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
