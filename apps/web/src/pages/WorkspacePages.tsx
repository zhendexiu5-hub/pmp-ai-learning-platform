import { Link } from "react-router";

const courseItems = [
  { code: "PM", title: "项目管理基础", meta: "12 章 · 68%", detail: "从项目原则到情境判断", tone: "violet" },
  { code: "AG", title: "敏捷项目管理", meta: "9 章 · 26%", detail: "迭代、价值与团队协作", tone: "blue" },
  { code: "BE", title: "商业环境精讲", meta: "7 章 · 12%", detail: "合规、价值与组织变革", tone: "teal" },
] as const;

function WorkspaceHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="workspace-header"><div><p className="page-kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function CourseCenterPage() {
  return <main className="workspace-page">
    <WorkspaceHeader eyebrow="课程中心" title="选择下一门要掌握的课程" description="浏览课程内容、学习目标和当前进度，进入适合你的学习路径。" action={<Link className="primary-button" to="/my-courses">查看我的课程 <span>→</span></Link>} />
    <section className="workspace-section"><div className="workspace-section-title"><div><span>推荐课程</span><h2>继续你的 PMP 学习计划</h2></div><small>根据当前学习进度推荐</small></div>
      <div className="course-center-grid">{courseItems.map((course) => <article key={course.code} className="course-center-item"><div className={`course-center-mark ${course.tone}`}>{course.code}</div><div><h3>{course.title}</h3><p>{course.detail}</p><small>{course.meta}</small></div><Link to="/learn" aria-label={`进入${course.title}`}>进入课程 <span>→</span></Link></article>)}</div>
    </section>
  </main>;
}

export function MyCoursesPage() {
  return <main className="workspace-page">
    <WorkspaceHeader eyebrow="我的课程" title="正在学习的课程" description="集中查看课程进度，从上次离开的知识点继续。" />
    <section className="workspace-section workspace-list-section"><div className="workspace-section-title"><div><span>进行中</span><h2>3 门课程</h2></div><small>按最近学习排序</small></div>
      <div className="workspace-list">{courseItems.map((course, index) => <article key={course.code}><span className="list-index">0{index + 1}</span><div><h3>{course.title}</h3><p>{course.detail}</p></div><div className="course-progress"><span><i style={{ width: course.meta.split("·")[1] }} /></span><small>{course.meta}</small></div><Link to="/learn">继续学习</Link></article>)}</div>
    </section>
  </main>;
}

export function TodayTasksPage() {
  const tasks = [
    { time: "09:30", type: "课程", title: "完成项目管理基础 · 案例判断", note: "预计 20 分钟", to: "/learn" },
    { time: "14:00", type: "练习", title: "巩固项目与运营的区别", note: "10 道自适应题", to: "/practice" },
    { time: "20:00", type: "复盘", title: "回顾本周错题", note: "当前有 12 道待复习", to: "/practice" },
  ] as const;
  return <main className="workspace-page">
    <WorkspaceHeader eyebrow="今日任务" title="今天只完成这三件事" description="任务按学习路径排序，完成后会自动更新掌握度。" />
    <section className="workspace-section workspace-list-section"><div className="workspace-section-title"><div><span>08 月 18 日</span><h2>学习安排</h2></div><small>预计 55 分钟</small></div>
      <div className="task-timeline">{tasks.map((task, index) => <article key={task.title}><time>{task.time}</time><span className={index === 0 ? "active" : ""} /><div><small>{task.type}</small><h3>{task.title}</h3><p>{task.note}</p></div><Link to={task.to}>{index === 0 ? "现在开始" : "查看任务"}</Link></article>)}</div>
    </section>
  </main>;
}

export function CourseCalendarPage() {
  const days = ["周一\n17", "周二\n18", "周三\n19", "周四\n20", "周五\n21", "周六\n22", "周日\n23"];
  return <main className="workspace-page">
    <WorkspaceHeader eyebrow="课程日历" title="本周学习节奏" description="课程、练习和模拟考试各自拥有明确时间，不与题库入口混用。" />
    <section className="workspace-section calendar-section"><div className="workspace-section-title"><div><span>2026 年 08 月</span><h2>第 34 周</h2></div><div className="calendar-actions"><button aria-label="上一周">←</button><button aria-label="下一周">→</button></div></div>
      <div className="week-grid">{days.map((day, index) => <div key={day} className={index === 1 ? "today" : ""}><strong>{day.split("\n")[0]}</strong><span>{day.split("\n")[1]}</span>{index === 1 && <i>案例判断<br /><small>09:30</small></i>}{index === 3 && <i>章节练习<br /><small>14:00</small></i>}{index === 5 && <i>模拟考试<br /><small>10:00</small></i>}</div>)}</div>
    </section>
  </main>;
}

export function CommunityPage() {
  const topics = [
    ["项目与运营在情境题中如何快速区分？", "陈同学", "18 条讨论"],
    ["分享我的风险应对记忆框架", "林同学", "12 条讨论"],
    ["模拟考试时间分配策略", "王同学", "9 条讨论"],
  ];
  return <main className="workspace-page">
    <WorkspaceHeader eyebrow="学习社区" title="和同路人一起解决难点" description="围绕知识点讨论方法与依据，避免把社区入口和知识检索混为一体。" action={<button className="primary-button">发起讨论</button>} />
    <section className="workspace-section workspace-list-section"><div className="workspace-section-title"><div><span>热门讨论</span><h2>本周值得参与的话题</h2></div><Link to="/knowledge">搜索知识库</Link></div>
      <div className="community-list">{topics.map(([title, author, replies], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{author} · {replies}</p></div><button>查看讨论</button></article>)}</div>
    </section>
  </main>;
}

export function SettingsPage() {
  return <main className="workspace-page settings-page">
    <WorkspaceHeader eyebrow="设置" title="学习偏好" description="这些选项只影响你的学习体验，不再跳转到数据看板。" />
    <section className="workspace-section settings-section"><div className="workspace-section-title"><div><span>通知与节奏</span><h2>个性化设置</h2></div></div>
      <SettingRow title="每日学习提醒" detail="在计划开始前 15 分钟提醒我" defaultChecked />
      <SettingRow title="学习进度周报" detail="每周一生成上周学习总结" defaultChecked />
      <SettingRow title="沉浸学习模式" detail="进入课堂后减少非必要提示" />
    </section>
  </main>;
}

function SettingRow({ title, detail, defaultChecked = false }: { title: string; detail: string; defaultChecked?: boolean }) {
  return <label className="setting-row"><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" defaultChecked={defaultChecked} /><i aria-hidden="true" /></label>;
}
