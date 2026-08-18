# PMP AI 教学平台优化实施方案（Private Alpha）

版本：V1.1（优化补充版）  
适用阶段：两人远程使用 / 非商用 Private Alpha  
部署目标：Cloudflare Worker + D1，可公网 HTTPS 登录，后续可无损切换正式域名

---

## 0. 执行结论

当前平台继续坚持原有的**按章节逐步教学**逻辑，不改成“按知识点自由跳转”的学习模式。

核心结构统一为：

```text
课程
  ↓
章节 Chapter（决定教学主线与顺序）
  ↓
知识点 Knowledge Point（决定最小掌握单元）
  ↓
Teaching Block（讲解 / 案例 / 主动回忆 / 练习 / 纠错 / 变式）
  ↓
题目 / 案例映射（决定本次表现应更新哪些知识点）
  ↓
user_knowledge_state（记录个人掌握度）
```

本次优化重点解决四个问题：

1. 63 道题与 209 个知识点之间缺少可靠显式映射。
2. 20 个案例与知识点之间缺少可靠显式映射。
3. 209 个知识点的教学内容厚度不一致，部分仅为索引/重点/易错提示，不能让 AI 自由补全。
4. 当前仅两人使用，需要先实现公网远程登录、跨设备同步，并为后续正式域名切换保留兼容性。

当前不做商用，不做支付，不开放公共注册，不要求一次性把 209 个知识点全部扩写成完整教材。

---

# 1. 教学主线：仍然严格按章节推进

## 1.1 章节与知识点的职责边界

平台必须保持以下原则：

```text
章节 = 教学主线
知识点 = 章节内部最小掌握单元
题目 / 案例 = 验证知识点掌握情况的工具
掌握度 = 用户个人状态，不决定课程结构本身
```

例如：

```text
Chapter 01
│
├── KP-001
│   ├── Explanation
│   ├── Case Judgment
│   ├── Active Recall
│   ├── Exam Practice
│   ├── Diagnose / Remediate
│   └── Variation Check
│
├── KP-002
│   └── 同一教学循环
│
├── KP-003
│
└── Chapter Test
```

平台不能因为存在 `question_knowledge` 映射，就把教学模式改成“用户随机选择知识点”。

映射只负责回答：

> 当用户在当前章节做某一道题或案例时，这次表现应该影响哪些知识点的 mastery？

---

## 1.2 章节状态机

保持服务端确定性状态机：

```text
ChapterPreview
    ↓
Explain
    ↓
CaseJudgment
    ↓
ActiveRecall
    ↓
ExamPractice
    ↓
┌───────────────────────────────┐
│ 错误 / 猜对 / 理由不足       │
└───────────────────────────────┘
    ↓
Diagnose
    ↓
Remediate
    ↓
Retry
    ↓
VariationCheck
    ↓
PointPassed
    ↓
累计两个新知识点？
    ├── 是 → ReverseRecall
    └── 否 → 下一个知识点
    ↓
章节完成
    ↓
ChapterTest
    ↓
ReviewPlan
    ↓
下一章节
```

特殊动作：

- `ask_ai`：临时回答，回答后恢复原教学状态。
- `hint`：Hint 1 → Hint 2 → Hint 3，不提前泄露完整答案。
- `not_understood`：切换解释策略，而不是重复原文。
- `exam_mode`：服务端完全禁止 hint / ask_ai / not_understood。

---

# 2. 优先问题一：建立题目 / 案例到知识点的显式映射

## 2.1 为什么必须做

当前题目 ID（例如 `KP-FOUND-001`）不是知识点 ID（例如 `KP-001`）。

仅依赖 Domain / Task 无法可靠判断：

```text
用户答错这一题
      ↓
应该降低哪个知识点的 mastery？
```

因此必须建立正式关系表：

```text
question_knowledge
case_knowledge
```

否则自适应评分、薄弱点诊断、复习计划都缺少可靠依据。

---

## 2.2 question_knowledge 结构

推荐字段：

```text
question_knowledge
├── question_id
├── knowledge_id
├── role            primary | secondary
├── weight          0.0 ~ 1.0
├── reason          映射原因 / 审核说明
└── reviewed        true | false
```

示例：

```text
KP-FOUND-001
├── KP-001   primary     0.80
└── KP-017   secondary   0.20
```

如果题目只验证一个知识点：

```text
KP-AGILE-003
└── KP-087   primary     1.00
```

约束：

1. 每道题至少存在一个 `primary` 知识点。
2. 每个 `knowledge_id` 必须真实存在于 209 个知识点中。
3. 同一题的全部映射权重总和必须为 `1.0`。
4. 所有正式映射必须经过人工确认，`reviewed=true` 才能用于 mastery 更新。
5. AI / 脚本可以生成候选，但不能自动决定最终正式映射。

