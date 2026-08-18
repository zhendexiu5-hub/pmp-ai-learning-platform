import { Link } from "react-router";

const courses = [
  { code: "PM", title: "项目管理基础", subtitle: "从原则到情境判断", tone: "violet", progress: "68%" },
  { code: "AI", title: "AI 工具实战", subtitle: "效率工具与学习方法", tone: "blue", progress: "42%" },
  { code: "AG", title: "敏捷项目管理", subtitle: "迭代、价值与团队协作", tone: "navy", progress: "26%" },
  { code: "BE", title: "商业环境精讲", subtitle: "合规、价值与组织变革", tone: "teal", progress: "12%" },
] as const;

const pathSteps = [
  { label: "基础认知", state: "done" },
  { label: "提示词训练", state: "done" },
  { label: "模拟应用", state: "active" },
  { label: "项目实践", state: "idle" },
  { label: "结业认证", state: "idle" },
] as const;

export function DashboardPage() {
  return <main className="academy-dashboard" aria-label="学习总览视觉样例">
    <div className="prototype-note"><span />视觉样例 · 暂未接入实时数据</div>
    <header className="academy-welcome">
      <div><p>早上好</p><h1>欢迎回来，邱同学</h1><span>坚持学习，让 AI 成为你的超能力。</span></div>
      <div className="academy-days">今天是你在 Runloop 学习的第 <strong>23</strong> 天</div>
    </header>

    <section className="academy-stats" aria-label="学习数据概览">
      <StatCard label="今日学习时长" value="68" unit="分钟" note="较昨日 +12 分钟" visual="spark" />
      <StatCard label="连续学习天数" value="23" unit="天" note="再学 2 天解锁勋章" visual="streak" />
      <StatCard label="学习完成率" value="72" unit="%" note="较上周 +8%" visual="ring" />
      <StatCard label="本周排名" value="TOP 8" unit="%" note="超过 92% 的同学" visual="trophy" />
    </section>

    <section className="academy-main-grid">
      <article className="academy-panel tutor-panel">
        <PanelTitle title="AI 导师对话" action="在线" />
        <div className="tutor-conversation">
          <p className="student-bubble">解释机器学习中的监督学习是什么？</p>
          <div className="tutor-answer"><span className="mini-bot">AI</span><p>监督学习是让模型从带有正确答案的样本中学习规律。你可以把它理解为：老师先给例题与答案，模型再从中总结判断方式。</p></div>
          <div className="tutor-feedback"><button aria-label="复制回答">复制</button><button aria-label="回答有帮助">有帮助</button><button aria-label="回答需改进">需改进</button></div>
        </div>
        <form className="tutor-composer" onSubmit={(event) => event.preventDefault()}><input aria-label="向 AI 导师提问" placeholder="输入你的问题…" /><button aria-label="发送问题">发送</button></form>
      </article>

      <article className="academy-panel course-panel">
        <PanelTitle title="推荐课程" action="查看全部" />
        <div className="course-showcase">
          {courses.map((course) => <Link to="/learn" className="course-tile" key={course.code}>
            <div className={`course-cover ${course.tone}`}><span>{course.code}</span><i>RUNLOOP</i></div>
            <strong>{course.title}</strong><p>{course.subtitle}</p><small>学习进度 {course.progress}</small>
          </Link>)}
        </div>
      </article>
    </section>

    <section className="academy-bottom-grid">
      <article className="academy-panel path-panel">
        <PanelTitle title="学习路径" action="继续学习" />
        <ol className="learning-path">
          {pathSteps.map((step, index) => <li className={step.state} key={step.label}><span>{step.state === "done" ? "✓" : index + 1}</span><strong>{step.label}</strong><small>{step.state === "done" ? "已完成" : step.state === "active" ? "进行中" : "未开始"}</small></li>)}
        </ol>
      </article>

      <article className="academy-panel task-panel">
        <PanelTitle title="作业 / 测评" action="3 项待办" />
        <ul>
          <li><span className="task-dot violet">作业</span><div><strong>完成章节练习 3 项</strong><small>项目管理基础</small></div><Link to="/practice">去完成</Link></li>
          <li><span className="task-dot blue">测评</span><div><strong>本周测评得分 86 分</strong><small>超过 78% 的同学</small></div><Link to="/reports">查看评价</Link></li>
          <li><span className="task-dot coral">错题</span><div><strong>错题回顾 12 题</strong><small>建议及时巩固薄弱点</small></div><Link to="/practice">去复习</Link></li>
        </ul>
      </article>

      <article className="academy-panel analytics-panel">
        <PanelTitle title="学习数据" action="本周" />
        <div className="mini-chart" aria-label="一周学习时长样例"><span style={{ height: "35%" }} /><span style={{ height: "48%" }} /><span style={{ height: "42%" }} /><span style={{ height: "66%" }} /><span style={{ height: "52%" }} /><span style={{ height: "86%" }} /><span style={{ height: "80%" }} /></div>
        <div className="ability-row"><div className="ability-shape"><i /></div><div className="completion-ring"><strong>72%</strong><span>课程完成率</span></div></div>
      </article>
    </section>
  </main>;
}

function StatCard({ label, value, unit, note, visual }: { label: string; value: string; unit: string; note: string; visual: string }) {
  return <article className="academy-stat"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><p>{note}</p><div className={`stat-visual ${visual}`} aria-hidden="true">{visual === "spark" && <><i /><i /><i /><i /><i /></>}{visual === "streak" && <b>23</b>}{visual === "ring" && <b />}{visual === "trophy" && <b>★</b>}</div></article>;
}

function PanelTitle({ title, action }: { title: string; action: string }) {
  return <header className="academy-panel-title"><div><span />{title}</div><button>{action}</button></header>;
}
