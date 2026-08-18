import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { api, post, type ExamSession } from "../api";
import { ErrorState, LoadingState } from "../components/PageState";

export function ExamSessionPage() {
  const { examId = "" } = useParams();
  const [exam, setExam] = useState<ExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState("已自动保存");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoSubmitStarted = useRef(false);
  const pendingSaves = useRef(new Set<Promise<void>>());

  const load = useCallback(() => api<{ exam: ExamSession }>(`/api/v1/exams/session?id=${encodeURIComponent(examId)}`).then((result) => {
    setExam(result.exam);
    setRemaining(secondsUntil(result.exam.expiresAt));
  }).catch((reason) => setError(reason instanceof Error ? reason.message : "无法加载试卷")), [examId]);
  useEffect(() => { void load(); }, [load]);

  const question = exam?.questions[currentIndex];
  const answeredCount = exam ? Object.keys(exam.answers).length : 0;
  const reviewById = useMemo(() => new Map(exam?.review?.map((item) => [item.questionId, item]) ?? []), [exam?.review]);

  async function choose(answer: string) {
    if (!exam || !question || exam.status !== "in_progress") return;
    setExam({ ...exam, answers: { ...exam.answers, [question.id]: answer } });
    setSaveState("正在保存…");
    const saveRequest = post("/api/v1/exams/answer", { examId: exam.id, questionId: question.id, answer }).then(() => undefined);
    const trackedSave = saveRequest.catch(() => undefined);
    pendingSaves.current.add(trackedSave);
    try {
      await saveRequest;
      setSaveState("已自动保存");
    } catch (reason) { setSaveState("保存失败，请重试"); setError(reason instanceof Error ? reason.message : "答案保存失败"); }
    finally { pendingSaves.current.delete(trackedSave); }
  }

  async function finish() {
    if (!exam || exam.status !== "in_progress") return;
    setBusy(true); setError("");
    try {
      await Promise.all([...pendingSaves.current]);
      const result = await post<{ exam: ExamSession }>("/api/v1/exams/submit", { examId: exam.id });
      setExam(result.exam); setCurrentIndex(0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "试卷提交失败"); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!exam || exam.status === "submitted" || remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [exam, remaining]);

  useEffect(() => {
    if (!exam || exam.status !== "in_progress" || remaining > 0 || busy || autoSubmitStarted.current) return;
    autoSubmitStarted.current = true;
    setSaveState("时间已到，正在自动交卷…");
    void finish();
  }, [exam, remaining, busy]);

  if (error && !exam) return <ErrorState message={error} onRetry={load} />;
  if (!exam || !question) return <LoadingState label="正在恢复考试进度…" />;
  const review = reviewById.get(question.id);
  const submitted = exam.status === "submitted";
  return <main className={`exam-session-page ${submitted ? "review-mode" : ""}`}>
    <header className="exam-session-header">
      <div><Link to="/exam" aria-label="返回模拟考试">←</Link><span><strong>{submitted ? "考试复盘" : exam.mode === "exam" ? "模拟考试" : "智能练习"}</strong><small>{exam.totalQuestions} 题 · {exam.config.strategy === "weakness" ? "薄弱点优先" : "均衡覆盖"}</small></span></div>
      {submitted ? <div className="exam-score"><span>本次成绩</span><strong>{exam.score}<small>分</small></strong></div> : <div className="exam-clock" aria-live="polite"><span>剩余时间</span><strong>{formatTime(remaining)}</strong></div>}
      <div className="exam-save-state"><i className={saveState.includes("失败") ? "error" : ""} />{saveState}</div>
    </header>
    <div className="exam-session-layout">
      <aside className="question-navigator" aria-label="题号导航">
        <div><span>答题进度</span><strong>{answeredCount} / {exam.totalQuestions}</strong></div>
        <div className="question-grid">{exam.questions.map((item, index) => <button key={item.id} className={`${index === currentIndex ? "active" : ""} ${exam.answers[item.id] ? "answered" : ""} ${submitted && reviewById.get(item.id)?.correct ? "correct" : submitted ? "incorrect" : ""}`} onClick={() => setCurrentIndex(index)} aria-label={`第 ${index + 1} 题${exam.answers[item.id] ? "，已作答" : "，未作答"}`}>{index + 1}</button>)}</div>
        {!submitted && <div className="navigator-legend"><span><i />当前</span><span><i />已答</span><span><i />未答</span></div>}
      </aside>
      <section className="exam-question-stage">
        <div className="question-meta"><span>第 {currentIndex + 1} 题 / {exam.totalQuestions}</span><div><i>{question.difficulty}</i>{question.knowledgeTitle && <i>{question.knowledgeTitle}</i>}</div></div>
        <fieldset className="exam-question"><legend>{question.stem}</legend>{Object.entries(question.options).map(([key, option]) => {
          const selected = exam.answers[question.id] === key;
          const correctAnswer = submitted && review?.correctAnswer === key;
          const wrongAnswer = submitted && selected && !review?.correct;
          return <label key={key} className={`${selected ? "selected" : ""} ${correctAnswer ? "correct" : ""} ${wrongAnswer ? "incorrect" : ""}`}><input type="radio" name={question.id} value={key} checked={selected} disabled={submitted || remaining === 0} onChange={() => void choose(key)} /><span>{key}</span><strong>{option}</strong>{correctAnswer && <small>正确答案</small>}{wrongAnswer && <small>你的答案</small>}</label>;
        })}</fieldset>
        {submitted && review && <section className="answer-review" aria-labelledby="review-title"><span className="status-label">答案解析</span><h2 id="review-title">{review.correct ? "判断正确" : `正确答案：${review.correctAnswer}`}</h2><p>{review.rationale}</p>{question.knowledgeTitle && <div><strong>关联知识点</strong><span>{question.knowledgeTitle}</span></div>}</section>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="question-actions"><button className="secondary-button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>上一题</button>{currentIndex + 1 < exam.totalQuestions ? <button className="primary-button" onClick={() => setCurrentIndex((index) => index + 1)}>下一题 <span aria-hidden="true">→</span></button> : submitted ? <Link className="primary-button" to="/reports">查看学习分析</Link> : <button className="primary-button" disabled={busy} onClick={() => void finish()}>{busy ? "正在评分…" : `提交试卷（${answeredCount}/${exam.totalQuestions}）`}</button>}</footer>
      </section>
    </div>
  </main>;
}

function secondsUntil(value: string) {
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

function formatTime(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
