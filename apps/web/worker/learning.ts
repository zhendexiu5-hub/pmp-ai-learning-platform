import type { AuthUser } from "./auth";
import { cleanText, HttpError } from "./http";

const CHAPTER_ID = "01";
const CHAPTER_TITLE = "考试地图与项目基础";
const KNOWLEDGE_IDS = ["KP-001", "KP-002"] as const;
const MASTERY_VERSION = "mastery-v1";

type Stage = "chapter_preview" | "explain" | "case_judgment" | "active_recall" | "exam_practice" | "diagnose" | "remediate" | "retry" | "variation_check" | "point_passed" | "reverse_recall" | "chapter_test" | "review_plan" | "chapter_complete";
type SessionRow = { id: string; user_id: string; chapter_id: string; knowledge_id: string; knowledge_index: number; stage: Stage; retry_origin: Stage | null; last_feedback: string | null; updated_at: string; completed_at: string | null };
type BlockRow = { id: string; knowledge_id: string; title: string; explanation: string; exam_logic: string; decision_rule: string; common_trap: string; example: string; source: string; case_prompt: string; case_expected_json: string; recall_prompt: string; recall_keywords_json: string; practice_question_id: string; variation_question_id: string; remediation: string };
type MappingRow = { knowledge_id: string; role: "primary" | "secondary"; weight: number };

function sessionId() { return crypto.randomUUID(); }
function normalized(value: string) { return value.toLowerCase().replaceAll(/\s+/g, ""); }
function containsAll(value: string, keywords: string[]) { const text = normalized(value); return keywords.every((keyword) => text.includes(normalized(keyword))); }

async function getSession(env: Env, userId: string, id?: string) {
  const statement = id
    ? env.DB.prepare("SELECT * FROM learning_sessions WHERE id = ? AND user_id = ?").bind(id, userId)
    : env.DB.prepare("SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1").bind(userId);
  return statement.first<SessionRow>();
}

async function getBlock(env: Env, knowledgeId: string) {
  const block = await env.DB.prepare("SELECT * FROM teaching_blocks WHERE knowledge_id = ?").bind(knowledgeId).first<BlockRow>();
  if (!block) throw new HttpError(409, "当前知识点尚未达到可教学状态", "CONTENT_NOT_TEACHABLE");
  return block;
}

async function safeQuestion(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT id, stem, options_json, difficulty FROM questions WHERE id = ?").bind(id).first<{ id: string; stem: string; options_json: string; difficulty: string }>();
  if (!row) throw new HttpError(500, "练习题配置缺失", "QUESTION_MISSING");
  return { id: row.id, stem: row.stem, options: JSON.parse(row.options_json) as Record<string, string>, difficulty: row.difficulty };
}

