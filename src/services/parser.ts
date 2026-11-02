import * as pdfjsLib from 'pdfjs-dist';
import { Paragraph, PDFPageInfo, Sentence } from '../types';

// 配置 PDF.js worker - 使用 pdfjs-dist 自带的 worker
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// 将文本按句子分割
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  // 先按换行符分割成行
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sentences: string[] = [];
  
  for (const line of lines) {
    // 尝试按句子结束符分割
    const matched = line.match(/[^.!?]+[.!?]+[\s]*/g);
    if (matched && matched.length > 0) {
      sentences.push(...matched.map(s => s.trim()).filter(s => s.length > 0));
    } else {
      // 如果没有句子结束符，整行作为一个句子
      sentences.push(line);
    }
  }
  
  return sentences;
}

// 解析 PDF 文件 - 返回页面信息（用于方案A：直接渲染PDF）
export async function parsePDF(file: File): Promise<{
  paragraphs: Paragraph[];
  pdfPages: PDFPageInfo[];
}> {
  const paragraphs: Paragraph[] = [];
  const pdfPages: PDFPageInfo[] = [];
  
  console.log('开始解析 PDF 文件:', file.name);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('文件读取完成，大小:', arrayBuffer.byteLength, 'bytes');
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    console.log('PDF 加载成功，总页数:', numPages);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      
      // 只保存页面基本信息，不提取文本（使用视觉模型翻译）
      pdfPages.push({
        pageNumber: pageNum,
        width: viewport.width,
        height: viewport.height,
        textContent: '',
        sentences: [],  // 空句子列表，翻译时由视觉模型填充
      });
    }

    console.log('PDF 解析完成，总页数:', pdfPages.length);
    return { paragraphs, pdfPages };
  } catch (error) {
    console.error('PDF解析错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    throw new Error(`无法解析PDF文件: ${errorMessage}`);
  }
}

// 解析 EPUB 文件
export async function parseEPUB(file: File): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  
  try {
    // 动态导入 epubjs
    const ePub = (await import('epubjs')).default;
    const book = ePub(file as any);
    
    await book.ready;
    const spine = book.spine as any;
    
    for (let i = 0; i < spine.items.length; i++) {
      const item = spine.items[i];
      const contents = await item.load(book.load.bind(book));
      
      if (typeof contents === 'string') {
        // 解析 HTML 内容
        const parser = new DOMParser();
        const doc = parser.parseFromString(contents, 'text/html');
        
        // 提取段落
        const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
        elements.forEach((el, idx) => {
          const text = el.textContent?.trim() || '';
          if (text.length > 0) {
            const sentences = splitIntoSentences(text);
            const paragraph: Paragraph = {
              id: `p-${i}-${idx}`,
              sentences: sentences.map((s, sIdx) => ({
                id: `s-${i}-${idx}-${sIdx}`,
                text: s,
                translation: '',
                index: sIdx,
              })),
              pageIndex: i,
            };
            paragraphs.push(paragraph);
          }
        });
      }
    }
    
    book.destroy();
    return paragraphs;
  } catch (error) {
    console.error('EPUB解析错误:', error);
    throw new Error('无法解析EPUB文件');
  }
}

// 根据文件类型解析文档
export async function parseDocument(file: File): Promise<{
  paragraphs: Paragraph[];
  pdfPages?: PDFPageInfo[];
}> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return parsePDF(file);
    case 'epub':
      const paragraphs = await parseEPUB(file);
      return { paragraphs };
    default:
      throw new Error(`不支持的文件格式: ${extension}`);
  }
}