---

## 2.3 case_knowledge 结构

推荐字段：

```text
case_knowledge
├── case_id
├── knowledge_id
├── role            primary | secondary
├── weight          0.0 ~ 1.0
├── reason
└── reviewed        true | false
```

案例同样允许覆盖多个知识点。

---

## 2.4 映射生成方式

当前只有 63 道题和 20 个案例，不需要建设复杂自动标注系统。

推荐：

```text
题目 / 案例
   ↓
规则 + AI 生成候选知识点
   ↓
人工确认 primary / secondary
   ↓
保存 mapping
   ↓
CI 校验
```

候选生成可参考：

- Domain
- Task
- Approach
- 题干关键词
- 解析关键词
- 知识点中文名称
- English Term
- Exam Focus
- Common Trap

但最终结果必须由人工确认。

---

## 2.5 映射验收指标

```text
Questions:           63
Mapped Questions:    63
Unmapped Questions:   0

Cases:               20
Mapped Cases:        20
Unmapped Cases:        0

Invalid KP IDs:       0
Missing Primary:      0
Weight Errors:        0
Unreviewed Used:      0
```

只要出现 `Unmapped > 0`，内容构建失败。

---

# 3. Mastery V1：先用简单、可解释、可版本化规则

第一版不使用 LLM 直接生成 mastery 分数。

错误方式：

```text
LLM：我觉得 mastery = 0.73
```

正确方式：

```text
系统根据版本化规则计算 mastery
```

推荐基础规则示例：

```text
答对：
primary    +0.10
secondary  +0.03

答错：
primary    -0.12
secondary  -0.03

答对但 guessed=true：
primary    +0.02
```

同时记录：

- correct / incorrect
- confidence
- elapsed_ms
- guessed
- error_code（K/C/M/R/Q/E）
- variation_check
- review_interval
- correct_streak

每次算法更新必须记录：

```text
algorithm_version = mastery-v1
```

以后升级为 `mastery-v2` 时，不改变历史事件，只改变计算逻辑。

---

# 4. 优先问题二：解决 209 个知识点内容厚度不一致

## 4.1 不一次性把 209 个知识点全部扩写成教材

当前资料存在大量：

- 索引
- 高频对比
- 行动规则
- 易错点
- 考试重点

并不是每一个知识点都已经具有完整教学正文。

因此第一版不要求：

```text
209 / 209 全部扩写成完整教材
```

而是新增明确的内容覆盖状态。

---

## 4.2 content_coverage

每个知识点至少设置：

```text
content_coverage:
  teachable
  brief
  index_only
```

定义如下：

| 状态 | 含义 | AI 行为 |
|---|---|---|
| `teachable` | 有足够教学材料 | 可以基于资料进行完整 Teaching Block |
| `brief` | 有重点、规则、陷阱，但内容不完整 | 允许有限解释，不得超出资料事实范围 |
| `index_only` | 只有术语 / 索引 / 定位 | 禁止 AI 自由补写教材，必须降级 |

---

## 4.3 最小可教学单元标准

知识点达到 `teachable`，建议至少具备：

1. **Definition**：这个概念是什么。
2. **Exam Logic**：考试中通常如何判断。
3. **Decision Rule**：遇到场景时如何做决策。
4. **Common Trap**：最容易犯什么错误。
5. **Example**：至少一个原创场景。
6. **Source**：内容依据 / 章节来源。

示例：

```text
KP-001 项目 vs 运营

Definition:
项目创造独特成果；运营持续维持业务活动。

Exam Logic:
不能仅因为存在结束日期就判断为项目。

Decision Rule:
优先判断是否创造独特成果，以及是否属于持续重复业务。

Common Trap:
“只有三个月，因此一定是项目。”

Example:
物流中心连续三周处理旺季订单……

Source:
Chapter 01 / 高频对比
```

这已经足以支撑第一版 Teaching Block，不要求写成完整长篇教材。

---

## 4.4 内容完善优先级

按以下顺序补内容：

```text
第一优先级
63 道题涉及的知识点

第二优先级
20 个案例涉及的知识点

第三优先级
红色 / 高频 / 易错知识点

第四优先级
剩余知识点
```

目的：先让当前章节主线中真实会被练习、案例和复习使用的知识点达到可教学状态。

---

## 4.5 内容覆盖验收指标

第一版要求：

```text
209 / 209
全部存在 content_coverage 状态
```

但不要求全部为 `teachable`。

要求：

```text
当前练习实际涉及的知识点：100% >= brief
允许 AI 主动教学的知识点：100% = teachable
index_only：禁止自由扩写
```

---

# 5. RAG / AI 的正确使用方式

## 5.1 当前阶段不急于上 Vectorize

Private Alpha 第一阶段：

