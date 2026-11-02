// PDF.js Worker 统一初始化模块
// 避免在多处重复配置 worker

import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

let isInitialized = false;

/**
 * 初始化 PDF.js worker（幂等操作，多次调用安全）
 */
export function initPDFWorker(): void {
  if (isInitialized) return;
  
  pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;
  isInitialized = true;
  console.log('[PDF.js] Worker 初始化完成');
}

/**
 * 获取已配置的 pdfjsLib（确保 worker 已初始化）
 */
export function getPDFLib(): typeof pdfjsLib {
  initPDFWorker();
  return pdfjsLib;
}
