# PMP 2026 中英双语备考资料库

版本：2026.08.17 ｜ 适用考试：2026 年 7 月 9 日起启用的新版 PMP 考试

本资料库用于“一对一互动学习 + 系统复习 + 原创练习”。内容以 PMI 公开的 2026 Examination Content Outline（ECO）为考试范围骨架，并结合 PMBOK® Guide 第八版公开介绍、敏捷/混合通用实践整理。它不是 PMI 官方教材，也不承诺覆盖任何未公开试题。

## 快速开始

1. 先读 `00_导航与说明/00_资料库地图.md` 与 `01_互动教学/01_一对一互动式教学与教练规则.md`。
2. 用 `02_知识总表/2026_PMP_中英双语全知识点总表.md` 做诊断，选择第一个未掌握知识点。
3. 每次只学一个知识点；完成理解提问和原创考点题后再继续。
4. 每两个新知识点执行一次“倒回复习”。
5. 做题时只打开题目文件；完成后再打开相邻的 `答案解析` 文件。
6. 将结果记录到 `06_错题与薄弱跟踪/2026_PMP_学习跟踪工作簿.xlsx`。

## 资料库结构

- `00_导航与说明`：地图、边界、命名规则
- `01_互动教学`：教学状态机、教练规则、会话模板
- `02_知识总表`：中英双语全知识点索引（Markdown/CSV）
- `03_章节讲义`：12 个可独立扩展章节
- `04_原创题库`：按知识点、章节、综合模拟分层，题答分离
- `05_案例库`：Predictive/Agile/Hybrid、三大 Domain、AI、Sustainability
- `06_错题与薄弱跟踪`：记录模板与 Excel 仪表板
- `07_章节测试与复习`：章节测试模板、12 周计划、每日清单
- `08_来源与版本`：官方来源、更新日志、内容边界

## 四级标记

- 🔴 必考 Must Know：必须能解释、辨别并用于情境决策
- 🟠 高频 High Frequency：需理解常见用法与出题角度
- 🟡 易错 Easy to Confuse：重点训练相似概念与陷阱
- ⚪ 了解 Awareness：识别概念和适用场景即可

注意：等级是学习优先级，不代表 PMI 公布了单个知识点的出题概率。ECO 只公布 Domain 权重。

## 内容诚信边界

本库中的练习题、案例和解析均为原创。禁止向本库添加机经、回忆题、所谓“原题”、付费题库盗版内容或任何违反考试保密协议的材料。

官方范围：https://www.pmi.org/-/media/pmi/documents/public/pdf/microsites/announcements/pmp-examination-content-outline-2026.pdf

## Private Alpha 应用

本资料库现已进入 Development Implementation。Cloudflare Worker + D1 应用位于 `apps/web`，内容校验与 D1 seed 管线位于 `packages/content`。

- 本地开发、账号初始化和部署步骤：[`DEVELOPMENT.md`](DEVELOPMENT.md)
- 本轮实施交付与门禁记录：[`project-lifecycle/05-implementation/README.md`](project-lifecycle/05-implementation/README.md)
