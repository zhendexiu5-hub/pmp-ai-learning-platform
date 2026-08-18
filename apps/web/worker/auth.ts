import { cleanText, HttpError } from "./http";

const SESSION_COOKIE = "pmp_session";
const SESSION_DAYS = 14;
const encoder = new TextEncoder();

type UserRow = { id: string; email: string; display_name: string; password_hash: string; verified: number };
export type AuthUser = { id: string; email: string; displayName: string };

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function parseCookies(request: Request) {
  return new Map((request.headers.get("Cookie") ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const iterations = 120_000;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `pbkdf2-sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationsText, saltText, expectedText] = encoded.split("$");
  if (algorithm !== "pbkdf2-sha256" || !iterationsText || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 600_000) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(saltText), iterations }, key, 256));
  const expected = base64ToBytes(expectedText);
  if (bits.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < bits.length; index += 1) difference |= bits[index] ^ expected[index];
  return difference === 0;
}

async function rateLimitKey(request: Request, email: string) {
  return sha256(`${request.headers.get("CF-Connecting-IP") ?? "local"}:${email}`);
}

export async function login(request: Request, env: Env, input: { email?: unknown; password?: unknown }) {
  const email = cleanText(input.email, 254).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";
  if (!email || password.length < 8 || password.length > 256) throw new HttpError(401, "邮箱或密码不正确", "INVALID_CREDENTIALS");

  const key = await rateLimitKey(request, email);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const attempt = await env.DB.prepare("SELECT window_started_at, attempt_count FROM login_attempts WHERE identifier_hash = ?").bind(key).first<{ window_started_at: number; attempt_count: number }>();
  if (attempt && now - attempt.window_started_at < windowMs && attempt.attempt_count >= 8) throw new HttpError(429, "尝试次数过多，请稍后再试", "LOGIN_RATE_LIMITED");

  const user = await env.DB.prepare("SELECT id, email, display_name, password_hash, verified FROM users WHERE email = ? COLLATE NOCASE").bind(email).first<UserRow>();
  const valid = user?.verified === 1 && await verifyPassword(password, user.password_hash);
  if (!valid) {
    await env.DB.prepare("INSERT INTO login_attempts (identifier_hash, window_started_at, attempt_count) VALUES (?, ?, 1) ON CONFLICT(identifier_hash) DO UPDATE SET window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END, attempt_count = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE attempt_count + 1 END")
      .bind(key, now, now, windowMs, now, now, windowMs).run();
    throw new HttpError(401, "邮箱或密码不正确", "INVALID_CREDENTIALS");
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const expires = new Date(now + SESSION_DAYS * 86_400_000);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_attempts WHERE identifier_hash = ?").bind(key),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, user.id, expires.toISOString()),
  ]);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86_400}${secure}`;
  return { user: { id: user.id, email: user.email, displayName: user.display_name }, cookie };
}

export async function currentUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const user = await env.DB.prepare("SELECT u.id, u.email, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND datetime(s.expires_at) > CURRENT_TIMESTAMP")
    .bind(tokenHash).first<{ id: string; email: string; display_name: string }>();
  return user ? { id: user.id, email: user.email, displayName: user.display_name } : null;
}

export async function requireUser(request: Request, env: Env) {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "请先登录", "UNAUTHENTICATED");
  return user;
}

export async function logout(request: Request, env: Env) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
