# 双语 PDF/EPUB 阅读器

一个支持双语对照阅读的现代化 Web 应用，专为学习和阅读外文资料设计。左侧显示原文（PDF/EPUB），右侧显示中文翻译，支持 AI 助手实时问答。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-blue.svg)
![Vite](https://img.shields.io/badge/vite-5-purple.svg)

## ✨ 核心功能

### 📖 双语阅读
- **左右分栏对照**：左侧原文，右侧翻译
- **句子级高亮**：点击任意句子，自动高亮对应翻译
- **页面同步滚动**：原文和翻译自动对齐

### 🤖 AI 智能翻译
- **视觉 OCR 翻译**：使用 DeepSeek VL 模型识别 PDF 页面图片并翻译
- **支持扫描版 PDF**：无需文本层，直接识别图片内容
- **按需翻译**：可选择翻译当前页或批量翻译全部页面
- **流式响应**：实时显示翻译进度和结果

### 💬 AI 助手
- **智能问答**：基于当前阅读内容的上下文问答
- **自动关联**：AI 助手自动获取当前页面翻译内容
- **流式输出**：实时显示 AI 回复

### 📚 多格式支持
- **PDF 渲染**：基于 PDF.js 的高清渲染
- **EPUB 解析**：支持 EPUB 格式电子书
- **页面导航**：支持翻页、跳转、缩放

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **状态管理**：Zustand
- **样式方案**：Tailwind CSS
- **PDF 渲染**：PDF.js (pdfjs-dist)
- **EPUB 解析**：epubjs
- **AI 服务**：DeepSeek API（视觉模型 + 文本模型）
- **HTTP 客户端**：Axios

## 📦 安装与运行

### 环境要求
- Node.js >= 18
- npm 或 yarn

### 安装步骤

1. 克隆项目
```bash
git clone https://github.com/renzq-xust/bilingual-reader.git
cd bilingual-reader
```

2. 安装依赖
```bash
npm install
```

3. 配置 API Key

在浏览器中打开应用后，点击右上角设置按钮，配置：
- **API Key**：DeepSeek API 密钥
- **Base URL**：`https://api.deepseek.com`
- **Model**：`deepseek-flash`（支持视觉识别）

4. 启动开发服务器
```bash
npm run dev
```

5. 打开浏览器访问 `http://localhost:3001`

### 构建生产版本

```bash
npm run build
npm run preview
```

## 🚀 使用指南

### 1. 上传文档
- 点击"上传文件"按钮
- 选择 PDF 或 EPUB 文件
- 等待文档加载完成

### 2. 翻译页面
- 点击工具栏的翻译按钮（🌐）
- 选择"翻译当前页"或"翻译所有页"
- 等待 AI 视觉识别和翻译完成

### 3. 对照阅读
- 左侧：原文（PDF 渲染）
- 右侧：中文翻译
- 点击任意句子可高亮对应翻译

### 4. AI 助手问答
- 点击右上角聊天图标（💬）
- 输入问题（如："这段话的语法结构是什么？"）
- AI 会基于当前页面内容回答

### 5. 页面导航
- **翻页**：使用工具栏的左右箭头
- **缩放**：使用放大/缩小按钮
- **跳转**：直接输入页码

## 📝 配置说明

### DeepSeek API 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Base URL | `https://api.deepseek.com` | API 地址 |
| Model | `deepseek-flash` | 视觉模型（推荐） |
| API Key | 你的密钥 | 从 DeepSeek 官网获取 |

### Vite 代理配置

项目已配置 API 代理以解决 CORS 问题：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api/deepseek': {
      target: 'https://api.deepseek.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/deepseek/, '')
    }
  }
}
```

## 🏗️ 项目结构

```
bilingual-reader/
├── src/
│   ├── components/          # React 组件
│   │   ├── BilingualReader.tsx  # 主阅读器组件
│   │   ├── ChatPanel.tsx        # AI 助手面板
│   │   ├── FileUpload.tsx       # 文件上传组件
│   │   └── SettingsPanel.tsx    # 设置面板
│   ├── services/            # 服务层
│   │   ├── deepseek.ts          # DeepSeek API 服务
│   │   └── parser.ts            # 文档解析服务
│   ├── store/               # 状态管理
│   │   └── index.ts             # Zustand store
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx              # 主应用组件
│   ├── main.tsx             # 应用入口
│   └── index.css            # 全局样式
├── public/                  # 静态资源
├── index.html              # HTML 模板
├── package.json            # 项目依赖
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
└── tailwind.config.js      # Tailwind 配置
```

## 🔧 开发计划

- [ ] 支持更多文件格式（MOBI、TXT）
- [ ] 离线翻译缓存
- [ ] 自定义翻译模型
- [ ] 导出翻译结果
- [ ] 生词本功能
- [ ] 阅读进度同步
- [ ] 移动端适配优化

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [DeepSeek](https://deepseek.com) - 提供 AI 视觉识别和翻译 API
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF 渲染引擎
- [epubjs](https://github.com/futurepress/epub.js) - EPUB 解析库
- [React](https://react.dev/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具

## 📮 联系方式

- GitHub: [@renzq-xust](https://github.com/renzq-xust)

---

**注意**：使用 AI 翻译功能需要 DeepSeek API 密钥，可能会产生费用。请确保账户余额充足。
