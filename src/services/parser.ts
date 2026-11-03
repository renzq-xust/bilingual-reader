import { getPDFLib } from '../utils/pdfWorker';
import { Paragraph, PDFPageInfo, TocItem } from '../types';

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

/** PDF.js outline 节点结构 */
interface PdfOutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: PdfOutlineNode[];
}

/**
 * 将 PDF 目标（named dest / explicit dest）解析为 1-based 页码
 */
async function resolvePdfDestPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  dest: string | unknown[] | null,
): Promise<number | null> {
  if (!dest) return null;

  try {
    let explicitDest: unknown[] | null =
      typeof dest === 'string' ? await pdf.getDestination(dest) : dest;

    if (!Array.isArray(explicitDest) || explicitDest.length === 0) {
      return null;
    }

    const ref = explicitDest[0];
    // 有些 dest 第一项已经是页码数字
    if (typeof ref === 'number') {
      return ref + 1;
    }

    const pageIndex = await pdf.getPageIndex(ref);
    return pageIndex + 1;
  } catch (error) {
    console.warn('[Parser] 解析目录目标页失败:', error);
    return null;
  }
}

/**
 * 递归提取 PDF 大纲为 TocItem 树
 */
async function extractPdfOutline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  nodes: PdfOutlineNode[] | null | undefined,
  level = 0,
  idPrefix = 'toc',
): Promise<TocItem[]> {
  if (!nodes || nodes.length === 0) return [];

  const items: TocItem[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const id = `${idPrefix}-${level}-${i}`;
    const startPage = await resolvePdfDestPage(pdf, node.dest);
    const children = await extractPdfOutline(pdf, node.items, level + 1, id);

    items.push({
      id,
      title: (node.title || `章节 ${i + 1}`).trim(),
      startPage,
      level,
      children,
    });
  }

  return items;
}

/**
 * 扁平化目录并填充 endPage
 * 规则：当前项的结束页 = 后续「同级或更高级」第一个有页码项的 startPage - 1；否则为 totalPages
 */
export function enrichTocEndPages(toc: TocItem[], totalPages: number): TocItem[] {
  type Flat = { item: TocItem; level: number };
  const flat: Flat[] = [];

  const walk = (items: TocItem[]) => {
    for (const item of items) {
      flat.push({ item, level: item.level });
      if (item.children.length > 0) walk(item.children);
    }
  };
  walk(toc);

  for (let i = 0; i < flat.length; i++) {
    const current = flat[i].item;
    if (current.startPage == null) {
      current.endPage = null;
      continue;
    }

    let endPage = totalPages;
    for (let j = i + 1; j < flat.length; j++) {
      const next = flat[j];
      if (next.level <= flat[i].level && next.item.startPage != null) {
        endPage = Math.max(current.startPage, next.item.startPage - 1);
        break;
      }
    }
    current.endPage = endPage;
  }

  return toc;
}

/**
 * 根据章节计算需要翻译的页码列表（1-based，含首尾）
 */
export function getChapterPageRange(item: TocItem, totalPages: number): number[] {
  if (item.startPage == null) return [];
  const start = item.startPage;
  const end = Math.min(item.endPage ?? totalPages, totalPages);
  if (end < start) return [start];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * 扁平化目录树（深度优先）
 */
export function flattenToc(toc: TocItem[]): TocItem[] {
  const result: TocItem[] = [];
  const walk = (items: TocItem[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children.length > 0) walk(item.children);
    }
  };
  walk(toc);
  return result;
}

// 解析 PDF 文件 - 返回页面信息与目录
export async function parsePDF(file: File): Promise<{
  paragraphs: Paragraph[];
  pdfPages: PDFPageInfo[];
  toc: TocItem[];
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

    // 提取目录大纲
    let toc: TocItem[] = [];
    try {
      const outline = await pdf.getOutline();
      toc = await extractPdfOutline(pdf, outline as PdfOutlineNode[] | null);
      toc = enrichTocEndPages(toc, numPages);
      console.log('[Parser] PDF 目录提取完成，条目数:', flattenToc(toc).length);
    } catch (outlineError) {
      console.warn('[Parser] PDF 目录提取失败（文档可能无大纲）:', outlineError);
      toc = [];
    }

    console.log('[Parser] PDF 解析完成，总页数:', pdfPages.length);
    return { paragraphs, pdfPages, toc };
  } catch (error) {
    console.error('[Parser] PDF 解析错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    throw new Error(`无法解析PDF文件: ${errorMessage}`);
  }
}

/** epubjs navigation toc 节点 */
interface EpubNavItem {
  id?: string;
  href?: string;
  label?: string;
  subitems?: EpubNavItem[];
}

/**
 * 将 EPUB href 映射到 spine 索引（近似为「页」）
 */
function resolveEpubHrefToPage(
  href: string | undefined,
  hrefToPage: Map<string, number>,
): number | null {
  if (!href) return null;
  const clean = href.split('#')[0];
  if (hrefToPage.has(clean)) return hrefToPage.get(clean)!;
  // 尝试后缀匹配
  for (const [key, page] of hrefToPage) {
    if (key.endsWith(clean) || clean.endsWith(key)) return page;
  }
  return null;
}

function extractEpubToc(
  nodes: EpubNavItem[] | undefined,
  hrefToPage: Map<string, number>,
  level = 0,
  idPrefix = 'toc',
): TocItem[] {
  if (!nodes || nodes.length === 0) return [];

  return nodes.map((node, i) => {
    const id = node.id || `${idPrefix}-${level}-${i}`;
    return {
      id,
      title: (node.label || `章节 ${i + 1}`).trim(),
      startPage: resolveEpubHrefToPage(node.href, hrefToPage),
      level,
      children: extractEpubToc(node.subitems, hrefToPage, level + 1, id),
    };
  });
}

// 解析 EPUB 文件
export async function parseEPUB(file: File): Promise<{
  paragraphs: Paragraph[];
  toc: TocItem[];
  totalPages: number;
}> {
  const paragraphs: Paragraph[] = [];
  
  try {
    // 动态导入 epubjs
    const ePub = (await import('epubjs')).default;
    const book = ePub(file as unknown as Parameters<typeof ePub>[0]);
    
    await book.ready;
    const spine = book.spine as unknown as {
      items: Array<{
        href?: string;
        load: (loader: unknown) => Promise<string | globalThis.Document>;
      }>;
    };

    // href -> 1-based spine 页码
    const hrefToPage = new Map<string, number>();
    spine.items.forEach((item, index) => {
      if (item.href) {
        hrefToPage.set(item.href, index + 1);
        hrefToPage.set(item.href.split('#')[0], index + 1);
      }
    });
    
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

    // 提取目录
    let toc: TocItem[] = [];
    try {
      const navigation = await book.loaded.navigation;
      const navToc = (navigation as { toc?: EpubNavItem[] })?.toc;
      toc = extractEpubToc(navToc, hrefToPage);
      toc = enrichTocEndPages(toc, spine.items.length);
      console.log('[Parser] EPUB 目录提取完成，条目数:', flattenToc(toc).length);
    } catch (navError) {
      console.warn('[Parser] EPUB 目录提取失败:', navError);
      toc = [];
    }
    
    book.destroy();
    return { paragraphs, toc, totalPages: spine.items.length };
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
  toc: TocItem[];
  totalPages?: number;
}> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return parsePDF(file);
    case 'epub': {
      const { paragraphs, toc, totalPages } = await parseEPUB(file);
      return { paragraphs, toc, totalPages };
    }
    default:
      throw new Error(`不支持的文件格式: ${extension}`);
  }
}