```text
Markdown / JSON
    ↓
规范化内容
    ↓
D1 + FTS5
    ↓
匹配当前章节 / 当前知识点可靠内容
    ↓
Teaching Engine
    ↓
LLM 生成受约束表达
```

Vectorize / embedding 仅在后续检索基准证明必要时启用。

---

## 5.2 AI 必须受 content_coverage 约束

### teachable

```text
允许：
- 完整解释
- 示例
- 类比
- 分步讲解
- 问答
- 引用资料
```

### brief

```text
允许：
- 对已有规则进行解释
- 对已有示例进行拆解
- 根据现有材料做有限教学表达

禁止：
- 补充资料中未提供的考试事实
- 自由扩写 PMI 规则
```

### index_only

直接降级：

```text
当前资料仅包含该知识点的索引与考试定位，
暂不足以生成完整教学讲解。
```

不得让 LLM 自由补知识。

---

# 6. 今日学习：主线学习与到期复习分离

“今日学习”不能打乱首次学习的章节主线。

推荐生成两个队列：

```text
今日学习
│
├── A. 到期复习
│      已经学过章节中的薄弱 / 到期知识点
│
└── B. 主线学习
       当前 Chapter → 当前 KP → 下一个 KP
```

例如：

```text
当前主线：Chapter 04 / KP-071

今日到期复习：
- Chapter 01 / KP-003
- Chapter 02 / KP-026

今日计划：
1. 复习 KP-003
2. 复习 KP-026
3. 回到 Chapter 04
4. 学习 KP-071
5. 学习 KP-072
```

原则：

- 首次学习：严格按章节。
- 已学内容：允许跨章节复习。
- 不允许因为复习队列改变课程章节顺序。

---

# 7. 当前两人使用：Private Alpha 登录方案

当前阶段用户只有：

```text
User A：本人
User B：朋友
```

建议保留正式 `users / sessions` 架构，但关闭公共注册。

---

## 7.1 登录策略

Private Alpha：

```text
Public Signup       = OFF
Email Verification  = 手工标记 verified
Password Reset      = Admin 手工重置
Social Login        = OFF
WeChat Login        = OFF
Phone Login         = OFF
Payment             = OFF
```

账号通过受控初始化脚本创建。

这样不会产生数据模型技术债，同时避免当前阶段引入邮件、验证码、开放注册和滥用防护复杂度。

---

## 7.2 用户隔离

必须保证：

```text
User A
├── 自己的 learning_sessions
├── 自己的 attempts
├── 自己的 mastery
└── 自己的 review_schedule

User B
├── 自己的 learning_sessions
├── 自己的 attempts
├── 自己的 mastery
└── 自己的 review_schedule
```

任何用户数据查询必须在数据库层绑定：

```text
WHERE id = ? AND user_id = ?
```

不能仅靠前端隐藏。

---

# 8. 公网远程访问

当前目标：两个人可以在不同网络、不同设备上远程打开。

部署结构：

```text
浏览器 / 手机
     │
     │ HTTPS
     ↓
https://xxx.workers.dev
     │
Cloudflare Worker
├── Web / PWA
├── /api/v1
├── Auth
├── Teaching Engine
└── D1
```

特点：

- 不依赖本地电脑开机。
- 不需要端口映射。
- 不需要 VPN。
- 用户从公网 HTTPS 地址直接访问。
- 学习状态统一保存在 Cloudflare D1。
- 两个人可以跨设备继续学习。

---

# 9. 域名设计：现在 workers.dev，后续可切正式域名

## 9.1 前端禁止写死域名

禁止：

```ts
const api = "https://pmp-test.workers.dev/api/v1";
```

推荐所有浏览器 API 使用同源路径：

```text
/api/v1/...
```

配置项保留：

```text
APP_ORIGIN
AUTH_ORIGIN
```

---

## 9.2 当前地址

```text
https://<project>.workers.dev
```

未来：

```text
https://learn.example.com
```

结构保持：

```text
learn.example.com
       ↓
同一个 Worker
       ↓
同一个 D1
       ↓
同一批 users
       ↓
同一份学习数据
```

不迁数据库。

---

## 9.3 Cookie 策略

推荐使用 host-only Cookie，不使用：

```text
Domain=.example.com
```

从：

```text
xxx.workers.dev
```

切换到：

```text
learn.example.com
```

后，两名用户重新登录一次即可。

学习记录、mastery、attempts、review schedule 均不受影响。

---

# 10. Private Alpha 当前功能范围

