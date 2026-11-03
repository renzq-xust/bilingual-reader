import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Loader2, X } from 'lucide-react';
import { useAppStore } from '../store';
import { parseDocument } from '../services/parser';
import { Document } from '../types';

export function FileUpload() {
  const { setDocument, setIsLoading, setError, isLoading, error } = useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState('');

  const handleFile = useCallback(async (file: File) => {
    console.log('[FileUpload] 开始处理文件:', file.name, '类型:', file.type, '大小:', file.size);
    setIsLoading(true);
    setError(null);
    setProgress('正在读取文件...');

    try {
      // 解析文档
      setProgress('正在解析文档...');
      const result = await parseDocument(file);
      const { paragraphs, pdfPages, toc, totalPages } = result;
      console.log(
        '[FileUpload] 文档解析完成，段落数:',
        paragraphs.length,
        'PDF页数:',
        pdfPages?.length,
        '目录条目:',
        toc?.length ?? 0,
      );
      
      const resolvedTotalPages =
        totalPages ??
        (pdfPages ? pdfPages.length : Math.ceil(paragraphs.length / 10));
      setProgress(`解析完成，共 ${resolvedTotalPages} 页` + (toc?.length ? `，${toc.length} 个章节` : ''));
      
      // 创建文档对象
      const doc: Document = {
        id: `doc-${Date.now()}`,
        title: file.name,
        type: file.name.endsWith('.pdf') ? 'pdf' : 'epub',
        paragraphs,
        pdfPages,
        pdfFile: file.name.endsWith('.pdf') ? file : undefined,
        totalPages: resolvedTotalPages,
        currentPage: 0,
        toc: toc ?? [],
      };

      console.log('[FileUpload] 文档对象创建成功:', doc.title);
      setDocument(doc);
      setProgress('');
    } catch (err) {
      console.error('[FileUpload] 文件处理错误:', err);
      const errorMessage = err instanceof Error ? err.message : '文件处理失败';
      setError(errorMessage);
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  }, [setDocument, setIsLoading, setError]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFile(acceptedFiles[0]);
    }
  }, [handleFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub'],
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* 加载状态 */}
        {isLoading && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div className="flex-1">
                <p className="text-sm text-blue-300">{progress || '处理中...'}</p>
                <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '50%' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{error}</p>
                <p className="text-xs text-red-400/70 mt-1">请检查文件格式或查看浏览器控制台的详细错误信息</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="p-1 text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
            transition-all duration-300
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            ${isDragActive || dragActive
              ? 'border-blue-500 bg-blue-500/10 scale-105'
              : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
            }
          `}
        >
          <input {...getInputProps()} disabled={isLoading} />
          
          <div className="flex flex-col items-center gap-6">
            <div className={`
              p-6 rounded-full
              ${isLoading ? 'bg-gray-700' : ''}
              ${isDragActive || dragActive
                ? 'bg-blue-500/20'
                : 'bg-gray-700'
              }
            `}>
              {isLoading ? (
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
              ) : (
                <Upload className={`w-12 h-12 ${
                  isDragActive || dragActive
                    ? 'text-blue-400'
                    : 'text-gray-400'
                }`} />
              )}
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold text-gray-200 mb-2">
                {isLoading ? '处理中...' : isDragActive ? '释放文件以打开' : '打开文档'}
              </h3>
              <p className="text-gray-400 mb-4">
                {isLoading ? progress || '请稍候...' : '拖放文件到此处，或点击选择文件'}
              </p>
              {!isLoading && (
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    支持 PDF
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    支持 EPUB
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-8 p-4 bg-gray-800 rounded-xl border border-gray-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-yellow-400 mb-1">使用提示</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li>首次使用请先在设置中配置 DeepSeek API Key</li>
                <li>打开「目录」可跳转章节，并勾选后按章节翻译</li>
                <li>点击任意句子可以高亮显示对应的翻译</li>
                <li>打开 AI 助手可以随时提问不懂的内容</li>
                <li>按 F12 打开浏览器控制台查看调试信息</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
