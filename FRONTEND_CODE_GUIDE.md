# RUNLOOP AI 教学课堂前端代码说明

> 文档状态：基于当前 `apps/web` 实际代码整理  
> 前端入口：`http://127.0.0.1:5173`  
> 部署目标：Cloudflare Workers + Static Assets

## 1. 前端概览

当前 Web 端采用 React 单页应用结构。所有页面运行在同一个 Web 端口，通过浏览器路由区分具体功能页面。

- 开发端口：`5173`
- 路由模式：`BrowserRouter`
- UI 框架：React 19
- 开发与构建：Vite 8
- 类型系统：TypeScript 7
- 路由：React Router 8
- 部署适配：Cloudflare Vite Plugin + Wrangler
- 数据请求：原生 `fetch` 封装
- 样式方案：全局 CSS、响应式断点、CSS 变量

## 2. 前端目录结构

```text
apps/web/
├── index.html                  # HTML 入口
├── public/
│   ├── _headers               # Cloudflare 静态资源响应头
│   ├── manifest.webmanifest   # PWA 基础配置
│   └── runloop-wordmark.png   # RUNLOOP 品牌 Logo
├── src/
│   ├── main.tsx               # React 挂载与 BrowserRouter
│   ├── App.tsx                # 登录状态、懒加载和总路由表
│   ├── api.ts                 # 数据类型、GET/POST 请求封装
│   ├── styles.css             # 全站设计系统与页面样式
│   ├── components/
│   │   ├── Brand.tsx          # Logo 与品牌组件
│   │   └── PageState.tsx      # 加载、空状态等通用反馈
│   ├── layouts/
│   │   └── AppShell.tsx       # 顶部导航、侧栏、移动端导航
│   └── pages/
│       ├── LoginPage.tsx      # 登录页
│       ├── DashboardPage.tsx  # 学习总览
│       ├── WorkspacePages.tsx # 课程中心及侧栏独立页面
│       ├── LearningPage.tsx   # AI 互动课堂
│       ├── PracticePage.tsx   # AI 自适应练习
│       ├── ExamHubPage.tsx    # 题库测评与组卷入口
│       ├── ExamSessionPage.tsx# 考试作答页面
│       ├── ReportsPage.tsx    # 学习数据看板
│       └── KnowledgePage.tsx  # PMP 知识检索
├── vite.config.ts             # Vite 与 Cloudflare 插件配置
├── wrangler.jsonc             # Cloudflare 部署和 D1 绑定
├── tsconfig.json              # TypeScript 配置
└── package.json               # 前端命令与依赖
```

## 3. 应用启动流程

```text
index.html
   ↓
src/main.tsx
   ↓
BrowserRouter
   ↓
App.tsx 获取 /api/v1/auth/me
   ├── 未登录 → /login
   └── 已登录 → AppShell
                  ├── 顶部功能导航
                  ├── 左侧工作区导航
                  └── Outlet 页面内容
```

入口代码：

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

## 4. 路由设计

### 4.1 顶部一级功能导航

| 功能 | 路由 | 页面组件 | 数据状态 |
|---|---|---|---|
| 课程中心 | `/courses` | `CourseCenterPage` | 前端视觉数据 |
| 学习路径 | `/learn` | `LearningPage` | 已接 API |
| AI 导师 | `/practice` | `PracticePage` | 已接 API |
| 题库测评 | `/exam` | `ExamHubPage` | 已接 API |
| 数据看板 | `/reports` | `ReportsPage` | 已接 API |

### 4.2 左侧学习工作区导航

| 功能 | 路由 | 页面组件 | 数据状态 |
|---|---|---|---|
| 总览 | `/` | `DashboardPage` | 前端视觉数据 |
| 我的课程 | `/my-courses` | `MyCoursesPage` | 前端视觉数据 |
| 今日任务 | `/tasks` | `TodayTasksPage` | 前端视觉数据 |
| 课程日历 | `/calendar` | `CourseCalendarPage` | 前端视觉数据 |
| 学习社区 | `/community` | `CommunityPage` | 前端视觉数据 |
| 设置 | `/settings` | `SettingsPage` | 前端本地交互 |