export async function learningView(env: Env, user: AuthUser, id?: string) {
  const session = await getSession(env, user.id, id);
  if (!session) return null;
  const block = await getBlock(env, session.knowledge_id);
  const knowledge = await env.DB.prepare("SELECT id, title_zh, title_en, common_trap, content_coverage FROM knowledge_points WHERE id = ?").bind(session.knowledge_id).first<{ id: string; title_zh: string; title_en: string; common_trap: string; content_coverage: string }>();
  const state = await env.DB.prepare("SELECT mastery, correct_streak, last_error_code FROM user_knowledge_state WHERE user_id = ? AND knowledge_id = ?").bind(user.id, session.knowledge_id).first<{ mastery: number; correct_streak: number; last_error_code: string | null }>();

  let question: Awaited<ReturnType<typeof safeQuestion>> | undefined;
  const questionStage = session.stage === "exam_practice" ? "exam_practice" : session.stage === "variation_check" ? "variation_check" : session.stage === "chapter_test" ? "chapter_test" : session.stage === "retry" && ["exam_practice", "variation_check", "chapter_test"].includes(session.retry_origin ?? "") ? session.retry_origin : null;
  if (questionStage === "exam_practice") question = await safeQuestion(env, block.practice_question_id);
  if (questionStage === "variation_check") question = await safeQuestion(env, block.variation_question_id);
  if (questionStage === "chapter_test") question = await safeQuestion(env, "KP-FOUND-001");

  return {
    id: session.id,
    chapter: { id: CHAPTER_ID, title: CHAPTER_TITLE, position: 1, total: 12 },
    knowledge: knowledge ? { id: knowledge.id, titleZh: knowledge.title_zh, titleEn: knowledge.title_en, commonTrap: knowledge.common_trap, coverage: knowledge.content_coverage } : null,
    knowledgeIndex: session.knowledge_index,
    knowledgeTotal: KNOWLEDGE_IDS.length,
    stage: session.stage,
    retryOrigin: session.retry_origin,
    feedback: session.last_feedback,
    block: {
      title: block.title,
      explanation: session.stage === "explain" ? block.explanation : undefined,
      examLogic: session.stage === "explain" ? block.exam_logic : undefined,
      decisionRule: ["explain", "remediate"].includes(session.stage) ? block.decision_rule : undefined,
      commonTrap: ["explain", "remediate", "point_passed"].includes(session.stage) ? block.common_trap : undefined,
      example: session.stage === "explain" ? block.example : undefined,
      source: session.stage === "explain" ? block.source : undefined,
      casePrompt: ["case_judgment", "retry"].includes(session.stage) && (session.stage !== "retry" || session.retry_origin === "case_judgment") ? block.case_prompt : undefined,
      recallPrompt: session.stage === "active_recall" || (session.stage === "retry" && session.retry_origin === "active_recall") ? block.recall_prompt : session.stage === "reverse_recall" || (session.stage === "retry" && session.retry_origin === "reverse_recall") ? "项目与运营最核心的区别是什么？回答中请说明二者的工作本质。" : undefined,
      remediation: session.stage === "remediate" ? block.remediation : undefined,
    },
    question,
    mastery: state?.mastery ?? 0.5,
    correctStreak: state?.correct_streak ?? 0,
    lastErrorCode: state?.last_error_code ?? null,
    updatedAt: session.updated_at,
  };
}

export async function dashboard(env: Env, user: AuthUser) {
  const current = await learningView(env, user);
  const route = await env.DB.prepare("SELECT k.id, k.title_zh, k.title_en, k.common_trap, COALESCE(s.mastery, 0.5) mastery FROM knowledge_points k LEFT JOIN user_knowledge_state s ON s.knowledge_id = k.id AND s.user_id = ? WHERE k.id IN (?, ?) ORDER BY k.id")
    .bind(user.id, ...KNOWLEDGE_IDS).all<{ id: string; title_zh: string; title_en: string; common_trap: string; mastery: number }>();
  const reviews = await env.DB.prepare("SELECT r.knowledge_id, k.title_zh, r.due_at, r.reason FROM review_schedule r JOIN knowledge_points k ON k.id = r.knowledge_id WHERE r.user_id = ? AND r.due_at <= CURRENT_TIMESTAMP ORDER BY r.due_at LIMIT 5")
    .bind(user.id).all<{ knowledge_id: string; title_zh: string; due_at: string; reason: string }>();
  return { user, current, route: route.results, dueReviews: reviews.results };
}

export async function startLearning(env: Env, user: AuthUser) {
  const existing = await getSession(env, user.id);
  if (existing && !existing.completed_at) return learningView(env, user, existing.id);
  const id = sessionId();
  await env.DB.prepare("INSERT INTO learning_sessions (id, user_id, chapter_id, knowledge_id, knowledge_index, stage) VALUES (?, ?, ?, ?, 0, 'chapter_preview')")
    .bind(id, user.id, CHAPTER_ID, KNOWLEDGE_IDS[0]).run();
  return learningView(env, user, id);
}

export async function advance(env: Env, user: AuthUser, sessionIdValue: string) {
  const session = await getSession(env, user.id, sessionIdValue);
  if (!session) throw new HttpError(404, "学习会话不存在", "SESSION_NOT_FOUND");
  let next: Stage;
  let knowledgeIndex = session.knowledge_index;
  let knowledgeId = session.knowledge_id;
  if (session.stage === "chapter_preview") next = "explain";
  else if (session.stage === "explain") next = "case_judgment";
  else if (session.stage === "remediate") next = "retry";
  else if (session.stage === "point_passed") {
    if (knowledgeIndex + 1 < KNOWLEDGE_IDS.length) {
      knowledgeIndex += 1;
      knowledgeId = KNOWLEDGE_IDS[knowledgeIndex];
      next = "explain";
    } else next = "reverse_recall";
  } else if (session.stage === "review_plan") next = "chapter_complete";
  else throw new HttpError(409, "当前步骤需要先完成回答", "RESPONSE_REQUIRED");
  const completedAt = next === "chapter_complete" ? new Date().toISOString() : null;
  const nextRetryOrigin = next === "retry" ? session.retry_origin : null;
  await env.DB.prepare("UPDATE learning_sessions SET stage = ?, knowledge_index = ?, knowledge_id = ?, retry_origin = ?, last_feedback = NULL, updated_at = CURRENT_TIMESTAMP, completed_at = ? WHERE id = ? AND user_id = ?")
    .bind(next, knowledgeIndex, knowledgeId, nextRetryOrigin, completedAt, session.id, user.id).run();
  return learningView(env, user, session.id);
}

