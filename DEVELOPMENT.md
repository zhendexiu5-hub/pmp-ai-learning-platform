# PMP AI 教学平台开发与部署

当前实现是 Private Alpha 的首个可运行纵向切片：两个受控账号、Chapter 01 的 KP-001/KP-002、完整纠错路径、mastery-v1、D1 跨设备状态，以及 209/63/20 内容契约。

## 目录

```text
apps/web/
  src/                 React 响应式工作台
  worker/              同源 API、登录、教学状态机
  migrations/          D1 schema 与生成的内容 seed
packages/content/
  src/                 映射、Teaching Block、内容 lint
  generated/           内容 manifest 与浏览器安全审计产物
scripts/
  create-alpha-user.ts 受控账号初始化
```

原始 PMP Markdown/JSON 仍是内容源，不迁入前端源码。`packages/content` 读取 `08_来源与版本/library_data.json`，验证后生成 D1 seed。任何未映射题目/案例、无 primary、权重错误、非法 KP ID 或答案泄漏都会使构建失败。

## 本地启动

要求 Node.js 22+ 与 pnpm 11.19+。

```powershell
pnpm install
pnpm content:build
pnpm --filter @pmp/web types
pnpm --filter @pmp/web db:migrate:local
```

创建两个本地账号。密码只通过临时环境变量传入，不写入仓库：

```powershell
$env:PMP_ALPHA_PASSWORD = '<至少 12 位的 User A 密码>'
pnpm user:create -- --email 'user-a@example.com' --name 'User A'

$env:PMP_ALPHA_PASSWORD = '<至少 12 位的 User B 密码>'
pnpm user:create -- --email 'user-b@example.com' --name 'User B'
Remove-Item Env:PMP_ALPHA_PASSWORD
```

启动：

```powershell
pnpm dev
```

打开 `http://localhost:5173`。浏览器始终调用 `/api/v1/...` 同源路径，不写死 workers.dev 或未来正式域名。

## 质量门禁

```powershell
pnpm types
pnpm check
pnpm test
```

门禁覆盖：

- 209 个知识点、63 道题、20 个案例 schema 与计数；
- 63/63 `question_knowledge`、20/20 `case_knowledge`；
- primary、权重、真实 KP ID、reviewed 状态；
- 209/209 `content_coverage`；
- 浏览器安全内容和 API 无 `answer` / `rationale` / `guide`；
- A/B 登录、会话、学习状态和 mastery 的数据库级隔离；
- 错答 → 诊断 → 补救 → 重试 → 变式路径。

## Cloudflare 环境

`wrangler.jsonc` 定义 local、staging、production 三套 Worker/D1 绑定。提交部署前，先在 Cloudflare 账号创建两个独立 D1 数据库：

```powershell
pnpm --filter @pmp/web exec wrangler d1 create pmp-ai-private-alpha-staging
pnpm --filter @pmp/web exec wrangler d1 create pmp-ai-private-alpha
```

将返回的真实 `database_id` 分别替换 `apps/web/wrangler.jsonc` 中 staging 与 production 的占位 ID。随后：

```powershell
pnpm --filter @pmp/web exec wrangler d1 migrations apply DB --remote --env staging
pnpm --filter @pmp/web exec wrangler d1 migrations apply DB --remote --env production
```

为目标环境创建两个账号：

```powershell
$env:PMP_ALPHA_PASSWORD = '<目标账号密码>'
pnpm user:create -- --remote --env staging --email 'user-a@example.com' --name 'User A'
Remove-Item Env:PMP_ALPHA_PASSWORD
```

部署：

```powershell
pnpm --filter @pmp/web deploy:staging
pnpm --filter @pmp/web exec vite build
pnpm --filter @pmp/web exec wrangler deploy --env production
```

首次上线使用 `*.workers.dev`。以后绑定正式域名时不改 API 路径、不迁 D1；host-only Cookie 会要求用户重新登录一次，学习数据保持不变。

## 安全与运维边界

- 公共注册、邮件找回、社交登录、支付、Vectorize、Queues、R2 均未启用。
- 密码使用 PBKDF2-SHA256（120,000 次）；会话令牌只以 SHA-256 摘要存入 D1。
- Cookie 为 HttpOnly、SameSite=Lax、host-only；HTTPS 环境自动加 Secure。
- 写请求执行同源校验；登录按 IP+邮箱摘要做 15 分钟窗口限流。
- Worker structured logs 与 Cloudflare observability 已开启；日志不记录密码、Cookie、答案或完整用户输入。
- 当前备份依赖 D1 Time Travel。R2 长期导出在 Private Alpha 稳定后启用。

生产部署尚需要 Cloudflare 账号授权、真实 D1 ID 和两名用户的正式邮箱/密码；这些值不应提交到 Git。

