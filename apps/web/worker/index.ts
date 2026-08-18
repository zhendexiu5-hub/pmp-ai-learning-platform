import { currentUser, login, logout, requireUser } from "./auth";
import { examHistory, generateExam, getExam, saveExamAnswer, submitExam } from "./exams";
import { insights } from "./insights";
import { advance, dashboard, learningView, respond, searchKnowledge, startLearning } from "./learning";
import { body, HttpError, json, method, requireSameOrigin, routePath } from "./http";

function requestId(request: Request) {
  return request.headers.get("CF-Ray") ?? crypto.randomUUID();
}

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    const id = requestId(request);
    const path = routePath(request);
    try {
      if (!path.startsWith("/api/")) return new Response(null, { status: 404 });
      if (path === "/api/v1/health") {
        method(request, "GET");
        return json({ ok: true, environment: env.ENVIRONMENT, requestId: id });
      }
      if (path === "/api/v1/auth/login") {
        method(request, "POST"); requireSameOrigin(request);
        const result = await login(request, env, await body(request));
        return json({ user: result.user, requestId: id }, { headers: { "Set-Cookie": result.cookie } });
      }
      if (path === "/api/v1/auth/logout") {
        method(request, "POST"); requireSameOrigin(request);
        return json({ ok: true, requestId: id }, { headers: { "Set-Cookie": await logout(request, env) } });
      }
      if (path === "/api/v1/auth/me") {
        method(request, "GET");
        return json({ user: await currentUser(request, env), requestId: id });
      }

      const user = await requireUser(request, env);
      if (path === "/api/v1/dashboard") {
        method(request, "GET");
        return json({ ...(await dashboard(env, user)), requestId: id });
      }
      if (path === "/api/v1/learning/start") {
        method(request, "POST"); requireSameOrigin(request);
        return json({ session: await startLearning(env, user), requestId: id });
      }
      if (path === "/api/v1/learning/session") {
        method(request, "GET");
        const sessionId = new URL(request.url).searchParams.get("id") ?? undefined;
        return json({ session: await learningView(env, user, sessionId), requestId: id });
      }
      if (path === "/api/v1/learning/advance") {
        method(request, "POST"); requireSameOrigin(request);
        const input = await body<{ sessionId?: unknown }>(request);
        return json({ session: await advance(env, user, String(input.sessionId ?? "")), requestId: id });
      }
      if (path === "/api/v1/learning/respond") {
        method(request, "POST"); requireSameOrigin(request);
        const input = await body<{ sessionId?: unknown; response?: unknown; confidence?: unknown; elapsedMs?: unknown; guessed?: unknown; errorCode?: unknown }>(request);
        return json({ session: await respond(env, user, String(input.sessionId ?? ""), input), requestId: id });
      }
      if (path === "/api/v1/search") {
        method(request, "GET");
        const query = new URL(request.url).searchParams.get("q") ?? "";
        return json({ results: await searchKnowledge(env, user, query), requestId: id });
      }
      if (path === "/api/v1/insights") {
        method(request, "GET");
        return json({ ...(await insights(env, user)), requestId: id });
      }
      if (path === "/api/v1/exams") {
        method(request, "GET");
        return json({ exams: await examHistory(env, user), requestId: id });
      }
      if (path === "/api/v1/exams/generate") {
        method(request, "POST"); requireSameOrigin(request);
        const input = await body<{ mode?: unknown; questionCount?: unknown; durationMinutes?: unknown; strategy?: unknown; domain?: unknown }>(request);
        return json({ exam: await generateExam(env, user, input), requestId: id });
      }
      if (path === "/api/v1/exams/session") {
        method(request, "GET");
        const examId = new URL(request.url).searchParams.get("id") ?? "";
        return json({ exam: await getExam(env, user, examId), requestId: id });
      }
      if (path === "/api/v1/exams/answer") {
        method(request, "POST"); requireSameOrigin(request);
        const input = await body<{ examId?: unknown; questionId?: unknown; answer?: unknown }>(request);
        return json({ ...(await saveExamAnswer(env, user, input)), requestId: id });
      }
      if (path === "/api/v1/exams/submit") {
        method(request, "POST"); requireSameOrigin(request);
        const input = await body<{ examId?: unknown }>(request);
        return json({ exam: await submitExam(env, user, String(input.examId ?? "")), requestId: id });
      }
      throw new HttpError(404, "接口不存在", "NOT_FOUND");
    } catch (error) {
      const known = error instanceof HttpError;
      const status = known ? error.status : 500;
      console.error(JSON.stringify({ event: "request_failed", requestId: id, method: request.method, path, status, durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : "Unknown error" }));
      return json({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "服务暂时不可用" }, requestId: id }, { status });
    } finally {
      ctx.waitUntil(Promise.resolve(console.log(JSON.stringify({ event: "request_complete", requestId: id, method: request.method, path, durationMs: Date.now() - startedAt }))));
    }
  },
} satisfies ExportedHandler<Env>;
