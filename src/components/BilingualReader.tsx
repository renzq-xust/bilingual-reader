import { useRef, useEffect, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useAppStore } from '../store';
import { Sentence } from '../types';
import { createDeepSeekService } from '../services/deepseek';
import { getPDFLib } from '../utils/pdfWorker';
import { PDF_CONFIG, UI_CONFIG } from '../utils/config';
import { ReaderToolbar } from './ReaderToolbar';
import { PDFViewer } from './PDFViewer';
import { TranslationPanel } from './TranslationPanel';
import { TocPanel } from './TocPanel';
import { ConfirmDialog, Toast } from './ConfirmDialog';

export function BilingualReader() {
  const { 
    document: doc, 
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
    translatedPages,
    markPageAsTranslated,
  } = useAppStore();
  
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [scale, setScale] = useState<number>(PDF_CONFIG.DEFAULT_SCALE);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [translationProgress, setTranslationProgress] = useState('');
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);
  const abortTranslationRef = useRef<boolean>(false);
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // Toast 通知状态
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    isVisible: boolean;
  }>({ message: '', type: 'info', isVisible: false });
  
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // 显示 Toast 通知
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type, isVisible: true });
  }, []);

  // 初始化PDF文档
  useEffect(() => {
    if (!doc?.pdfFile) return;

    console.log('[BilingualReader] 开始初始化PDF文档:', doc.title);
    setRenderError(null);
    setIsPdfLoaded(false);

    const initPDF = async () => {
      try {
        // 每次都从 File 重新读取 ArrayBuffer
        // 因为 parser.ts 中的 getDocument 调用会 transfer 原始 buffer，使其变为 detached 状态
        const arrayBuffer = await doc.pdfFile!.arrayBuffer();
        
        console.log('[BilingualReader] PDF文件读取完成，大小:', arrayBuffer.byteLength, 'bytes');
        
        const pdfjsLib = getPDFLib();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('[BilingualReader] PDF文档加载成功，总页数:', pdf.numPages);
        
        pdfDocRef.current = pdf;
        setIsPdfLoaded(true);
        setCurrentPage(1);
        setRenderError(null);
      } catch (error) {
        console.error('[BilingualReader] PDF初始化失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setRenderError(`PDF初始化失败: ${errorMessage}`);
      }
    };

    initPDF();
  }, [doc?.pdfFile, doc?.id, setCurrentPage]);

  // 渲染当前页面
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !pdfCanvasRef.current) {
      console.log('[BilingualReader] PDF文档或Canvas未就绪');
      return;
    }

    console.log('[BilingualReader] 开始渲染页面:', pageNum, '缩放:', scale);
    setIsRendering(true);
    setRenderError(null);
    
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('无法获取Canvas上下文');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      console.log('[BilingualReader] 页面渲染完成');
    } catch (error) {
      console.error('[BilingualReader] 页面渲染失败:', error);
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
    const viewport = page.getViewport({ scale: PDF_CONFIG.TRANSLATION_RENDER_SCALE });
    
    const canvas = window.document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建Canvas上下文');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  };

  // 翻译单个页面（直接使用视觉模型）
  const translatePage = async (pageNum: number, service: ReturnType<typeof createDeepSeekService>) => {
    console.log(`[BilingualReader] 开始翻译页面 ${pageNum}...`);
    setTranslationProgress(`正在识别页面 ${pageNum}...`);
    
    try {
      const imageBase64 = await renderPageToBase64(pageNum);
      console.log(`[BilingualReader] 页面 ${pageNum} 图片生成完成`);
      
      const result = await service.translatePageImage(imageBase64, translationConfig.targetLanguage);
      console.log(`[BilingualReader] 页面 ${pageNum} 视觉翻译完成`);
      
      setVisionTranslation(pageNum, result);
    } catch (err) {
      console.error(`[BilingualReader] 页面 ${pageNum} 翻译失败:`, err);
      throw err;
    }
  };

  // 翻译当前页面（核心逻辑）
  const doTranslateCurrentPage = useCallback(async () => {
    console.log('[BilingualReader] 开始翻译页面:', currentPage);
    setIsTranslating(true);
    setTranslationProgress('正在翻译...');
    abortTranslationRef.current = false;
    
    try {
      const service = createDeepSeekService(translationConfig);
      await translatePage(currentPage, service);
      
      markPageAsTranslated(currentPage);
      setTranslationProgress('翻译完成');
      showToast('页面翻译完成', 'success');
    } catch (error) {
      if (error instanceof Error && error.message === '翻译已取消') {
        setTranslationProgress('翻译已取消');
      } else {
        console.error('[BilingualReader] 页面翻译失败:', error);
        const errMsg = error instanceof Error ? error.message : '未知错误';
        setTranslationProgress('翻译失败: ' + errMsg);
        showToast('翻译失败: ' + errMsg, 'error');
      }
    } finally {
      setIsTranslating(false);
      setTimeout(() => {
        setTranslationProgress('');
      }, UI_CONFIG.PROGRESS_FADE_DELAY);
    }
  }, [currentPage, translationConfig, markPageAsTranslated, showToast]);

  // 翻译当前页面（带确认检查）
  const handleTranslateCurrentPage = useCallback(async () => {
    if (!doc?.pdfPages) {
      console.warn('[BilingualReader] 没有PDF页面数据');
      return;
    }
    if (!translationConfig.apiKey) {
      showToast('请先在设置中配置 API Key', 'warning');
      return;
    }
    
    // 检查是否已经翻译过
    if (translatedPages.has(currentPage)) {
      setConfirmDialog({
        isOpen: true,
        title: '重新翻译',
        message: '当前页面已翻译，是否重新翻译？',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          doTranslateCurrentPage();
        },
      });
      return;
    }
    
    doTranslateCurrentPage();
  }, [currentPage, doc, translationConfig, translatedPages, showToast, doTranslateCurrentPage]);

  // 批量翻译指定页面（核心逻辑）
  const doTranslateAllPages = useCallback(async (
    pagesToTranslate: number[],
    label = '全部',
  ) => {
    if (!doc?.pdfPages) return;
    const batchTotal = pagesToTranslate.length;
    
    console.log(`[BilingualReader] 开始翻译${label}，共 ${batchTotal} 页...`);
    setIsTranslating(true);
    setIsTranslatingAll(true);
    abortTranslationRef.current = false;
    
    try {
      const service = createDeepSeekService(translationConfig);
      
      for (let i = 0; i < pagesToTranslate.length; i++) {
        const pageNum = pagesToTranslate[i];
        if (abortTranslationRef.current) {
          setTranslationProgress('翻译已取消');
          break;
        }
        
        setTranslationProgress(`正在翻译「${label}」... ${i + 1}/${batchTotal}（第 ${pageNum} 页）`);
        
        try {
          await translatePage(pageNum, service);
          markPageAsTranslated(pageNum);
        } catch (err) {
          console.error(`[BilingualReader] 页面 ${pageNum} 翻译失败:`, err);
        }
      }
      
      if (!abortTranslationRef.current) {
        setTranslationProgress(`${label}翻译完成`);
        showToast(`${label}翻译完成`, 'success');
      }
    } catch (error) {
      console.error('[BilingualReader] 翻译失败:', error);
      setTranslationProgress('翻译失败');
      showToast('翻译失败', 'error');
    } finally {
      setIsTranslating(false);
      setIsTranslatingAll(false);
      setTimeout(() => {
        setTranslationProgress('');
      }, UI_CONFIG.PROGRESS_FADE_DELAY);
    }
  }, [doc, translationConfig, markPageAsTranslated, showToast]);

  // 按章节翻译
  const handleTranslateChapters = useCallback((pages: number[], label: string) => {
    if (!doc?.pdfPages) {
      showToast('当前仅支持 PDF 按页视觉翻译', 'warning');
      return;
    }
    if (!translationConfig.apiKey) {
      showToast('请先在设置中配置 API Key', 'warning');
      return;
    }
    if (pages.length === 0) {
      showToast('所选章节没有可定位的页码', 'warning');
      return;
    }

    const untranslated = pages.filter((p) => !translatedPages.has(p));
    const message =
      untranslated.length === 0
        ? `「${label}」共 ${pages.length} 页均已翻译，是否重新翻译？`
        : `「${label}」共 ${pages.length} 页，其中 ${untranslated.length} 页未翻译。开始翻译？`;

    setConfirmDialog({
      isOpen: true,
      title: '按章节翻译',
      message,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        const toTranslate = untranslated.length > 0 ? untranslated : pages;
        doTranslateAllPages(toTranslate, label);
      },
    });
  }, [doc, translationConfig, translatedPages, showToast, doTranslateAllPages]);

  // 翻译所有页面（带确认检查）
  const handleTranslateAllPages = useCallback(async () => {
    if (!doc?.pdfPages) return;
    if (!translationConfig.apiKey) {
      showToast('请先在设置中配置 API Key', 'warning');
      return;
    }
    
    const totalPages = doc.pdfPages.length;
    const untranslatedPages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(pageNum => !translatedPages.has(pageNum));
    
    const message = untranslatedPages.length === 0
      ? '所有页面都已翻译，是否重新翻译全部？'
      : `共有 ${totalPages} 页，其中 ${untranslatedPages.length} 页未翻译。开始翻译？`;
    
    setConfirmDialog({
      isOpen: true,
      title: '批量翻译',
      message,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        const pages = untranslatedPages.length > 0 
          ? untranslatedPages 
          : Array.from({ length: totalPages }, (_, i) => i + 1);
        doTranslateAllPages(pages);
      },
    });
  }, [doc, translationConfig, translatedPages, showToast, doTranslateAllPages]);

  // 取消翻译
  const handleCancelTranslation = useCallback(() => {
    abortTranslationRef.current = true;
    setTranslationProgress('正在取消...');
  }, []);

  // 页面变化时自动翻译（仅当未翻译过时）
  useEffect(() => {
    if (isPdfLoaded && doc?.pdfPages && !isTranslatingAll) {
      if (!translatedPages.has(currentPage)) {
        handleTranslateCurrentPage();
      }
    }
  }, [currentPage, handleTranslateCurrentPage, doc?.pdfPages, isTranslatingAll, translatedPages, isPdfLoaded]);

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
      }, UI_CONFIG.HIGHLIGHT_DURATION);
    }
  }, [selectedSentence, setSelectedSentence, setHighlightedSentenceId]);

  // 翻译单个句子
  const handleTranslateSentence = useCallback(async (sentence: Sentence) => {
    if (!translationConfig.apiKey) {
      showToast('请先在设置中配置 API Key', 'warning');
      return;
    }

    setIsTranslating(true);
    try {
      const service = createDeepSeekService(translationConfig);
      const translation = await service.translate(sentence.text);
      
      if (doc) {
        const newDoc = { ...doc };
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
      console.error('[BilingualReader] 句子翻译失败:', error);
      showToast('翻译失败，请重试', 'error');
    } finally {
      setIsTranslating(false);
    }
  }, [translationConfig, doc, setDocument, showToast]);

  // 获取当前页面的翻译数据
  const getCurrentPageTranslation = () => {
    if (!doc?.pdfPages) return null;
    const pageInfo = doc.pdfPages[currentPage - 1];
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
    if (page >= 1 && page <= (doc?.totalPages || 1)) {
      setCurrentPage(page);
    }
  };

  // 缩放
  const handleZoomIn = () => setScale(prev => Math.min(prev + PDF_CONFIG.SCALE_STEP, PDF_CONFIG.MAX_SCALE));
  const handleZoomOut = () => setScale(prev => Math.max(prev - PDF_CONFIG.SCALE_STEP, PDF_CONFIG.MIN_SCALE));
  const handleResetZoom = () => setScale(PDF_CONFIG.DEFAULT_SCALE);

  if (!doc) return null;

  const hasToc = (doc.toc?.length ?? 0) > 0;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 工具栏 */}
      <ReaderToolbar
        document={doc}
        currentPage={currentPage}
        totalPages={doc.totalPages || 1}
        scale={scale}
        isTranslating={isTranslating}
        showTranslateMenu={showTranslateMenu}
        showToc={showToc}
        hasToc={hasToc}
        translationProgress={translationProgress}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onPrevPage={() => goToPage(currentPage - 1)}
        onNextPage={() => goToPage(currentPage + 1)}
        onTranslateMenuToggle={() => setShowTranslateMenu(prev => !prev)}
        onTranslateCurrentPage={() => {
          setShowTranslateMenu(false);
          handleTranslateCurrentPage();
        }}
        onTranslateAllPages={() => {
          setShowTranslateMenu(false);
          handleTranslateAllPages();
        }}
        onOpenTocForChapterTranslate={() => {
          setShowTranslateMenu(false);
          setShowToc(true);
        }}
        onToggleToc={() => setShowToc((prev) => !prev)}
        onCancelTranslation={handleCancelTranslation}
      />

      {/* 双语对照阅读区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 目录面板 */}
        {showToc && (
          <TocPanel
            toc={doc.toc ?? []}
            totalPages={doc.totalPages || 1}
            currentPage={currentPage}
            translatedPages={translatedPages}
            isTranslating={isTranslating}
            onClose={() => setShowToc(false)}
            onNavigate={goToPage}
            onTranslateChapters={handleTranslateChapters}
          />
        )}

        {/* 左侧 - PDF渲染 */}
        <PDFViewer
          canvasRef={pdfCanvasRef}
          isRendering={isRendering}
          isPdfLoaded={isPdfLoaded}
          renderError={renderError}
        />

        {/* 右侧 - 翻译文本 */}
        <div ref={rightPanelRef} className="flex-1 flex overflow-hidden">
          {pageTranslation ? (
            <TranslationPanel
              currentPage={currentPage}
              translationProgress={translationProgress}
              isTranslated={translatedPages.has(currentPage)}
              hasVisionTranslation={visionTranslations.has(currentPage)}
              visionTranslation={visionTranslations.get(currentPage)}
              sentences={pageTranslation.sentences}
              selectedSentence={selectedSentence}
              highlightedSentenceId={highlightedSentenceId}
              isTranslating={isTranslating}
              onSentenceClick={handleSentenceClick}
              onTranslateSentence={handleTranslateSentence}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p>暂无翻译内容</p>
                <p className="text-sm mt-2">点击翻译按钮开始翻译</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

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
