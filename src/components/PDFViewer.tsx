import { Loader2, AlertCircle } from 'lucide-react';

interface PDFViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isRendering: boolean;
  isPdfLoaded: boolean;
  renderError: string | null;
}

/**
 * PDF 查看器组件 - 负责 PDF 页面的渲染显示
 */
export function PDFViewer({ canvasRef, isRendering, isPdfLoaded, renderError }: PDFViewerProps) {
  return (
    <div className="flex-1 overflow-auto bg-gray-900 p-6 flex justify-center">
      <div className="relative min-h-full flex items-center justify-center">
        {/* 渲染中加载指示器 */}
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}
        
        {/* 错误状态 */}
        {renderError ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-200 mb-2">PDF渲染失败</h3>
            <p className="text-sm text-gray-400 mb-4">{renderError}</p>
            <p className="text-xs text-gray-500">请检查浏览器控制台获取详细错误信息</p>
          </div>
        ) : !isPdfLoaded ? (
          /* 加载中状态 */
          <div className="flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-16 h-16 text-blue-400 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-gray-200 mb-2">正在加载PDF...</h3>
            <p className="text-sm text-gray-400">请稍候</p>
          </div>
        ) : (
          /* PDF Canvas */
          <canvas
            ref={canvasRef as React.RefObject<HTMLCanvasElement>}
            className="shadow-2xl bg-white"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>
    </div>
  );
}
