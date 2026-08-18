import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { api, type Insights } from "../api";
import { ErrorState, LoadingState } from "../components/PageState";

export function ReportsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<Insights>("/api/v1/insights").then(setData).catch((reason) => setError(reason.message)); }, []);
  const week = useMemo(() => data ? lastSevenDays(data.activity) : [], [data]);
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />;
  if (!data) return <LoadingState label="正在分析学习行为…" />;
  const maxActivity = Math.max(1, ...week.map((item) => item.total));
  return <main className="reports-page page-frame">
    <header className="page-heading reports-heading"><div><p className="page-kicker">学习分析</p><h1>数据的价值，是告诉你下一步做什么。</h1><p>所有结论来自实际作答、考试记录与可解释的 mastery-v1 规则。</p></div><Link className="primary-button" to="/practice">按薄弱点练习</Link></header>
    <section className="report-summary" aria-label="学习摘要">
      <div><span>近 30 天作答</span><strong>{data.summary.attempts}<small>次</small></strong><p>课堂与知识点训练</p></div>
      <div><span>正确率</span><strong>{Math.round(data.summary.accuracy * 100)}<small>%</small></strong><p>{data.summary.guessedRate > .2 ? "猜测比例偏高，需要验证判断依据" : "继续保持独立判断"}</p></div>
      <div><span>平均响应</span><strong>{data.summary.averageResponseSeconds}<small>秒</small></strong><p>用于识别犹豫，不单独决定掌握度</p></div>
      <div><span>模拟考试均分</span><strong>{data.summary.averageExamScore}<small>分</small></strong><p>{data.summary.exams ? `基于 ${data.summary.exams} 场考试` : "完成考试后开始统计"}</p></div>
    </section>
    <div className="reports-grid">
      <section className="activity-panel">
        <div className="section-heading"><div><span className="section-index">01</span><h2>最近 7 天学习活动</h2></div><span>题目作答量</span></div>
        <div className="activity-chart" role="img" aria-label="最近七天题目作答量柱状图">
          {week.map((item) => <div key={item.day}><span className="bar-value">{item.total || ""}</span><i style={{ height: `${Math.max(item.total ? 12 : 2, (item.total / maxActivity) * 100)}%` }}><b style={{ height: `${item.total ? (item.correct / item.total) * 100 : 0}%` }} /></i><small>{item.label}</small></div>)}
        </div>
        <div className="chart-legend"><span><i className="correct" />答对</span><span><i />全部作答</span></div>
      </section>
      <aside className="advice-panel">
        <div className="section-heading"><div><span className="section-index">AI 建议</span><h2>优先行动</h2></div></div>
        {data.recommendations.length ? <ol>{data.recommendations.map((item, index) => <li key={`${item.knowledgeId}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><p>{item.reason}</p><Link to={item.action}>开始</Link></div></li>)}</ol> : <p className="empty-copy">继续完成课堂作答，系统会在这里生成可执行建议。</p>}
      </aside>
    </div>
    <section className="mastery-table">
      <div className="section-heading"><div><span className="section-index">02</span><h2>需要关注的知识点</h2></div><span>按掌握度由低到高</span></div>
      <div className="mastery-head"><span>知识点</span><span>常见陷阱</span><span>掌握度</span><span /></div>
      {data.weakPoints.map((point) => <div className="mastery-row" key={point.id}><span><small>{point.id} · Chapter {point.chapterId}</small><strong>{point.title}</strong></span><p>{point.commonTrap}</p><span className="mastery-cell"><i><b style={{ width: `${Math.round(point.mastery * 100)}%` }} /></i><strong>{Math.round(point.mastery * 100)}%</strong></span><Link to="/practice">练习</Link></div>)}
    </section>
  </main>;
}

function lastSevenDays(activity: Insights["activity"]) {
  const byDay = new Map(activity.map((item) => [item.day, item]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const value = byDay.get(day);
    return { day, label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date), total: value?.total ?? 0, correct: value?.correct ?? 0 };
  });
}
