import type { AuthUser } from "./auth";

export async function insights(env: Env, user: AuthUser) {
  const [attempts, exams, weak, due, activity] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) total, COALESCE(AVG(correct), 0) accuracy, COALESCE(AVG(elapsed_ms), 0) avg_elapsed_ms, COALESCE(AVG(guessed), 0) guessed_rate FROM attempts WHERE user_id = ? AND created_at >= datetime('now', '-30 days')").bind(user.id).first<{ total: number; accuracy: number; avg_elapsed_ms: number; guessed_rate: number }>(),
    env.DB.prepare("SELECT COUNT(*) total, COALESCE(AVG(score), 0) average_score, MAX(submitted_at) latest_at FROM exam_sessions WHERE user_id = ? AND status = 'submitted'").bind(user.id).first<{ total: number; average_score: number; latest_at: string | null }>(),
    env.DB.prepare("SELECT k.id, k.title_zh, k.chapter_id, k.common_trap, COALESCE(s.mastery, 0.5) mastery, s.last_error_code FROM knowledge_points k LEFT JOIN user_knowledge_state s ON s.knowledge_id = k.id AND s.user_id = ? WHERE k.content_coverage != 'index_only' ORDER BY mastery ASC, k.id LIMIT 6").bind(user.id).all<{ id: string; title_zh: string; chapter_id: string; common_trap: string; mastery: number; last_error_code: string | null }>(),
    env.DB.prepare("SELECT r.knowledge_id, k.title_zh, r.due_at, r.reason FROM review_schedule r JOIN knowledge_points k ON k.id = r.knowledge_id WHERE r.user_id = ? AND r.due_at <= CURRENT_TIMESTAMP ORDER BY r.due_at LIMIT 6").bind(user.id).all<{ knowledge_id: string; title_zh: string; due_at: string; reason: string }>(),
    env.DB.prepare("SELECT day, SUM(total) total, SUM(correct) correct FROM (SELECT date(created_at) day, COUNT(*) total, SUM(correct) correct FROM attempts WHERE user_id = ? AND created_at >= date('now', '-6 days') GROUP BY date(created_at) UNION ALL SELECT date(submitted_at) day, SUM(total_questions) total, SUM(ROUND(total_questions * score / 100.0)) correct FROM exam_sessions WHERE user_id = ? AND status = 'submitted' AND submitted_at >= date('now', '-6 days') GROUP BY date(submitted_at)) GROUP BY day ORDER BY day").bind(user.id, user.id).all<{ day: string; total: number; correct: number }>(),
  ]);
  const weakPoints = weak.results.map((row) => ({ id: row.id, title: row.title_zh, chapterId: row.chapter_id, mastery: row.mastery, commonTrap: row.common_trap, lastErrorCode: row.last_error_code }));
  const recommendations = due.results.length
    ? due.results.slice(0, 3).map((item) => ({ type: "review", knowledgeId: item.knowledge_id, title: `复习「${item.title_zh}」`, reason: item.reason, action: "/learn" }))
    : weakPoints.slice(0, 3).map((item) => ({ type: "practice", knowledgeId: item.id, title: `强化「${item.title}」`, reason: `当前掌握度 ${Math.round(item.mastery * 100)}%`, action: "/practice" }));
  return {
    summary: {
      attempts: attempts?.total ?? 0,
      accuracy: attempts?.accuracy ?? 0,
      averageResponseSeconds: Math.round((attempts?.avg_elapsed_ms ?? 0) / 1000),
      guessedRate: attempts?.guessed_rate ?? 0,
      exams: exams?.total ?? 0,
      averageExamScore: Math.round(exams?.average_score ?? 0),
      latestExamAt: exams?.latest_at ?? null,
    },
    activity: activity.results,
    weakPoints,
    dueReviews: due.results.map((item) => ({ knowledgeId: item.knowledge_id, title: item.title_zh, dueAt: item.due_at, reason: item.reason })),
    recommendations,
  };
}
