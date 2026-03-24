# lowcode-builder-studio

一个基于 `React + TypeScript + Zustand + React Router + Node.js` 的低代码页面搭建平台示例项目，支持页面可视化编辑、模板保存发布、模板导入导出以及 AI 对话式生成与修改。

## 项目功能

- 登录页与会话状态管理
- 页面编辑器三栏布局
- 组件拖拽编排与容器嵌套
- 图层树与属性面板联动
- 模板草稿保存与发布管理
- 模板 JSON / HTML 导入导出
- AI 对话式生成与修改
- 深色 / 浅色主题切换

## 技术栈

- React 18
- TypeScript
- Zustand
- React Router（HashRouter）
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

- `GET /api/health` AI 服务状态检测
- `POST /api/ai/template/chat` AI 对话接口
- `POST /api/ai/template/generate` AI 生成接口
- `POST /api/ai/template/refine` AI 修改接口

## 项目结构

```text
lowcode-builder-studio/
├─ server/                    AI 服务端
│  ├─ prompts/                Prompt 组装
│  ├─ services/               OpenAI 调用服务
│  ├─ shared/                 共享结构定义
│  ├─ utils/                  服务端工具函数
│  └─ index.mjs               服务入口
├─ src/
│  ├─ components/             编辑器与后台公共组件
│  ├─ materials/              低代码物料注册表
│  ├─ pages/                  页面级组件
│  ├─ renderer/               Schema 渲染器
│  ├─ store/                  Zustand 状态管理
│  ├─ types/                  类型定义
│  ├─ utils/                  工具函数与 AI 兜底逻辑
│  ├─ App.tsx                 应用路由与登录态控制
│  ├─ main.tsx                应用入口
│  └─ styles.css              全局样式
├─ .env.example               环境变量示例
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
- 模板 JSON 导入导出
- 页面 HTML 导出

### AI 模块

- 前端通过发布页对话区发起请求
- 后端通过 `Node.js + Express` 封装 AI 接口
- 接入真实 AI 完成聊天、生成与修改
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

- 项目路由当前采用 `HashRouter`
- 模板数据默认保存在本地浏览器存储中
- AI 接口不可用时，系统会自动切换到本地引导模式
