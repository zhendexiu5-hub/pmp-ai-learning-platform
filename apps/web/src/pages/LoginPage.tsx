import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { post, type User } from "../api";
import { Brand } from "../components/Brand";

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await post<{ user: User }>("/api/v1/auth/login", { email, password });
      onLogin(result.user); navigate("/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败"); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-shell"><div className="login-brand"><Brand staticLink /></div><section className="login-panel" aria-labelledby="login-title"><div><h1 id="login-title">欢迎回来</h1><p>登录账号，继续课堂进度</p></div><form onSubmit={submit}><label>邮箱<input autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>密码<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "正在登录…" : "登录"}</button></form><p className="invite-note">Private Alpha · 仅限受邀账号</p></section></section></main>;
}
