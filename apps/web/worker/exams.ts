import type { AuthUser } from "./auth";
import { cleanText, HttpError } from "./http";

type ExamMode = "practice" | "exam";
type ExamRow = {
  id: string;
  user_id: string;
  mode: ExamMode;
  status: "in_progress" | "submitted";
  config_json: string;
  question_ids_json: string;
  answers_json: string;
  total_questions: number;
  duration_seconds: number;
  score: number | null;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  updated_at: string;
};

type SafeQuestionRow = {
  id: string;
  stem: string;
  options_json: string;
  domain: string;
  task: string;
  approach: string;
  difficulty: string;
  trap: string;
  knowledge_id: string;
  title_zh: string;
};

function jsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function examId() {
  return crypto.randomUUID();
}

function clampCount(value: unknown) {
  return Math.min(63, Math.max(5, Math.round(Number(value) || 10)));
}

function clampDuration(value: unknown, count: number) {
  return Math.min(240, Math.max(10, Math.round(Number(value) || Math.max(15, count * 1.2))));
}

async function examRow(env: Env, userId: string, id: string) {
  return env.DB.prepare("SELECT * FROM exam_sessions WHERE id = ? AND user_id = ?").bind(id, userId).first<ExamRow>();
}

async function safeQuestions(env: Env, ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT q.id, q.stem, q.options_json, q.domain, q.task, q.approach, q.difficulty, q.trap, qk.knowledge_id, k.title_zh FROM questions q JOIN question_knowledge qk ON qk.question_id = q.id AND qk.role = 'primary' AND qk.reviewed = 1 JOIN knowledge_points k ON k.id = qk.knowledge_id WHERE q.id IN (${placeholders})`).bind(...ids).all<SafeQuestionRow>();
  const byId = new Map(rows.results.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [{
      id: row.id,
      stem: row.stem,
      options: jsonObject(row.options_json),
      domain: row.domain,
      task: row.task,
      approach: row.approach,
      difficulty: row.difficulty,
      trap: row.trap,
      knowledgeId: row.knowledge_id,
      knowledgeTitle: row.title_zh,
    }] : [];
  });
}

async function examAnswers(env: Env, examSessionId: string) {
  const rows = await env.DB.prepare("SELECT question_id, answer FROM exam_answers WHERE exam_session_id = ?")
    .bind(examSessionId).all<{ question_id: string; answer: string }>();
  return Object.fromEntries(rows.results.map((row) => [row.question_id, row.answer]));
}

function isExpired(row: ExamRow) {
  const iso = row.expires_at.includes("T") ? row.expires_at : `${row.expires_at.replace(" ", "T")}Z`;
  return Date.parse(iso) <= Date.now();
}

async function view(env: Env, user: AuthUser, row: ExamRow, includeReview = false) {
  const ids = JSON.parse(row.question_ids_json) as string[];
  const safe = await safeQuestions(env, ids);
  const questions = row.mode === "exam" && row.status === "in_progress"
    ? safe.map(({ trap: _trap, knowledgeId: _knowledgeId, knowledgeTitle: _knowledgeTitle, ...question }) => question)
    : safe;
  const answers = await examAnswers(env, row.id);
  let review: Array<{ questionId: string; answer: string; correctAnswer: string; correct: boolean; rationale: string }> | undefined;
  if (includeReview && row.status === "submitted") {
    const placeholders = ids.map(() => "?").join(",");
    const keys = await env.DB.prepare(`SELECT question_id, answer, rationale FROM question_keys WHERE question_id IN (${placeholders})`).bind(...ids).all<{ question_id: string; answer: string; rationale: string }>();
    const byId = new Map(keys.results.map((key) => [key.question_id, key]));
    review = ids.flatMap((id) => {
      const key = byId.get(id);
      return key ? [{ questionId: id, answer: answers[id] ?? "", correctAnswer: key.answer, correct: (answers[id] ?? "").trim().toLowerCase() === key.answer.trim().toLowerCase(), rationale: key.rationale }] : [];
    });
  }
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    config: JSON.parse(row.config_json) as Record<string, unknown>,
    totalQuestions: row.total_questions,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    score: row.score,
    answers,
    questions,
    review,
  };
}

export async function generateExam(env: Env, user: AuthUser, input: { mode?: unknown; questionCount?: unknown; durationMinutes?: unknown; strategy?: unknown; domain?: unknown }) {
  const mode: ExamMode = input.mode === "practice" ? "practice" : "exam";
  const questionCount = clampCount(input.questionCount);
  const durationMinutes = clampDuration(input.durationMinutes, questionCount);
  const strategy = input.strategy === "weakness" ? "weakness" : "balanced";
  const domain = cleanText(input.domain, 80);
  const domainClause = domain ? "AND q.domain = ?" : "";
  const order = strategy === "weakness" ? "COALESCE(uks.mastery, 0.5) ASC, RANDOM()" : "RANDOM()";
  const statement = env.DB.prepare(`SELECT DISTINCT q.id FROM questions q JOIN question_knowledge qk ON qk.question_id = q.id AND qk.role = 'primary' AND qk.reviewed = 1 LEFT JOIN user_knowledge_state uks ON uks.knowledge_id = qk.knowledge_id AND uks.user_id = ? WHERE 1 = 1 ${domainClause} ORDER BY ${order} LIMIT ?`);
  const selected = domain
    ? await statement.bind(user.id, domain, questionCount).all<{ id: string }>()
    : await statement.bind(user.id, questionCount).all<{ id: string }>();
  if (selected.results.length < 5) throw new HttpError(409, "符合当前条件的候选题目不足 5 道，请放宽组卷条件", "EXAM_POOL_TOO_SMALL");
  const id = examId();
  const ids = selected.results.map((row) => row.id);
  const config = { strategy, domain: domain || null, generatedFrom: "candidate-question-bank-v1" };
  await env.DB.prepare("INSERT INTO exam_sessions (id, user_id, mode, config_json, question_ids_json, total_questions, duration_seconds, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))")
    .bind(id, user.id, mode, JSON.stringify(config), JSON.stringify(ids), ids.length, durationMinutes * 60, `+${durationMinutes} minutes`).run();
  const row = await examRow(env, user.id, id);
  if (!row) throw new HttpError(500, "试卷创建失败", "EXAM_CREATE_FAILED");
  return view(env, user, row);
}

export async function getExam(env: Env, user: AuthUser, id: string) {
  const row = await examRow(env, user.id, id);
  if (!row) throw new HttpError(404, "试卷不存在", "EXAM_NOT_FOUND");
  if (row.status === "in_progress" && isExpired(row)) return submitExam(env, user, id);
  return view(env, user, row, row.status === "submitted");
}

export async function saveExamAnswer(env: Env, user: AuthUser, input: { examId?: unknown; questionId?: unknown; answer?: unknown }) {
  const id = String(input.examId ?? "");
  const questionId = cleanText(input.questionId, 100);
  const answer = cleanText(input.answer, 100);
  const row = await examRow(env, user.id, id);
  if (!row) throw new HttpError(404, "试卷不存在", "EXAM_NOT_FOUND");
  if (row.status !== "in_progress") throw new HttpError(409, "试卷已经提交", "EXAM_ALREADY_SUBMITTED");
  if (isExpired(row)) throw new HttpError(409, "考试时间已结束，系统正在收卷", "EXAM_EXPIRED");
  const ids = JSON.parse(row.question_ids_json) as string[];
  if (!ids.includes(questionId)) throw new HttpError(400, "题目不属于当前试卷", "QUESTION_NOT_IN_EXAM");
  const result = answer
    ? await env.DB.prepare("INSERT INTO exam_answers (exam_session_id, question_id, answer) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM exam_sessions WHERE id = ? AND user_id = ? AND status = 'in_progress' AND expires_at > CURRENT_TIMESTAMP) ON CONFLICT(exam_session_id, question_id) DO UPDATE SET answer = excluded.answer, updated_at = CURRENT_TIMESTAMP")
      .bind(id, questionId, answer, id, user.id).run()
    : await env.DB.prepare("DELETE FROM exam_answers WHERE exam_session_id = ? AND question_id = ? AND EXISTS (SELECT 1 FROM exam_sessions WHERE id = ? AND user_id = ? AND status = 'in_progress' AND expires_at > CURRENT_TIMESTAMP)")
      .bind(id, questionId, id, user.id).run();
  if (!result.meta.changes) {
    const current = await examRow(env, user.id, id);
    if (!current || current.status !== "in_progress") throw new HttpError(409, "试卷已经提交", "EXAM_ALREADY_SUBMITTED");
    if (isExpired(current)) throw new HttpError(409, "考试时间已结束，系统正在收卷", "EXAM_EXPIRED");
  }
  const answers = await examAnswers(env, id);
  return { saved: true, answeredCount: Object.keys(answers).length };
}

export async function submitExam(env: Env, user: AuthUser, id: string) {
  const row = await examRow(env, user.id, id);
  if (!row) throw new HttpError(404, "试卷不存在", "EXAM_NOT_FOUND");
  if (row.status === "submitted") return view(env, user, row, true);
  const ids = JSON.parse(row.question_ids_json) as string[];
  const answers = await examAnswers(env, row.id);
  const placeholders = ids.map(() => "?").join(",");
  const keys = await env.DB.prepare(`SELECT qk.question_id, qk.answer, qmap.knowledge_id FROM question_keys qk JOIN question_knowledge qmap ON qmap.question_id = qk.question_id AND qmap.role = 'primary' AND qmap.reviewed = 1 WHERE qk.question_id IN (${placeholders})`).bind(...ids).all<{ question_id: string; answer: string; knowledge_id: string }>();
  const keyById = new Map(keys.results.map((key) => [key.question_id, key]));
  const results = ids.flatMap((questionId) => {
    const key = keyById.get(questionId);
    if (!key) return [];
    const answer = answers[questionId] ?? "";
    return [{ questionId, knowledgeId: key.knowledge_id, answer, correct: answer.trim().toLowerCase() === key.answer.trim().toLowerCase() }];
  });
  const correctCount = results.filter((result) => result.correct).length;
  const score = Math.round((correctCount / Math.max(1, results.length)) * 100);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE exam_sessions SET status = 'submitted', score = ?, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'in_progress'").bind(score, id, user.id),
  ];
  for (const result of results) {
    statements.push(env.DB.prepare("INSERT INTO exam_question_results (exam_session_id, question_id, knowledge_id, answer, correct) VALUES (?, ?, ?, ?, ?)")
      .bind(id, result.questionId, result.knowledgeId, result.answer, result.correct ? 1 : 0));
    const delta = result.correct ? 0.04 : -0.06;
    statements.push(env.DB.prepare("INSERT INTO user_knowledge_state (user_id, knowledge_id, mastery, correct_streak, last_result, algorithm_version) VALUES (?, ?, MAX(0, MIN(1, 0.5 + ?)), ?, ?, 'mastery-v1') ON CONFLICT(user_id, knowledge_id) DO UPDATE SET mastery = MAX(0, MIN(1, mastery + ?)), correct_streak = CASE WHEN ? = 1 THEN correct_streak + 1 ELSE 0 END, last_result = ?, updated_at = CURRENT_TIMESTAMP")
      .bind(user.id, result.knowledgeId, delta, result.correct ? 1 : 0, result.correct ? 1 : 0, delta, result.correct ? 1 : 0, result.correct ? 1 : 0));
  }
  await env.DB.batch(statements);
  const submitted = await examRow(env, user.id, id);
  if (!submitted) throw new HttpError(500, "试卷提交失败", "EXAM_SUBMIT_FAILED");
  return view(env, user, submitted, true);
}

export async function examHistory(env: Env, user: AuthUser) {
  const rows = await env.DB.prepare("SELECT id, mode, status, total_questions, duration_seconds, score, started_at, submitted_at FROM exam_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 8")
    .bind(user.id).all<{ id: string; mode: ExamMode; status: string; total_questions: number; duration_seconds: number; score: number | null; started_at: string; submitted_at: string | null }>();
  return rows.results.map((row) => ({ id: row.id, mode: row.mode, status: row.status, totalQuestions: row.total_questions, durationSeconds: row.duration_seconds, score: row.score, startedAt: row.started_at, submittedAt: row.submitted_at }));
}
