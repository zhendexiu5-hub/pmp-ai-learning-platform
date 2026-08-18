export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") {
    super(message);
  }
}

const apiHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...apiHeaders, ...init.headers } });
}

export async function body<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new HttpError(415, "请求必须使用 JSON", "UNSUPPORTED_MEDIA_TYPE");
  try {
    return await request.json<T>();
  } catch {
    throw new HttpError(400, "请求内容不是有效 JSON", "INVALID_JSON");
  }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, "来源校验失败", "ORIGIN_MISMATCH");
}

export function routePath(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  return path || "/";
}

export function method(request: Request, expected: string) {
  if (request.method !== expected) throw new HttpError(405, "不支持的请求方法", "METHOD_NOT_ALLOWED");
}

export function cleanText(value: unknown, max = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