### 4.3 其他功能路由

| 功能 | 路由 | 说明 |
|---|---|---|
| 登录 | `/login` | 未登录用户入口 |
| 知识检索 | `/knowledge` | PMP 知识库全文检索 |
| 考试作答 | `/exam/:examId` | 独立沉浸式考试页面 |

顶部导航和左侧导航现在使用不同路径，不再把“课程日历”映射到 `/exam`，也不再把“设置”映射到 `/reports`。

## 5. 页面模块说明

### 5.1 登录页 `LoginPage.tsx`

- 展示 RUNLOOP 品牌 Logo。
- 提交邮箱与密码。
- 调用 `POST /api/v1/auth/login`。
- 登录成功后由 `App.tsx` 更新用户状态并进入系统。

### 5.2 学习总览 `DashboardPage.tsx`

- 欢迎信息：当前为“欢迎回来，邱同学”。
- 今日学习时长、连续学习天数、完成率和排名。
- AI 导师对话视觉样例。
- 推荐课程、学习路径、任务和学习数据。
- 当前主要用于 UI 验收，页面标注“暂未接入实时数据”。

### 5.3 工作区页面 `WorkspacePages.tsx`

该文件集中维护侧栏对应的轻量页面：

- `CourseCenterPage`
- `MyCoursesPage`
- `TodayTasksPage`
- `CourseCalendarPage`
- `CommunityPage`
- `SettingsPage`

这些页面已经拥有独立 URL 和独立选中状态，后续可逐个替换为真实接口数据。

### 5.4 AI 互动课堂 `LearningPage.tsx`

主要流程：

```text
读取学习总览
   ↓
不存在当前会话时创建学习会话
   ↓
概念讲解
   ↓
案例判断
   ↓
主动回忆
   ↓
考点训练
   ↓
变式验证
```

核心体验：

- 展示章节、知识点进度和学习阶段。
- AI 导师根据当前阶段提供不同内容。
- 学员提交开放式回答、选择置信度、标记是否存在猜测。
- 提交按钮拥有明确的禁用、可提交和提交中状态。
- 支持提示、知识点回顾、继续下一阶段。

### 5.5 AI 自适应练习 `PracticePage.tsx`

- 获取学习洞察和薄弱点。
- 根据错题或掌握度生成练习。
- 支持题量和练习策略选择。
- 创建练习后进入 `/exam/:examId`。

### 5.6 题库测评 `ExamHubPage.tsx`

- 模拟考试与章节练习使用两个独立模式卡片。
- 支持题量、考试时长和组卷策略设置。
- 显示最近练习和考试记录。
- 创建考试后跳转到考试作答页面。

### 5.7 考试作答 `ExamSessionPage.tsx`

- 根据 `examId` 获取试卷。
- 保存每一题答案。
- 显示考试倒计时。
- 支持交卷、评分和结果复盘。

### 5.8 数据看板 `ReportsPage.tsx`

- 学习次数与正确率。
- 平均作答时长、猜测率。
- 考试数量与平均分。
- 活跃度、薄弱知识点和复习建议。

### 5.9 知识检索 `KnowledgePage.tsx`

- 根据关键词查询 PMP 知识点。
- 返回中英文标题、考试重点和内容覆盖状态。
- 支持从检索结果直接进入课堂。

## 6. API 数据层

前端请求统一通过 `src/api.ts`：

```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });

  const payload = await response.json() as T & ApiError;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "请求失败，请稍后重试");
  }
  return payload;
}

export const post = <T>(path: string, payload: unknown) =>
  api<T>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
```

### 前端使用的接口

| 方法 | 接口 | 使用页面 |
|---|---|---|
| GET | `/api/v1/auth/me` | `App.tsx` |
| POST | `/api/v1/auth/login` | `LoginPage` |
| POST | `/api/v1/auth/logout` | `AppShell` / `App.tsx` |
| GET | `/api/v1/dashboard` | `LearningPage` |
| POST | `/api/v1/learning/start` | `LearningPage` |
| POST | `/api/v1/learning/advance` | `LearningPage` |
| POST | `/api/v1/learning/respond` | `LearningPage` |
| GET | `/api/v1/exams` | `ExamHubPage` |
| POST | `/api/v1/exams/generate` | `ExamHubPage`、`PracticePage` |
| GET | `/api/v1/exams/session` | `ExamSessionPage` |
| POST | `/api/v1/exams/answer` | `ExamSessionPage` |
| POST | `/api/v1/exams/submit` | `ExamSessionPage` |
| GET | `/api/v1/insights` | `PracticePage`、`ReportsPage` |
| GET | `/api/v1/search` | `KnowledgePage` |

