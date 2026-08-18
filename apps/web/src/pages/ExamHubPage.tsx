import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, post, type ExamHistoryItem, type ExamSession } from "../api";
import { EmptyState, LoadingState } from "../components/PageState";

export function ExamHubPage() {
  const [history, setHistory] = useState<ExamHistoryItem[] | null>(null);
  const [count, setCount] = useState(20);
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<"exam" | "practice">("exam");
  const [strategy, setStrategy] = useState<"balanced" | "weakness">("balanced");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => { void api<{ exams: ExamHistoryItem[] }>("/api/v1/exams").then((result) => setHistory(result.exams)).catch((reason) => setError(reason.message)); }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await post<{ exam: ExamSession }>("/api/v1/exams/generate", { mode, questionCount: count, durationMinutes: duration, strategy });
      navigate(`/exam/${result.exam.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "模拟考试创建失败"); }
    finally { setBusy(false); }
  }
  if (!history && !error) return <LoadingState label="正在读取考试记录…" />;
  return <main className="exam-hub academy-exam page-frame">
    <header className="page-heading exam-heading"><div><p className="page-kicker">题库测评</p><h1>模拟考试</h1><p>选择练习模式，设置题量与时长，开始专注答题。</p></div></header>
    <section className="exam-builder-panel">
      <form className="exam-builder-form" onSubmit={create}>
        <fieldset className="exam-mode-field"><legend>做题模式</legend><div className="exam-mode-toggle"><label className={mode === "exam" ? "active" : ""}><input type="radio" name="exam-mode" checked={mode === "exam"} onChange={() => { setMode("exam"); setStrategy("balanced"); }} /><span><strong>模拟考试</strong><small>限时作答 · 提交后复盘</small></span><i aria-hidden="true" /></label><label className={mode === "practice" ? "active" : ""}><input type="radio" name="exam-mode" checked={mode === "practice"} onChange={() => { setMode("practice"); setStrategy("weakness"); }} /><span><strong>章节练习</strong><small>薄弱点优先 · 随时巩固</small></span><i aria-hidden="true" /></label></div></fieldset>
        <label><span>题目数量</span><select value={count} onChange={(event) => { const value = Number(event.target.value); setCount(value); setDuration(value === 63 ? 90 : value === 20 ? 30 : 15); }}><option value="10">10 题 · 快速模拟</option><option value="20">20 题 · 阶段模拟</option><option value="63">63 题 · 全题库模拟</option></select></label>
        <label><span>考试时长</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value="15">15 分钟</option><option value="30">30 分钟</option><option value="60">60 分钟</option><option value="90">90 分钟</option></select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button exam-start-button" disabled={busy}>{busy ? "正在生成试卷…" : "开始答题"}<span aria-hidden="true">→</span></button>
      </form>
    </section>

    <section className="exam-history">
      <div className="section-heading"><div><h2>最近练习</h2></div></div>
      {!history?.length ? <EmptyState title="还没有模拟考试" detail="完成第一场模拟考试后，成绩和复盘会保存在这里。" /> : <div className="history-table" role="table" aria-label="最近考试记录">
        <div className="history-head" role="row"><span>开始时间</span><span>模式</span><span>题量</span><span>状态/成绩</span><span /></div>
        {history.map((exam) => <div className="history-row" role="row" key={exam.id}><span>{formatDate(exam.startedAt)}</span><span>{exam.mode === "exam" ? "模拟考试" : "章节练习"}</span><span>{exam.totalQuestions} 题</span><strong className={exam.status === "submitted" ? "completed" : "running"}>{exam.status === "submitted" ? `已完成 · ${exam.score ?? 0} 分` : "进行中"}</strong><Link to={`/exam/${exam.id}`}>{exam.status === "submitted" ? "查看报告" : "继续答题"}</Link></div>)}
      </div>}
    </section>
  </main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