| 模块 | 当前是否实施 | 说明 |
|---|---|---|
| React Web/PWA | 是 | 响应式 Web |
| Cloudflare Worker | 是 | Web + API 同域 |
| D1 | 是 | 用户、内容、状态、练习 |
| 两个固定账号 | 是 | 受控创建 |
| 公网 HTTPS | 是 | workers.dev |
| 跨设备进度 | 是 | D1 |
| 章节主线 | 是 | 核心教学逻辑 |
| 63 题映射 | 必须 | P0 阻断项 |
| 20 案例映射 | 必须 | P0 阻断项 |
| mastery-v1 | 是 | 确定性规则 |
| content_coverage | 必须 | 控制 AI 教学深度 |
| Teaching Block | 是 | 按章节逐步教学 |
| D1 FTS5 | 是 | 当前搜索 / RAG 基线 |
| AI Gateway | 建议 | AI 调用观测与回退 |
| Vectorize | 暂不启用 | 验证检索收益后再加 |
| Queues | 暂不启用 | 当前规模无必要 |
| R2 | 备份阶段再启用 | 不作为当前内容主存储 |
| 公共注册 | 否 | Private Alpha |
| Resend | 暂不启用 | 当前无邮件验证需求 |
| Turnstile | 暂不启用 | 关闭公共注册后可延后 |
| 支付 | 否 | 非商用 |
| App / MiniApp | 否 | Web/PWA 优先 |

---

# 11. 优化后的阶段 0

## 阶段 0A：工程与部署骨架

交付：

- 初始化 Git。
- pnpm workspace。
- React Router + Worker。
- Wrangler。
- D1。
- local / preview / staging / production 环境约定。
- workers.dev 公网预览。
- 两个预置用户。
- 登录 / 退出 / session。

验收：

```text
User A 可远程登录
User B 可远程登录
A / B 数据隔离
电脑关机后公网地址仍可访问
手机 / PC 均可打开
```

---

## 阶段 0B：内容契约

交付：

- 209 个 Knowledge Point schema。
- 63 个 Question schema。
- 20 个 Case schema。
- question_knowledge。
- case_knowledge。
- content_coverage。
- Teaching Block schema。
- 内容 lint / manifest。
- D1 seed。
- 答案泄漏扫描。

验收：

```text
209 / 209 knowledge points valid
63 / 63 questions mapped
20 / 20 cases mapped
0 invalid knowledge id
0 missing primary mapping
0 answer/rationale leaked to browser bundle
209 / 209 have content_coverage
```

---

## 阶段 0C：章节教学最小闭环

至少选择一个章节完成端到端验证：

```text
ChapterPreview
→ KP Explanation
→ Case
→ Recall
→ Practice
→ Diagnose
→ Remediate
→ VariationCheck
→ PointPassed
→ Next KP
→ ChapterTest
```

验收：

- 当前章节顺序确定。
- 当前知识点顺序确定。
- 练习题能通过 mapping 更新正确 KP。
- 错答能够触发补救。
- 刷新浏览器不会丢失状态。
- User A 与 User B 状态独立。

---

# 12. 后续再做的事项

Private Alpha 稳定后再逐步增加：

1. 邮箱验证 / 密码找回。
2. Turnstile。
3. 正式自定义域名。
4. R2 长期备份。
5. 更完整的 209 KP 教学内容。
6. 100 条检索基准。
7. Vectorize / Hybrid Search（仅收益明确时）。
8. 自动内容发布 / Queue / DLQ。
9. App / MiniApp。
10. 商业化 / 支付 / 合规。

---

# 13. 最终数据闭环

```text
现有 PMP 内容
      │
      ├───────────────────┐
      ↓                   ↓
63 Questions          20 Cases
      │                   │
      ↓                   ↓
question_knowledge    case_knowledge
      └─────────┬─────────┘
                ↓
       209 Knowledge Points
                │
         content_coverage
                │
       ┌────────┼──────────┐
       ↓        ↓          ↓
   teachable   brief   index_only
       │        │          │
   完整教学   有限教学     降级
       └────────┬──────────┘
                ↓
       Chapter Teaching Engine
                │
                ↓
         user_knowledge_state
                │
        ┌───────┴───────┐
        ↓               ↓
      User A           User B
        │               │
        └───────┬───────┘
                ↓
          Cloudflare D1
                ↑
         Worker + HTTPS
                ↑
workers.dev → 后续正式域名
```

---

# 14. 当前实施优先级

当前不要先做 Vectorize，也不要先扩展 App/MiniApp。

真正的实施顺序：

```text
P0-1  公网 Worker + 两人登录
  ↓
P0-2  63 题 question_knowledge
  ↓
P0-3  20 案例 case_knowledge
  ↓
P0-4  209 KP content_coverage
  ↓
P0-5  mastery-v1
  ↓
P0-6  一个章节完整 Teaching Engine 闭环
  ↓
P0-7  扩展至全部章节
  ↓
P0-8  章节测试 / 报告 / 复习计划
```

只要上述链路跑通，当前系统已经属于**真实可远程使用的 Private Alpha**，而不是静态 Demo。

