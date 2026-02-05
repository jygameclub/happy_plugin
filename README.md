# Happy 调试控制台

<p align="center">
  <img src="public/icons/icon128.png" alt="Happy Plugin Logo" width="128" height="128">
</p>

<p align="center">
  <strong>用于调试 Happy 多终端环境的 Chrome 扩展</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装方法">安装方法</a> •
  <a href="#开发指南">开发指南</a> •
  <a href="#项目结构">项目结构</a> •
  <a href="#api-配置">API 配置</a>
</p>

---

## 功能特性

### 核心功能

- **会话扫描**: 检测并列出页面上的所有终端会话
- **输入预览**: 在执行前测试输入注入
- **AI 分析**: 使用 AI 智能判断分析会话状态（支持截图分析）
- **动作预览**: 在执行前预览建议的操作
- **调试日志**: 完整的操作日志记录与导出功能

### AI 分析反馈

- **截图分析**: 捕获当前页面截图，AI 自动分析并给出建议
- **多 API 支持**: 支持 DeepSeek 和 OpenAI API
- **模型选择**: 可选择不同的 AI 模型（deepseek-chat、deepseek-coder、gpt-4o 等）
- **自定义提示词**: 可自定义分析提示词

### 开发工具

- **API 测试聊天**: 内置 API 测试功能，快速验证 API 连接
- **延迟发送**: 支持延迟发送消息功能
- **会话角色管理**: 支持 Leader/Executor 角色分配

## 安装方法

### 从源码安装

```bash
# 1. 克隆代码仓库
git clone https://github.com/jygameclub/happy_plugin.git
cd happy_plugin

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 在 Chrome 中加载扩展
# - 打开 chrome://extensions/
# - 启用"开发者模式"
# - 点击"加载已解压的扩展程序"
# - 选择 dist/ 文件夹
```

## 开发指南

### 可用脚本

```bash
npm run dev          # 监视模式开发
npm run build        # 生产构建
npm test             # 运行测试
npm run test:watch   # 监视模式测试
npm run test:coverage # 测试覆盖率报告
npm run typecheck    # TypeScript 类型检查
```

### 技术栈

- **构建工具**: Vite 5.x
- **语言**: TypeScript 5.x
- **测试框架**: Vitest
- **Git Hooks**: Husky + lint-staged
- **Chrome API**: Manifest V3

## 项目结构

```
happy_plugin/
├── src/
│   ├── background/      # 后台服务脚本
│   │   ├── background.ts
│   │   └── state-manager.ts
│   ├── content/         # 内容脚本
│   │   ├── content.ts
│   │   ├── input-injector.ts
│   │   ├── output-listener.ts
│   │   ├── page-analyzer.ts
│   │   └── session-scanner.ts
│   ├── popup/           # 弹出窗口
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.ts
│   ├── sidepanel/       # 侧边栏面板
│   │   ├── sidepanel.html
│   │   ├── sidepanel.css
│   │   └── sidepanel.ts
│   ├── services/        # 服务层
│   │   ├── api-client.ts
│   │   ├── ai-judge.ts
│   │   └── config-storage.ts
│   ├── types/           # 类型定义
│   │   ├── session.ts
│   │   ├── messages.ts
│   │   └── ai-judge.ts
│   └── manifest.json    # 扩展清单
├── public/              # 静态资源
│   └── icons/           # 扩展图标
├── dist/                # 构建输出
├── docs/                # 文档
├── _bmad/               # BMAD 方法论框架
├── .github/             # GitHub Actions
└── .husky/              # Git hooks
```

## API 配置

### DeepSeek API

1. 在侧边栏打开"环境配置"面板
2. 输入 DeepSeek API Key
3. Base URL 默认为: `https://api.deepseek.com/v1`
4. 点击"检查连接"验证配置

### OpenAI API

1. 在"环境配置"面板切换到 OpenAI 标签
2. 输入 OpenAI API Key
3. Base URL 默认为: `https://api.openai.com/v1`
4. 点击"检查连接"验证配置

## 使用方法

1. 点击扩展图标打开弹出窗口
2. 点击"打开调试面板"进入侧边栏控制台
3. 配置 API（DeepSeek 或 OpenAI）
4. 使用"截图分析"功能让 AI 分析当前页面
5. 使用"扫描会话"检测终端会话
6. 选择要交互的会话进行操作

## 安全说明

- 所有操作在执行前都需要预览确认
- 危险命令会被检测并阻止
- API Key 存储在本地 Chrome Storage 中
- 无需确认不会自动执行任何操作

## BMAD 方法论

本项目集成了 [BMAD Method](https://github.com/bmad-code-org) 方法论框架，提供：

- 项目规划和管理工作流
- 开发流程自动化
- 文档生成功能

使用 `/bmad-help` 命令获取帮助。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/jygameclub">jygameclub</a>
</p>
