# Process：进度、成本、财务与状态

## 本章定位

覆盖依赖、关键路径、估算、压缩、EVM、储备、指标和敏捷流动度量。

## 逻辑主线

进度题先找依赖和关键路径，再选择压缩方法。EVM 题先固定状态日和 PV/EV/AC 含义，再计算方向。公式服务于判断，不替代根因分析。

## 高频对比

| 概念 A | 概念 B | A 的焦点 | B 的焦点 |
|---|---|---|---|
| Crashing | Fast Tracking | 加资源/成本压缩 | 重叠工作，增加风险返工 |
| Contingency Reserve | Management Reserve | 已识别风险，通常在成本基准内 | 未知未知，通常在基准外 |
| SPI | Velocity | 预算价值进度指数 | 团队相对工作量历史能力 |

## 情境题行动规则

1. 关键路径是决定总工期的最长路径，不是最长单项活动。
2. CV=EV-AC、SV=EV-PV；正值有利。CPI=EV/AC、SPI=EV/PV；大于 1 有利。
3. EAC 公式必须与未来偏差假设匹配。
4. Velocity 只用于本团队预测，不跨团队比较绩效。

## 本章知识点索引（30 项）

| ID | 优先级 | 中文 | English | 考试理解 |
|---|---|---|---|---|
| KP-079 | 🟠 高频 High Frequency | 项目财务需求 | Project Financial Needs | 规划资金、现金流、报告与治理需求 |
| KP-080 | 🟡 易错 Easy to Confuse | 成本基准 | Cost Baseline | 经批准、按时间分配的项目预算，不含管理储备 |
| KP-081 | 🔴 必考 Must Know | 应急储备 | Contingency Reserve | 针对已识别风险的已知未知，通常在基准内 |
| KP-082 | 🔴 必考 Must Know | 管理储备 | Management Reserve | 针对未知未知，通常不在成本基准内 |
| KP-083 | 🟡 易错 Easy to Confuse | 计划价值 | Planned Value (PV) | 截至状态日计划完成工作的预算价值 |
| KP-084 | 🟡 易错 Easy to Confuse | 挣值 | Earned Value (EV) | 实际完成工作的预算价值 |
| KP-085 | 🟡 易错 Easy to Confuse | 实际成本 | Actual Cost (AC) | 已完成工作实际发生的成本 |
| KP-086 | 🔴 必考 Must Know | 成本偏差 | Cost Variance (CV) | CV=EV-AC；正值有利 |
| KP-087 | 🔴 必考 Must Know | 进度偏差 | Schedule Variance (SV) | SV=EV-PV；正值表示领先 |
| KP-088 | 🔴 必考 Must Know | 成本绩效指数 | Cost Performance Index (CPI) | CPI=EV/AC；大于 1 有利 |
| KP-089 | 🔴 必考 Must Know | 进度绩效指数 | Schedule Performance Index (SPI) | SPI=EV/PV；大于 1 有利 |
| KP-090 | 🟡 易错 Easy to Confuse | 完工估算 | Estimate at Completion (EAC) | 按未来绩效假设选择公式 |
| KP-091 | 🟡 易错 Easy to Confuse | 完工尚需绩效指数 | To-Complete Performance Index (TCPI) | 衡量剩余工作需达到的成本效率 |
| KP-101 | 🟠 高频 High Frequency | 里程碑 | Milestone | 零工期的重要事件或检查点 |
| KP-102 | 🟠 高频 High Frequency | 依赖关系 | Dependency | 识别强制、选择、外部、内部等依赖 |
| KP-103 | 🟠 高频 High Frequency | 完成到开始 | Finish-to-Start (FS) | 前置完成后后续才能开始 |
| KP-104 | 🔴 必考 Must Know | 关键路径 | Critical Path | 决定项目最短工期的最长路径 |
| KP-105 | 🟡 易错 Easy to Confuse | 总浮动时间 | Total Float | TF=LS-ES=LF-EF |
| KP-106 | 🔴 必考 Must Know | 赶工 | Crashing | 增加成本/资源缩短关键路径活动 |
| KP-107 | 🔴 必考 Must Know | 快速跟进 | Fast Tracking | 重叠原本顺序工作以缩短工期 |
| KP-108 | 🟠 高频 High Frequency | 类比估算 | Analogous Estimating | 用历史相似项目快速高层估算 |
| KP-109 | 🟠 高频 High Frequency | 参数估算 | Parametric Estimating | 用统计关系和单位率估算 |
| KP-110 | 🟠 高频 High Frequency | 自下而上估算 | Bottom-up Estimating | 从详细组件汇总，通常更耗时 |
| KP-111 | 🟠 高频 High Frequency | 三点估算 | Three-point Estimating | 用乐观、最可能、悲观反映不确定性 |
| KP-112 | 🟠 高频 High Frequency | 状态日 | Data Date / Status Date | 报告和绩效测量的时间截点 |
| KP-113 | 🟠 高频 High Frequency | 项目指标 | Project Metrics | 选择能支持决策和价值验证的指标 |
| KP-114 | 🟠 高频 High Frequency | 工件管理 | Artifact Management | 按需要创建、维护、访问和审查工件 |
| KP-115 | 🟡 易错 Easy to Confuse | 燃尽图 | Burndown Chart | 显示剩余工作随时间变化 |
| KP-116 | 🟡 易错 Easy to Confuse | 燃起图 | Burnup Chart | 显示已完成工作并可显示总范围 |
| KP-117 | 🟡 易错 Easy to Confuse | 速度 | Velocity | 团队每迭代完成的相对工作量，用于自身预测 |

## 互动教学建议

从索引中选择一个 🔴 或 🟡 知识点：先用自己的话解释 → 做一个场景判断 → 回答“为什么其他做法不优” → 完成一个变式。每两个新知识点后倒回复习。

## 不看答案的检查题

- 不能增加预算但必须缩短工期，应先检查什么？
- EV=80、AC=100、PV=90 时项目状态如何？不能从这些数直接得出什么？
