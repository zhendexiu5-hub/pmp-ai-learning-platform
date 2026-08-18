import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { api, type Dashboard, type LearningSession, post } from "../api";
import { ErrorState, LoadingState } from "../components/PageState";

const stageLabels: Record<string, string> = {
  chapter_preview: "章节预览", explain: "概念讲解", case_judgment: "案例判断", active_recall: "主动回忆",
  exam_practice: "考点训练", diagnose: "错因诊断", remediate: "最小补救", retry: "重新作答",
  variation_check: "变式验证", point_passed: "知识点通过", reverse_recall: "倒回复习",
  chapter_test: "章节测试", review_plan: "复习计划", chapter_complete: "章节完成",
};
const learningSteps = ["概念讲解", "案例判断", "主动回忆", "考点训练", "变式验证"];
const errorOptions = [["K", "知识没有记住"], ["C", "相似概念混淆"], ["M", "方法选择不当"], ["R", "推理过程错误"], ["Q", "审题遗漏"], ["E", "表达不清或猜测"]] as const;

export function LearningPage() {
  const [session, setSession] = useState<LearningSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      const dashboard = await api<Dashboard>("/api/v1/dashboard");
      setSession(dashboard.current ?? (await post<{ session: LearningSession }>("/api/v1/learning/start", {})).session);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "无法加载学习状态"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setHintOpen(false); }, [session?.stage, session?.knowledge?.id]);
  async function act(path: string, payload: object) {
    if (!session) return;
    setBusy(true); setError("");
    try { setSession((await post<{ session: LearningSession }>(path, { sessionId: session.id, ...payload })).session); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败"); }
    finally { setBusy(false); }
  }
  function readAloud() {
    if (!session || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const text = [session.block.title, session.block.explanation, session.block.examLogic, session.block.casePrompt, session.block.recallPrompt].filter(Boolean).join("。 ");
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = .95;
    window.speechSynthesis.speak(utterance);
  }
  if (error && !session) return <ErrorState message={error} onRetry={load} />;
  if (!session) return <LoadingState label="正在恢复课堂进度…" />;
  const progress = Math.round(((session.knowledgeIndex + 1) / session.knowledgeTotal) * 100);
  return <main className={`learning-workspace academy-learning ${focusMode ? "focus-mode" : ""}`}>
    <section className="learning-stage">
      <header className="course-lesson-header">
        <div className="lesson-breadcrumb"><Link to="/">学习路径</Link><span>›</span><span>项目管理基础</span><span>›</span><span>CH {session.chapter.id}</span></div>
        <div className="lesson-overview"><div><h1>CH {session.chapter.id} · {session.chapter.title}</h1><p>{session.knowledge?.id} · {session.knowledge?.titleEn}</p></div><span className="lesson-status">进行中</span><div className="lesson-progress"><span>知识点 {session.knowledgeIndex + 1} / {session.knowledgeTotal}</span><div><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div><button className="lesson-map-button" onClick={() => setFocusMode((value) => !value)}>{focusMode ? "退出沉浸" : "学习地图"}</button></div>
      </header>
      <div className="stage-wrap">
        <div className="tutor-line"><span className="ai-avatar">AI</span><div><strong>AI 导师 Runloop <i>在线</i></strong><p>{session.feedback ?? `你好，我是你的 AI 导师。现在进入「${stageLabels[session.stage]}」，遇到不懂的随时告诉我。`}</p></div><span className="coverage-badge">{session.knowledge?.coverage === "teachable" ? "完整教学资料" : "资料约束模式"}</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="teaching-surface"><div className="stage-content" key={`${session.knowledge?.id}-${session.stage}`}><StageContent session={session} busy={busy} onAdvance={() => act("/api/v1/learning/advance", {})} onRespond={(payload) => act("/api/v1/learning/respond", payload)} /></div></div>
        <div className="assist-label">需要帮助？</div>
        <div className="learning-assist"><button onClick={() => setHintOpen((value) => !value)}><span>?</span><strong>获取提示</strong><small>给我一点启发</small></button><button onClick={readAloud}><span>▶</span><strong>听一段讲解</strong><small>语音理解知识点</small></button><Link to="/knowledge"><span>▤</span><strong>查看知识点</strong><small>回顾相关知识</small></Link></div>
        {hintOpen && <div className="hint-panel" role="status"><strong>先缩小判断范围</strong><p>定位题目要求，再回忆当前知识点最核心的判断维度。提示不会直接公布答案。</p></div>}
      </div>
    </section>
    <LearningSidebar session={session} />
  </main>;
}

function LearningSidebar({ session }: { session: LearningSession }) {
  const activeLabel = session.stage === "retry" ? stageLabels[session.retryOrigin ?? ""] : stageLabels[session.stage];
  return <aside className="learning-sidebar"><section className="route-rail"><p className="rail-caption">学习路径</p><ol>{learningSteps.map((step, index) => {
    const activeIndex = Math.max(0, learningSteps.indexOf(activeLabel));
    const done = index < activeIndex || ["point_passed", "reverse_recall", "chapter_test", "review_plan", "chapter_complete"].includes(session.stage);
    const active = step === activeLabel;
    return <li className={active ? "active" : done ? "done" : ""} key={step}><span>{done ? "✓" : index + 1}</span><div><strong>{step}</strong><small>{active ? "正在进行" : done ? "已完成" : "待完成"}</small></div></li>;
  })}</ol></section><section className="learning-side-card"><h2>知识点总结</h2><p>理解当前知识点与相近概念的区别，能够识别不同情境下活动的属性归类。</p><Link to="/knowledge">查看知识点卡片 →</Link></section><section className="learning-side-card goal-card"><h2>本节目标</h2><ul><li className="done">理解概念定义与特征</li><li className="done">识别活动与项目的区别</li><li>能够判断典型情境归属</li></ul></section><section className="learning-side-card"><h2>学习建议</h2><p>结合实际工作中的活动场景思考，有助于更好地区分概念边界。</p></section></aside>;
}

function StageContent({ session, onAdvance, onRespond, busy }: { session: LearningSession; onAdvance: () => Promise<void>; onRespond: (payload: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [response, setResponse] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [guessed, setGuessed] = useState(false);
  const startedAt = useMemo(() => Date.now(), [session.stage, session.id]);
  useEffect(() => { setResponse(""); setGuessed(false); }, [session.stage, session.knowledge?.id]);
  const submit = () => onRespond({ response, confidence, guessed, elapsedMs: Date.now() - startedAt });
  const button = (label: string) => <button className="primary-button" disabled={busy} onClick={() => void onAdvance()}>{busy ? "保存中…" : label}<span aria-hidden="true">→</span></button>;
  const retryOrigin = session.stage === "retry" ? session.retryOrigin : null;

  if (session.stage === "chapter_preview") return <><p className="page-kicker">Chapter {session.chapter.id} · {session.chapter.position}/{session.chapter.total}</p><h1>{session.chapter.title}</h1><p className="lead">先建立判断地图，再完成两个最小知识点。课堂会根据真实作答决定是否补救，不允许自由跳过验证。</p><div className="preview-rule"><span>本章路线</span><strong>项目 → 运营 → 边界判断</strong><small>预计 12 分钟</small></div>{button("进入第一个知识点")}</>;
  if (session.stage === "explain") return <><p className="page-kicker">微型讲解 · {session.knowledge?.id}</p><h1>{session.block.title}</h1><p className="lead">{session.block.explanation}</p><div className="rule-sheet"><p><b>考试逻辑</b>{session.block.examLogic}</p><p><b>判断规则</b>{session.block.decisionRule}</p><p><b>常见陷阱</b>{session.block.commonTrap}</p><p><b>原创场景</b>{session.block.example}</p></div><p className="source-line">内容依据：{session.block.source}</p>{button("进入案例判断")}</>;
  if (session.stage === "case_judgment" || retryOrigin === "case_judgment") return <><p className="page-kicker">AI 导师提问</p><h1>先判断，再说明最关键的依据。</h1><blockquote className="case-quote">{session.block.casePrompt}</blockquote><label className="response-label">你的回答<textarea maxLength={1000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="在此输入你的想法…" /></label><span className="response-count">{response.length} / 1000 字</span><div className="response-action-row"><ResponseMeta confidence={confidence} setConfidence={setConfidence} guessed={guessed} setGuessed={setGuessed} /><button className="primary-button answer-submit" disabled={busy || !response} onClick={() => void submit()}>{busy ? "正在提交…" : response ? "提交回答" : "填写后可提交"}<span aria-hidden="true">→</span></button></div></>;
  if (session.stage === "active_recall" || session.stage === "reverse_recall" || retryOrigin === "active_recall" || retryOrigin === "reverse_recall") return <><p className="page-kicker">{session.stage === "reverse_recall" || retryOrigin === "reverse_recall" ? "倒回复习" : "主动回忆"}</p><h1>合上讲义，用自己的话复述。</h1><p className="prompt-line">{session.block.recallPrompt}</p><label className="response-label">你的回答<textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="写下你真正记住的判断线索……" /></label><ResponseMeta confidence={confidence} setConfidence={setConfidence} guessed={guessed} setGuessed={setGuessed} /><button className="primary-button" disabled={busy || !response} onClick={() => void submit()}>提交回忆</button></>;
  if (["exam_practice", "variation_check", "chapter_test"].includes(session.stage) || ["exam_practice", "variation_check", "chapter_test"].includes(retryOrigin ?? "")) return <><p className="page-kicker">{stageLabels[retryOrigin ?? session.stage]}</p><h1>{session.stage === "chapter_test" || retryOrigin === "chapter_test" ? "测试状态：教学辅助已关闭。" : "把规则用到新的情境里。"}</h1><ChoiceQuestion session={session} value={response} onChange={setResponse} />{session.stage !== "chapter_test" && retryOrigin !== "chapter_test" && <ResponseMeta confidence={confidence} setConfidence={setConfidence} guessed={guessed} setGuessed={setGuessed} />}<button className="primary-button" disabled={busy || !response} onClick={() => void submit()}>提交答案</button></>;
  if (session.stage === "diagnose") return <><p className="page-kicker">错因诊断</p><h1>{session.feedback?.includes("猜测") ? "答案碰巧正确，但判断依据还不稳定。" : "先不公布答案，你最可能卡在哪里？"}</h1><div className="diagnosis-list">{errorOptions.map(([code, label]) => <button className={response === code ? "selected" : ""} key={code} onClick={() => setResponse(code)}><span>{code}</span>{label}</button>)}</div><button className="primary-button" disabled={busy || !response} onClick={() => void onRespond({ errorCode: response })}>继续补救</button></>;
  if (session.stage === "remediate") return <><p className="page-kicker">最小补救</p><h1>只补当前缺失的一步。</h1><div className="remediation"><p>{session.block.remediation}</p><p><b>重新判断时：</b>{session.block.decisionRule}</p></div>{button("重新作答")}</>;
  if (session.stage === "point_passed") return <><p className="page-kicker success-text">知识点通过</p><h1>{session.knowledge?.titleZh}</h1><p className="lead">你已完成讲解、案例、回忆、练习与变式验证。系统已更新掌握度和复习时间。</p><div className="pass-summary"><span>当前掌握度</span><strong>{Math.round(session.mastery * 100)}%</strong><small>{session.block.commonTrap}</small></div>{button(session.knowledgeIndex + 1 < session.knowledgeTotal ? "继续下个知识点" : "开始倒回复习")}</>;
  if (session.stage === "review_plan") return <><p className="page-kicker success-text">章节测试已记录</p><h1>首轮闭环完成。</h1><p className="lead">作答事件、知识点掌握度与复习计划已保存。到期复习不会改变章节主线。</p>{button("完成本章切片")}</>;
  return <><p className="page-kicker success-text">Chapter 01 · 已完成</p><h1>本次学习完成。</h1><p className="lead">返回学习首页查看后续任务，或进入智能练习验证薄弱点。</p><div className="completion-actions"><Link className="primary-button" to="/">返回学习首页</Link><Link className="secondary-button" to="/practice">智能练习</Link></div></>;
}

function ChoiceQuestion({ session, value, onChange }: { session: LearningSession; value: string; onChange: (value: string) => void }) {
  if (!session.question) return null;
  return <fieldset className="choice-block"><legend>{session.question.stem}</legend>{Object.entries(session.question.options).map(([key, option]) => <label className={value === key ? "selected" : ""} key={key}><input type="radio" name="answer" value={key} checked={value === key} onChange={() => onChange(key)} /><span>{key}</span><strong>{option}</strong></label>)}</fieldset>;
}

function ResponseMeta({ confidence, setConfidence, guessed, setGuessed }: { confidence: number; setConfidence: (value: number) => void; guessed: boolean; setGuessed: (value: boolean) => void }) {
  return <div className="response-meta"><span>置信度</span><div className="confidence-buttons"><button type="button" className={confidence === 1 ? "active" : ""} onClick={() => setConfidence(1)}>不确定</button><button type="button" className={confidence === 3 ? "active" : ""} onClick={() => setConfidence(3)}>一般</button><button type="button" className={confidence === 5 ? "active" : ""} onClick={() => setConfidence(5)}>很确定</button></div><label className="check-label"><input type="checkbox" checked={guessed} onChange={(event) => setGuessed(event.target.checked)} />存在猜测</label></div>;
}
