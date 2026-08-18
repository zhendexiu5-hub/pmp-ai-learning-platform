import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, post, type ExamSession, type Insights } from "../api";
import { ErrorState, LoadingState } from "../components/PageState";

export function PracticePage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [strategy, setStrategy] = useState<"weakness" | "balanced">("weakness");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => { void api<Insights>("/api/v1/insights").then(setInsights).catch((reason) => setError(reason.message)); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await post<{ exam: ExamSession }>("/api/v1/exams/generate", { mode: "practice", questionCount: count, strategy, durationMinutes: Math.max(15, Math.round(count * 1.5)) });
      navigate(`/exam/${result.exam.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "练习生成失败"); }
    finally { setBusy(false); }
  }
  if (error && !insights) return <ErrorState message={error} onRetry={() => location.reload()} />;
  if (!insights) return <LoadingState label="正在分析薄弱点…" />;
  return <main className="practice-page page-frame">
    <header className="page-heading"><p className="page-kicker">智能练习</p><h1>练习应该解决问题，而不是增加题量。</h1><p>系统使用已通过结构校验的候选题库，并根据你的掌握度决定优先顺序。</p></header>
    <div className="practice-layout">
      <section className="practice-builder" aria-labelledby="practice-builder-title">
        <div className="section-heading"><div><span className="section-index">01</span><h2 id="practice-builder-title">选择练习策略</h2></div></div>
        <form onSubmit={submit}>
          <div className="strategy-options" role="radiogroup" aria-label="练习策略">
            <label className={strategy === "weakness" ? "selected" : ""}><input type="radio" name="strategy" checked={strategy === "weakness"} onChange={() => setStrategy("weakness")} /><span><strong>薄弱点优先</strong><small>从当前掌握度较低的知识点开始</small></span><i>推荐</i></label>
            <label className={strategy === "balanced" ? "selected" : ""}><input type="radio" name="strategy" checked={strategy === "balanced"} onChange={() => setStrategy("balanced")} /><span><strong>均衡抽题</strong><small>覆盖不同任务与难度，适合阶段检查</small></span></label>
          </div>
          <label className="range-field"><span><strong>题目数量</strong><output>{count} 题</output></span><input type="range" min="5" max="30" step="5" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "正在从题库组卷…" : "生成智能练习"}<span aria-hidden="true">→</span></button>
        </form>
      </section>
      <aside className="weakness-list">
        <div className="section-heading"><div><span className="section-index">当前画像</span><h2>优先补强</h2></div></div>
        {insights.weakPoints.slice(0, 4).map((point, index) => <div className="weakness-row" key={point.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{point.title}</strong><p>Chapter {point.chapterId} · {point.commonTrap}</p></div><b>{Math.round(point.mastery * 100)}%</b></div>)}
        <p className="data-note">掌握度用于排序，不由 AI 自由评分。</p>
      </aside>
    </div>
  </main>;
}