## 7. 状态管理

当前 Private Alpha 没有引入 Redux、Zustand 等全局状态库，主要使用 React 原生状态：

- `App.tsx`：当前登录用户。
- 页面组件：加载、错误、表单和接口结果。
- URL：当前功能模块、考试 ID。
- 服务端：学习会话、考试答案、掌握度和复习记录。

这一方案适合当前规模。只有在跨页面共享状态明显增多时，才建议引入独立状态库。

## 8. 样式与响应式设计

所有样式当前集中在 `src/styles.css`。

### 主要 CSS 变量

```css
:root {
  --ink: #142235;
  --ink-strong: #071b33;
  --canvas: #f4f6f8;
  --surface: #ffffff;
  --primary: #0b5fc6;
  --teal: #0aa8a1;
  --success: #13875f;
  --warning: #a66b11;
  --error: #b23d3d;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
```

### 响应式断点

- `1180px`：压缩导航与多栏内容。
- `900px`：隐藏桌面侧栏，启用移动端底部导航。
- `620px`：表单、课程、时间轴和考试模式切换为单列。
- `prefers-reduced-motion`：减少动画，满足可访问性要求。

### 当前样式分区

```text
设计变量与基础元素
应用外壳和导航
登录页
学习总览
互动课堂
题库测评
知识检索与数据看板
独立工作区页面
响应式与无障碍动画设置
```

## 9. 本地开发

在项目根目录执行：

```bash
pnpm install
pnpm dev
```

访问：

```text
http://127.0.0.1:5173
```

本项目为单体全栈开发模式，前端页面和 `/api/*` 共用同一个开发端口。不同页面使用不同路由，不需要为每个页面启动单独端口。

## 10. 检查、测试和构建

```bash
# 内容与前端完整检查
pnpm check

# 仅检查前端类型并执行生产构建
pnpm --filter @pmp/web check

# 执行测试
pnpm test

# 仅构建前端与 Worker
pnpm --filter @pmp/web build
```

## 11. Cloudflare 部署

```bash
# 部署当前环境
pnpm --filter @pmp/web deploy

# 部署 staging
pnpm --filter @pmp/web deploy:staging
```

`wrangler.jsonc` 当前配置：

- 静态资源按 SPA 方式回退。
- `/api/*` 优先交给 Worker。
- D1 数据库绑定名为 `DB`。
- 已划分 local、staging、production 环境。
- 已开启 Cloudflare Observability。

正式部署前必须把示例 D1 `database_id` 替换为 Cloudflare 控制台中的真实 ID。

## 12. 当前完成度与后续整理建议

### 已完成

- 登录与鉴权路由保护。
- 桌面和移动端应用外壳。
- 顶部导航与侧栏独立路由。
- AI 互动课堂完整前端流程。
- 智能练习、模拟考试和考试复盘。
- 学习洞察与知识检索。
- 响应式布局和基础可访问性。
- Cloudflare Worker/Assets 构建适配。

### 仍需接入真实数据

- 学习总览卡片。
- 课程中心和我的课程。
- 今日任务与课程日历。
- 学习社区。
- 设置持久化。

### 推荐的下一轮代码整理

1. 将 `WorkspacePages.tsx` 按功能拆成独立页面文件。
2. 将 `styles.css` 拆分为 `tokens.css`、`shell.css` 和页面样式。
3. 把示例课程、任务和日历数据移入统一的 mock 数据模块。
4. 为路由路径建立常量，避免组件内直接书写字符串。
5. 为登录、学习会话、组卷和交卷增加前端集成测试。
6. 将所有视觉样例逐步切换为真实 API 数据。