async function evaluateQuestion(env: Env, questionId: string, response: string) {
  const key = await env.DB.prepare("SELECT answer FROM question_keys WHERE question_id = ?").bind(questionId).first<{ answer: string }>();
  if (!key) throw new HttpError(500, "题目答案配置缺失", "QUESTION_KEY_MISSING");
  const mappings = await env.DB.prepare("SELECT knowledge_id, role, weight FROM question_knowledge WHERE question_id = ? AND reviewed = 1 ORDER BY role")
    .bind(questionId).all<MappingRow>();
  if (!mappings.results.length) throw new HttpError(500, "题目映射缺失", "QUESTION_MAPPING_MISSING");
  return { correct: normalized(response) === normalized(key.answer), mappings: mappings.results };
}

function masteryDelta(correct: boolean, guessed: boolean, mapping: MappingRow) {
  const base = correct ? guessed ? 0.02 : mapping.role === "primary" ? 0.1 : 0.03 : mapping.role === "primary" ? -0.12 : -0.03;
  return base * mapping.weight;
}

export async function respond(env: Env, user: AuthUser, sessionIdValue: string, input: { response?: unknown; confidence?: unknown; elapsedMs?: unknown; guessed?: unknown; errorCode?: unknown }) {
  const session = await getSession(env, user.id, sessionIdValue);
  if (!session) throw new HttpError(404, "学习会话不存在", "SESSION_NOT_FOUND");
  const response = cleanText(input.response, 2_000);
  const confidence = Math.min(5, Math.max(1, Number(input.confidence) || 3));
  const elapsedMs = Math.min(3_600_000, Math.max(0, Number(input.elapsedMs) || 0));
  const guessed = input.guessed === true;
  const errorCode = ["K", "C", "M", "R", "Q", "E"].includes(String(input.errorCode)) ? String(input.errorCode) : null;
  if (!response && session.stage !== "diagnose") throw new HttpError(400, "请先填写回答", "EMPTY_RESPONSE");
  const block = await getBlock(env, session.knowledge_id);

  if (session.stage === "diagnose") {
    if (!errorCode) throw new HttpError(400, "请选择最接近的错因", "ERROR_CODE_REQUIRED");
    await env.DB.batch([
      env.DB.prepare("UPDATE attempts SET error_code = ? WHERE id = (SELECT id FROM attempts WHERE learning_session_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1)").bind(errorCode, session.id, user.id),
      env.DB.prepare("UPDATE user_knowledge_state SET last_error_code = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND knowledge_id = ?").bind(errorCode, user.id, session.knowledge_id),
      env.DB.prepare("UPDATE learning_sessions SET stage = 'remediate', last_feedback = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?").bind("已记录错因，先看最小补救提示，再重新作答。", session.id, user.id),
    ]);
    return learningView(env, user, session.id);
  }

  let evaluatedStage: Stage = session.stage;
  if (session.stage === "retry" && session.retry_origin) evaluatedStage = session.retry_origin;
  let correct = false;
  let contentType: "case" | "recall" | "question" | "chapter_test" = "recall";
  let contentId = block.id;
  let mappings: MappingRow[] = [{ knowledge_id: session.knowledge_id, role: "primary", weight: 1 }];

  if (evaluatedStage === "case_judgment") {
    contentType = "case";
    correct = (JSON.parse(block.case_expected_json) as string[]).some((answer) => normalized(response).includes(normalized(answer)));
  } else if (evaluatedStage === "active_recall" || evaluatedStage === "reverse_recall") {
    const keywords = evaluatedStage === "reverse_recall" ? ["独特", "重复"] : JSON.parse(block.recall_keywords_json) as string[];
    correct = containsAll(response, keywords);
  } else if (["exam_practice", "variation_check", "chapter_test"].includes(evaluatedStage)) {
    contentType = evaluatedStage === "chapter_test" ? "chapter_test" : "question";
    const questionId = evaluatedStage === "exam_practice" ? block.practice_question_id : evaluatedStage === "variation_check" ? block.variation_question_id : "KP-FOUND-001";
    contentId = questionId;
    const evaluation = await evaluateQuestion(env, questionId, response);
    correct = evaluation.correct;
    mappings = evaluation.mappings;
  } else throw new HttpError(409, "当前步骤不能提交回答", "INVALID_STAGE_RESPONSE");

  let next: Stage;
  let retryOrigin: Stage | null = null;
  const verifiedCorrect = correct && !guessed;
  if (verifiedCorrect) {
    if (evaluatedStage === "case_judgment") next = "active_recall";
    else if (evaluatedStage === "active_recall") next = "exam_practice";
    else if (evaluatedStage === "exam_practice") next = "variation_check";
    else if (evaluatedStage === "variation_check") next = "point_passed";
    else if (evaluatedStage === "reverse_recall") next = "chapter_test";
    else next = "review_plan";
  } else {
    next = "diagnose";
    retryOrigin = evaluatedStage;
  }

  const attemptId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("INSERT INTO attempts (id, user_id, learning_session_id, content_type, content_id, knowledge_id, stage, response, correct, confidence, elapsed_ms, guessed, variation_check, algorithm_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(attemptId, user.id, session.id, contentType, contentId, session.knowledge_id, evaluatedStage, response, correct ? 1 : 0, confidence, elapsedMs, guessed ? 1 : 0, evaluatedStage === "variation_check" ? 1 : 0, MASTERY_VERSION),
  ];
  for (const mapping of mappings) {
    const delta = masteryDelta(correct, guessed, mapping);
    statements.push(env.DB.prepare("INSERT INTO user_knowledge_state (user_id, knowledge_id, mastery, correct_streak, last_result, algorithm_version) VALUES (?, ?, MAX(0, MIN(1, 0.5 + ?)), ?, ?, ?) ON CONFLICT(user_id, knowledge_id) DO UPDATE SET mastery = MAX(0, MIN(1, mastery + ?)), correct_streak = CASE WHEN ? = 1 THEN correct_streak + 1 ELSE 0 END, last_result = ?, algorithm_version = ?, updated_at = CURRENT_TIMESTAMP")
      .bind(user.id, mapping.knowledge_id, delta, verifiedCorrect ? 1 : 0, correct ? 1 : 0, MASTERY_VERSION, delta, verifiedCorrect ? 1 : 0, correct ? 1 : 0, MASTERY_VERSION));
    statements.push(env.DB.prepare("INSERT INTO review_schedule (user_id, knowledge_id, due_at, interval_days, reason) VALUES (?, ?, datetime('now', ?), ?, ?) ON CONFLICT(user_id, knowledge_id) DO UPDATE SET due_at = excluded.due_at, interval_days = excluded.interval_days, reason = excluded.reason")
      .bind(user.id, mapping.knowledge_id, verifiedCorrect ? "+3 days" : "+1 day", verifiedCorrect ? 3 : 1, guessed && correct ? "巩固本次猜对知识" : correct ? "巩固已学知识" : "补强本次错题"));
  }
  statements.push(env.DB.prepare("UPDATE learning_sessions SET stage = ?, retry_origin = ?, last_feedback = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
    .bind(next, retryOrigin, guessed && correct ? "答案正确但你标记为猜测，先确认不确定的原因，再做一次巩固。" : correct ? "回答正确，教学状态已更新。" : "暂不公布答案，请先判断错误原因。", session.id, user.id));
  await env.DB.batch(statements);
  return learningView(env, user, session.id);
}

export async function searchKnowledge(env: Env, user: AuthUser, query: string) {
  void user;
  const safe = query.replaceAll(/["'()*:^~-]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 6).map((token) => `${token}*`).join(" ");
  if (!safe) return [];
  const rows = await env.DB.prepare("SELECT k.id, k.chapter_id, k.title_zh, k.title_en, k.exam_focus, k.content_coverage, bm25(knowledge_fts) rank FROM knowledge_fts JOIN knowledge_points k ON k.rowid = knowledge_fts.rowid WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 10")
    .bind(safe).all<{ id: string; chapter_id: string; title_zh: string; title_en: string; exam_focus: string; content_coverage: string; rank: number }>();
  return rows.results;
}
