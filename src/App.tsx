import { useAppStore } from './store';
import { FileUpload } from './components/FileUpload';
import { BilingualReader } from './components/BilingualReader';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { MessageSquare, Settings, BookOpen } from 'lucide-react';

function App() {
  const { 
    document, 
    isChatOpen, 
    setIsChatOpen, 
    showSettings, 
    setShowSettings,
    translationConfig 
  } = useAppStore();

  console.log('App渲染, document:', document);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            双语阅读器
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="设置"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          {/* AI对话按钮 */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isChatOpen 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="AI助手"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-medium">AI 助手</span>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 设置面板 */}
        {showSettings && (
          <div className="w-80 border-r border-gray-700 bg-gray-800 overflow-y-auto">
            <SettingsPanel />
          </div>
        )}

        {/* 阅读区域 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!document ? (
            <FileUpload />
          ) : (
            <BilingualReader />
          )}
        </main>

        {/* AI对话面板 */}
        {isChatOpen && (
          <div className="w-96 border-l border-gray-700 bg-gray-800 flex flex-col">
            <ChatPanel />
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <footer className="px-6 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>
          {document ? `当前文档: ${document.title}` : '未加载文档'}
        </span>
        <span>
          API: {translationConfig.apiKey ? '已配置' : '未配置'}
        </span>
      </footer>
    </div>
  );
}

export default App;
