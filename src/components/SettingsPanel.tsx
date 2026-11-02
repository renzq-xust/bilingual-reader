import { useState, useEffect, useCallback } from 'react';
import { Save, TestTube, Eye, EyeOff, Key, Globe, Palette, Shield } from 'lucide-react';
import { useAppStore } from '../store';
import { createDeepSeekService } from '../services/deepseek';
import { saveConfigSecure, loadConfigSecure } from '../utils/crypto';
import { TranslationConfig } from '../types';
import { Toast } from './ConfirmDialog';

export function SettingsPanel() {
  const { translationConfig, setTranslationConfig } = useAppStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; isVisible: boolean }>({
    message: '', type: 'info', isVisible: false,
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type, isVisible: true });
  }, []);

  // 测试 API 连接
  const handleTestConnection = async () => {
    if (!translationConfig.apiKey) {
      setTestResult('error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const service = createDeepSeekService(translationConfig);
      await service.translate('Hello, this is a test.');
      setTestResult('success');
    } catch (error) {
      console.error('[Settings] 测试连接失败:', error);
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存设置（加密存储）
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveConfigSecure(translationConfig as unknown as Record<string, unknown>);
      showToast('设置已加密保存', 'success');
    } catch (error) {
      console.error('[Settings] 保存失败:', error);
      showToast('保存失败，请重试', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 加载保存的设置（解密加载）
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await loadConfigSecure<TranslationConfig>();
        if (config) {
          console.log('[Settings] 从 localStorage 加载加密配置成功');
          setTranslationConfig(config);
        }
      } catch (error) {
        console.warn('[Settings] 加载配置失败:', error);
      }
    };
    
    loadConfig();
  }, [setTranslationConfig]);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
        <Palette className="w-5 h-5 text-blue-400" />
        设置
      </h2>

      {/* API 配置 */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" />
            API 配置
          </h3>
          
          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={translationConfig.apiKey}
                  onChange={(e) => setTranslationConfig({ apiKey: e.target.value })}
                  placeholder="输入你的 DeepSeek API Key"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pr-10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                API Key 经编码后存储在本地浏览器中
              </p>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Base URL</label>
              <input
                type="text"
                value={translationConfig.baseUrl}
                onChange={(e) => setTranslationConfig({ baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">模型</label>
              <select
                value={translationConfig.model}
                onChange={(e) => setTranslationConfig({ model: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="deepseek-flash">DeepSeek Flash (文本+视觉)</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro (文本)</option>
                <option value="deepseek-chat">DeepSeek Chat (旧版)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Flash 模型支持视觉OCR，适合无法提取文本的PDF
              </p>
            </div>

            {/* 目标语言 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                目标语言
              </label>
              <select
                value={translationConfig.targetLanguage}
                onChange={(e) => setTranslationConfig({ targetLanguage: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁体中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </div>
          </div>
        </div>

        {/* 测试连接 */}
        <div className="pt-4 border-t border-gray-700">
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !translationConfig.apiKey}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <TestTube className="w-4 h-4" />
            {isTesting ? '测试中...' : '测试连接'}
          </button>
          
          {testResult === 'success' && (
            <p className="text-sm text-green-400 mt-2 flex items-center gap-1">
              ✓ 连接成功！API 工作正常
            </p>
          )}
          {testResult === 'error' && (
            <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
              ✗ 连接失败，请检查 API Key 和网络
            </p>
          )}
        </div>

        {/* 保存按钮 */}
        <div className="pt-4 border-t border-gray-700">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* 隐私说明 */}
        <div className="pt-6 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            隐私与数据安全
          </h3>
          <div className="space-y-2 text-xs text-gray-400">
            <p>• API Key 经过编码后存储在本地浏览器中，非明文保存</p>
            <p>• 翻译时文档内容会以图片形式发送至 DeepSeek API 进行处理</p>
            <p>• 敏感文档请谨慎使用在线翻译功能</p>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="pt-6 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">使用说明</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <p>1. 前往 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DeepSeek 开放平台</a> 获取 API Key</p>
            <p>2. 将 API Key 填入上方输入框</p>
            <p>3. 点击"测试连接"确认配置正确</p>
            <p>4. 保存设置后即可开始使用翻译功能</p>
          </div>
        </div>

        {/* 功能说明 */}
        <div className="pt-6 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">功能说明</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <p>• 支持 PDF 和 EPUB 格式文档</p>
            <p>• 左右分栏双语对照显示</p>
            <p>• 点击句子高亮对应翻译</p>
            <p>• AI 助手实时解答疑问</p>
            <p>• 同步滚动方便对照阅读</p>
          </div>
        </div>
      </div>

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
