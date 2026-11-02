import { getPDFLib } from '../utils/pdfWorker';
import { Paragraph, PDFPageInfo } from '../types';

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

/**
 * 安全读取 File 的 ArrayBuffer
 * File.arrayBuffer() 内部使用的 stream 只能消费一次，
 * 因此调用方应缓存结果并复用
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch (error) {
    console.error('[Parser] 文件读取失败:', error);
    throw new Error('文件读取失败，请重新选择文件');
  }
}

// 解析 PDF 文件 - 返回页面信息
export async function parsePDF(file: File): Promise<{
  paragraphs: Paragraph[];
  pdfPages: PDFPageInfo[];
}> {
  const paragraphs: Paragraph[] = [];
  const pdfPages: PDFPageInfo[] = [];
  
  console.log('[Parser] 开始解析 PDF 文件:', file.name);
  
  try {
    // 每次读取新的 ArrayBuffer（File.arrayBuffer() 每次调用会创建新副本）
    const arrayBuffer = await readFileAsArrayBuffer(file);
    console.log('[Parser] 文件读取完成，大小:', arrayBuffer.byteLength, 'bytes');
    
    const pdfjsLib = getPDFLib();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    console.log('[Parser] PDF 加载成功，总页数:', numPages);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      
      pdfPages.push({
        pageNumber: pageNum,
        width: viewport.width,
        height: viewport.height,
        textContent: '',
        sentences: [],
      });
    }

    console.log('[Parser] PDF 解析完成，总页数:', pdfPages.length);
    return { paragraphs, pdfPages };
  } catch (error) {
    console.error('[Parser] PDF 解析错误:', error);
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
    const book = ePub(file as unknown as Parameters<typeof ePub>[0]);
    
    await book.ready;
    const spine = book.spine as unknown as { items: Array<{ load: (loader: unknown) => Promise<string | Document> }> };
    
    for (let i = 0; i < spine.items.length; i++) {
      const contents = await spine.items[i].load(book.load.bind(book));
      
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
    console.error('[Parser] EPUB 解析错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    throw new Error(`无法解析EPUB文件: ${errorMessage}`);
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
    case 'epub': {
      const paragraphs = await parseEPUB(file);
      return { paragraphs };
    }
    default:
      throw new Error(`不支持的文件格式: ${extension}`);
  }
}
