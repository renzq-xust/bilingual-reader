import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 自定义确认对话框，替代原生 confirm()
 * 非阻塞式，用户体验更好
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    
    if (isOpen) {
      window.document.addEventListener('keydown', handleKeyDown);
      // 自动聚焦确认按钮
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
    
    return () => {
      window.document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmBtnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* 对话框 */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        {/* 标题 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-full bg-yellow-500/20">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
            <p className="text-sm text-gray-400 mt-1">{message}</p>
          </div>
        </div>
        
        {/* 按钮组 */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Toast 通知组件（替代 alert）
 */
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
  onClose: () => void;
}

export function Toast({ message, type, isVisible, onClose }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const typeStyles = {
    success: 'bg-green-500/20 border-green-500/50 text-green-300',
    error: 'bg-red-500/20 border-red-500/50 text-red-300',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  };

  return (
    <div className="fixed top-4 right-4 z-[200] animate-in slide-in-from-top duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${typeStyles[type]}`}>
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="p-1 hover:opacity-70">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
