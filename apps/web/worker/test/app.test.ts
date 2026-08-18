import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth";

const origin = "http://example.com";
const password = "Private-Alpha-Test-2026";

async function login(email: string) {
  const response = await SELF.fetch(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

async function request<T>(cookie: string, path: string, payload?: unknown) {
  const response = await SELF.fetch(`${origin}${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers: { Cookie: cookie, ...(payload === undefined ? {} : { "Content-Type": "application/json", Origin: origin }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json<T>();
  expect(response.status).toBe(200);
  return data;
}

describe("Private Alpha vertical slice", () => {
  beforeAll(async () => {
    const hash = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)").bind("user-a", "a@example.com", "User A", hash),
      env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)").bind("user-b", "b@example.com", "User B", hash),
      env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)").bind("user-c", "c@example.com", "User C", hash),
    ]);
  });

  it("serves health without authentication", async () => {
    const response = await SELF.fetch(`${origin}/api/v1/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it("keeps two users' learning sessions isolated and never returns answer keys", async () => {
    const [cookieA, cookieB] = await Promise.all([login("a@example.com"), login("b@example.com")]);
    const startedA = await request<{ session: { id: string; stage: string } }>(cookieA, "/api/v1/learning/start", {});
    const startedB = await request<{ session: { id: string; stage: string } }>(cookieB, "/api/v1/learning/start", {});
    expect(startedA.session.id).not.toBe(startedB.session.id);

    const explainA = await request<{ session: { id: string; stage: string } }>(cookieA, "/api/v1/learning/advance", { sessionId: startedA.session.id });
    expect(explainA.session.stage).toBe("explain");
    const dashboardB = await request<{ current: { stage: string } }>(cookieB, "/api/v1/dashboard");
    expect(dashboardB.current.stage).toBe("chapter_preview");

    const caseA = await request<{ session: { id: string; stage: string } }>(cookieA, "/api/v1/learning/advance", { sessionId: startedA.session.id });
    expect(caseA.session.stage).toBe("case_judgment");
    const wrong = await request<{ session: { stage: string } }>(cookieA, "/api/v1/learning/respond", { sessionId: startedA.session.id, response: "运营", confidence: 4, elapsedMs: 9000 });
    expect(wrong.session.stage).toBe("diagnose");
    const diagnosed = await request<{ session: { stage: string } }>(cookieA, "/api/v1/learning/respond", { sessionId: startedA.session.id, errorCode: "C" });
    expect(diagnosed.session.stage).toBe("remediate");
    await request(cookieA, "/api/v1/learning/advance", { sessionId: startedA.session.id });
    const recalled = await request<{ session: { stage: string } }>(cookieA, "/api/v1/learning/respond", { sessionId: startedA.session.id, response: "项目具有独特成果和明确完成状态", confidence: 4 });
    expect(recalled.session.stage).toBe("active_recall");
    const practice = await request<{ session: { stage: string; question: Record<string, unknown> } }>(cookieA, "/api/v1/learning/respond", { sessionId: startedA.session.id, response: "独特成果，并有完成与移交", confidence: 4 });
    expect(practice.session.stage).toBe("exam_practice");
    expect(practice.session.question).not.toHaveProperty("answer");
    expect(practice.session.question).not.toHaveProperty("rationale");
    const variation = await request<{ session: { stage: string; question: Record<string, unknown> } }>(cookieA, "/api/v1/learning/respond", { sessionId: startedA.session.id, response: "A", confidence: 5 });
    expect(variation.session.stage).toBe("variation_check");
    expect(JSON.stringify(variation)).not.toContain("它有独特成果、完成状态和移交点");
    const passed = await request<{ session: { stage: string; mastery: number } }>(cookieA, "/api/v1/learning/respond", { sessionId: startedA.session.id, response: "B", confidence: 5 });
    expect(passed.session.stage).toBe("point_passed");
    expect(passed.session.mastery).toBeGreaterThan(0.5);

    const stateB = await env.DB.prepare("SELECT mastery FROM user_knowledge_state WHERE user_id = ? AND knowledge_id = ?").bind("user-b", "KP-001").first();
    expect(stateB).toBeNull();
  });

  it("rejects cross-user session access at the database boundary", async () => {
    const cookieB = await login("b@example.com");
    const sessionA = await env.DB.prepare("SELECT id FROM learning_sessions WHERE user_id = 'user-a' LIMIT 1").first<{ id: string }>();
    const response = await SELF.fetch(`${origin}/api/v1/learning/advance`, {
      method: "POST",
      headers: { Cookie: cookieB, "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ sessionId: sessionA!.id }),
    });
    expect(response.status).toBe(404);
  });

  it("completes the full Chapter 01 state machine, including guessed-correct and both retry paths", async () => {
    const cookie = await login("c@example.com");
    const started = await request<{ session: { id: string; stage: string } }>(cookie, "/api/v1/learning/start", {});
    const id = started.session.id;
    const advance = () => request<{ session: { stage: string; retryOrigin?: string | null; knowledge?: { id: string }; question?: Record<string, unknown> } }>(cookie, "/api/v1/learning/advance", { sessionId: id });
    const respond = (payload: Record<string, unknown>) => request<{ session: { stage: string; retryOrigin?: string | null; knowledge?: { id: string }; question?: Record<string, unknown> } }>(cookie, "/api/v1/learning/respond", { sessionId: id, confidence: 4, elapsedMs: 1200, ...payload });

    expect((await advance()).session.stage).toBe("explain");
    expect((await advance()).session.stage).toBe("case_judgment");

    const guessedCorrect = await respond({ response: "项目，因为它产生独特成果", guessed: true });
    expect(guessedCorrect.session.stage).toBe("diagnose");
    expect(guessedCorrect.session.retryOrigin).toBe("case_judgment");
    expect((await respond({ errorCode: "E" })).session.stage).toBe("remediate");
    expect((await advance()).session.stage).toBe("retry");
    expect((await respond({ response: "项目，因为它有独特成果和完成状态" })).session.stage).toBe("active_recall");

    expect((await respond({ response: "项目的核心是独特成果与明确完成状态" })).session.stage).toBe("exam_practice");
    const persisted = await request<{ session: { stage: string; id: string } }>(cookie, `/api/v1/learning/session?id=${id}`);
    expect(persisted.session).toMatchObject({ id, stage: "exam_practice" });
    expect((await respond({ response: "A" })).session.stage).toBe("variation_check");
    expect((await respond({ response: "B" })).session.stage).toBe("point_passed");

    const secondPoint = await advance();
    expect(secondPoint.session).toMatchObject({ stage: "explain", knowledge: { id: "KP-002" } });
    expect((await advance()).session.stage).toBe("case_judgment");
    expect((await respond({ response: "运营，因为仍在重复维持日常服务" })).session.stage).toBe("active_recall");
    expect((await respond({ response: "期限不改变重复维持业务的工作本质" })).session.stage).toBe("exam_practice");
    expect((await respond({ response: "B" })).session.stage).toBe("variation_check");
    expect((await respond({ response: "B" })).session.stage).toBe("point_passed");
    expect((await advance()).session.stage).toBe("reverse_recall");

    const reverseWrong = await respond({ response: "两者都一样" });
    expect(reverseWrong.session).toMatchObject({ stage: "diagnose", retryOrigin: "reverse_recall" });
    expect((await respond({ errorCode: "C" })).session.stage).toBe("remediate");
    const reverseRetry = await advance();
    expect(reverseRetry.session).toMatchObject({ stage: "retry", retryOrigin: "reverse_recall" });
    expect((await respond({ response: "项目创造独特成果，运营重复维持业务" })).session.stage).toBe("chapter_test");

    const testWrong = await respond({ response: "A" });
    expect(testWrong.session).toMatchObject({ stage: "diagnose", retryOrigin: "chapter_test" });
    expect((await respond({ errorCode: "Q" })).session.stage).toBe("remediate");
    const testRetry = await advance();
    expect(testRetry.session).toMatchObject({ stage: "retry", retryOrigin: "chapter_test" });
    expect(testRetry.session.question).toBeDefined();
    expect((await respond({ response: "B" })).session.stage).toBe("review_plan");
    expect((await advance()).session.stage).toBe("chapter_complete");
  });

  it("generates a safe exam, saves overlapping answers without loss, and reveals keys only after submission", async () => {
    const cookie = await login("c@example.com");
    const generated = await request<{ exam: { id: string; questions: Array<{ id: string }>; answers: Record<string, string>; review?: unknown } }>(cookie, "/api/v1/exams/generate", { mode: "exam", questionCount: 5, durationMinutes: 15, strategy: "balanced" });
    expect(generated.exam.questions).toHaveLength(5);
    expect(generated.exam.review).toBeUndefined();
    expect(JSON.stringify(generated)).not.toContain("rationale");
    expect(generated.exam.questions[0]).not.toHaveProperty("trap");
    expect(generated.exam.questions[0]).not.toHaveProperty("knowledgeId");
    expect(generated.exam.questions[0]).not.toHaveProperty("knowledgeTitle");
    const [firstQuestion, secondQuestion] = generated.exam.questions;
    await Promise.all([
      request(cookie, "/api/v1/exams/answer", { examId: generated.exam.id, questionId: firstQuestion.id, answer: "A" }),
      request(cookie, "/api/v1/exams/answer", { examId: generated.exam.id, questionId: secondQuestion.id, answer: "B" }),
    ]);
    const resumed = await request<{ exam: { answers: Record<string, string>; review?: unknown } }>(cookie, `/api/v1/exams/session?id=${generated.exam.id}`);
    expect(resumed.exam.answers[firstQuestion.id]).toBe("A");
    expect(resumed.exam.answers[secondQuestion.id]).toBe("B");
    expect(resumed.exam.review).toBeUndefined();
    const submitted = await request<{ exam: { status: string; score: number; review: unknown[] } }>(cookie, "/api/v1/exams/submit", { examId: generated.exam.id });
    expect(submitted.exam.status).toBe("submitted");
    expect(submitted.exam.score).toBeGreaterThanOrEqual(0);
    expect(submitted.exam.review).toHaveLength(5);
  });

  it("rejects late answers and server-side submits an expired exam", async () => {
    const cookie = await login("c@example.com");
    const generated = await request<{ exam: { id: string; questions: Array<{ id: string }> } }>(cookie, "/api/v1/exams/generate", { mode: "exam", questionCount: 5, durationMinutes: 15, strategy: "balanced" });
    await env.DB.prepare("UPDATE exam_sessions SET expires_at = datetime('now', '-1 second') WHERE id = ?").bind(generated.exam.id).run();

    const lateAnswer = await SELF.fetch(`${origin}/api/v1/exams/answer`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ examId: generated.exam.id, questionId: generated.exam.questions[0].id, answer: "A" }),
    });
    expect(lateAnswer.status).toBe(409);
    expect(await lateAnswer.json()).toMatchObject({ error: { code: "EXAM_EXPIRED" } });

    const resumed = await request<{ exam: { status: string; submittedAt: string; review: unknown[] } }>(cookie, `/api/v1/exams/session?id=${generated.exam.id}`);
    expect(resumed.exam.status).toBe("submitted");
    expect(resumed.exam.submittedAt).toBeTruthy();
    expect(resumed.exam.review).toHaveLength(5);
  });
});
