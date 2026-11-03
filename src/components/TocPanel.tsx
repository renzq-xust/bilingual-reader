import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Languages,
  List,
  X,
  BookMarked,
} from 'lucide-react';
import { TocItem } from '../types';
import { flattenToc, getChapterPageRange } from '../services/parser';

interface TocPanelProps {
  toc: TocItem[];
  totalPages: number;
  currentPage: number;
  translatedPages: Set<number>;
  isTranslating: boolean;
  onClose: () => void;
  onNavigate: (page: number) => void;
  onTranslateChapters: (pages: number[], label: string) => void;
}

function TocTreeItem({
  item,
  totalPages,
  currentPage,
  translatedPages,
  selectedIds,
  onToggleSelect,
  onNavigate,
}: {
  item: TocItem;
  totalPages: number;
  currentPage: number;
  translatedPages: Set<number>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onNavigate: (page: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const pages = getChapterPageRange(item, totalPages);
  const translatedCount = pages.filter((p) => translatedPages.has(p)).length;
  const isActive =
    item.startPage != null &&
    currentPage >= item.startPage &&
    currentPage <= (item.endPage ?? item.startPage);

  const pageLabel =
    item.startPage == null
      ? ''
      : item.endPage && item.endPage !== item.startPage
        ? `p.${item.startPage}–${item.endPage}`
        : `p.${item.startPage}`;

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-gray-700/80'
        }`}
        style={{ paddingLeft: `${8 + item.level * 14}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-0.5 text-gray-500 hover:text-gray-300 shrink-0"
            aria-label={expanded ? '折叠' : '展开'}
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <input
          type="checkbox"
          checked={selectedIds.has(item.id)}
          disabled={item.startPage == null}
          onChange={() => onToggleSelect(item.id)}
          className="shrink-0 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-40"
          title={item.startPage == null ? '无法定位页码' : '选择该章节'}
        />

        <button
          type="button"
          className="flex-1 min-w-0 text-left truncate"
          disabled={item.startPage == null}
          onClick={() => item.startPage != null && onNavigate(item.startPage)}
          title={item.title}
        >
          {item.title}
        </button>

        <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">{pageLabel}</span>

        {pages.length > 0 && (
          <span
            className={`text-[10px] shrink-0 tabular-nums ${
              translatedCount === pages.length
                ? 'text-green-400'
                : translatedCount > 0
                  ? 'text-yellow-400'
                  : 'text-gray-600'
            }`}
            title={`已翻译 ${translatedCount}/${pages.length} 页`}
          >
            {translatedCount}/{pages.length}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children.map((child) => (
            <TocTreeItem
              key={child.id}
              item={child}
              totalPages={totalPages}
              currentPage={currentPage}
              translatedPages={translatedPages}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TocPanel({
  toc,
  totalPages,
  currentPage,
  translatedPages,
  isTranslating,
  onClose,
  onNavigate,
  onTranslateChapters,
}: TocPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const flat = useMemo(() => flattenToc(toc), [toc]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(
      new Set(flat.filter((item) => item.startPage != null).map((item) => item.id)),
    );
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleTranslateSelected = () => {
    const selected = flat.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) return;

    const pageSet = new Set<number>();
    for (const item of selected) {
      for (const page of getChapterPageRange(item, totalPages)) {
        pageSet.add(page);
      }
    }
    const pages = Array.from(pageSet).sort((a, b) => a - b);
    const label =
      selected.length === 1
        ? selected[0].title
        : `${selected.length} 个章节`;
    onTranslateChapters(pages, label);
  };

  const selectedPageCount = useMemo(() => {
    const pageSet = new Set<number>();
    for (const item of flat) {
      if (!selectedIds.has(item.id)) continue;
      for (const page of getChapterPageRange(item, totalPages)) {
        pageSet.add(page);
      }
    }
    return pageSet.size;
  }, [flat, selectedIds, totalPages]);

  return (
    <div className="w-80 border-r border-gray-700 bg-gray-800 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 text-gray-200">
          <List className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">目录</span>
          <span className="text-xs text-gray-500">({flat.length})</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          title="关闭目录"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {toc.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-gray-500">
          <BookMarked className="w-10 h-10 opacity-40" />
          <p className="text-sm">当前文档没有可用目录</p>
          <p className="text-xs text-gray-600">部分扫描版 PDF 或未嵌入大纲的文件无法提取章节</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/80 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              全选
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              清空
            </button>
            <span className="ml-auto text-gray-500">
              已选 {selectedIds.size} 章 / {selectedPageCount} 页
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-1">
            {toc.map((item) => (
              <TocTreeItem
                key={item.id}
                item={item}
                totalPages={totalPages}
                currentPage={currentPage}
                translatedPages={translatedPages}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          <div className="p-3 border-t border-gray-700">
            <button
              type="button"
              disabled={selectedIds.size === 0 || isTranslating || selectedPageCount === 0}
              onClick={handleTranslateSelected}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Languages className="w-4 h-4" />
              翻译所选章节
              {selectedPageCount > 0 && (
                <span className="text-blue-200 text-xs">({selectedPageCount} 页)</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
