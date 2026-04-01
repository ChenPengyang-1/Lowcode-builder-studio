# lowcode-builder-studio

一个基于 `React + TypeScript + Zustand + React Router + Node.js` 的低代码页面搭建平台示例项目，支持页面可视化编辑、模板保存发布、模板导入导出，以及 AI 对话式生成与修改。

## 项目功能

- 登录页与登录态控制
- 页面编辑器三栏布局
- 物料拖拽插入与容器嵌套编排
- 图层树与属性面板联动
- 模板草稿保存与发布管理
- 模板搜索、排序与来源筛选
- 模板 `JSON / HTML` 导入导出
- AI 对话式生成、流式输出与修改
- 深色 / 浅色主题切换

## 技术栈

- React 18
- TypeScript
- Zustand
- React Router（BrowserRouter）
- Node.js
- Express
- OpenAI SDK
- Vite

## 路由说明

### 前端页面

- `/login` 登录页
- `/dashboard` 工作台
- `/editor` 页面编辑器
- `/published` 模板发布与修改
- `/settings` 系统设置

### AI 服务接口

- `GET /api/health` AI 服务状态检查
- `POST /api/ai/template/chat` AI 对话接口
- `POST /api/ai/template/generate` AI 生成接口
- `POST /api/ai/template/refine` AI 修改接口

## 刷新与路由回退

项目路由当前采用 `BrowserRouter`。

为了避免在静态托管场景下直接刷新 `/dashboard`、`/editor`、`/published` 等页面出现 404，项目增加了以下处理：

- 在 `public/404.html` 中将未知路径重定向回根路径，并保留原始访问地址
- 在 `index.html` 中恢复重定向前的前端路由地址
- 在本地 `vite dev` / `vite preview` 环境下可直接正常刷新

## 项目结构

```text
lowcode-builder-studio/
├─ server/
│  ├─ prompts/
│  ├─ services/
│  ├─ shared/
│  ├─ utils/
│  └─ index.mjs
├─ public/
│  └─ 404.html
├─ src/
│  ├─ components/
│  ├─ materials/
│  ├─ pages/
│  ├─ renderer/
│  ├─ store/
│  ├─ types/
│  ├─ utils/
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ styles.css
├─ .env.example
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 核心模块

### 页面编辑器

- 左侧模板中心与物料区
- 中间画布编辑与预览切换
- 右侧图层树与属性配置
- 支持撤销、重做、复制、删除、导入导出

### 模板系统

- 草稿保存
- 发布当前页面
- 已发布模板回流编辑
- 模板名称搜索
- 按最近更新 / 最近发布 / 名称排序
- 按手工搭建 / AI 生成 / 文件导入筛选来源
- 模板 JSON 导入导出
- 页面 HTML 导出

### AI 模块

- 前端通过发布页对话区发起请求
- 后端通过 `Node.js + Express` 封装 AI 接口
- 接入真实 AI 完成聊天、生成与修改
- `chat / generate / refine` 支持 SSE 流式反馈
- 接口异常时回退到本地规则兜底方案

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

将 `.env.example` 复制为 `.env`，并补充你的密钥配置：

```env
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=
AI_SERVER_PORT=8787
```

### 3. 启动前端开发环境

```bash
npm run dev
```

或者：

```bash
npm run dev:client
```

### 4. 启动 AI 服务

```bash
npm run dev:server
```

### 5. 打包构建

```bash
npm run build
```

### 6. 本地预览构建结果

```bash
npm run preview
```

## 默认说明

- 项目路由当前采用 `BrowserRouter`
- 已补充静态托管场景下的 `404.html` 回退页，减少刷新子路由时出现 404 的问题
- 模板数据默认保存在浏览器本地存储中
- AI 接口不可用时，系统会自动切换到本地引导模式
