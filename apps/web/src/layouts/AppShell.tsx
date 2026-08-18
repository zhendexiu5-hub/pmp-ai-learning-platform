import { NavLink, Outlet } from "react-router";
import type { User } from "../api";
import { Brand } from "../components/Brand";

const navItems = [
  { to: "/courses", label: "课程中心", glyph: "课" },
  { to: "/learn", label: "学习路径", glyph: "学" },
  { to: "/practice", label: "AI 导师", glyph: "AI" },
  { to: "/exam", label: "题库测评", glyph: "测" },
  { to: "/reports", label: "数据看板", glyph: "数" },
] as const;

const sideItems = [
  { to: "/", label: "总览", glyph: "⌂" },
  { to: "/my-courses", label: "我的课程", glyph: "□" },
  { to: "/tasks", label: "今日任务", glyph: "✓" },
  { to: "/calendar", label: "课程日历", glyph: "▦" },
  { to: "/community", label: "学习社区", glyph: "○" },
  { to: "/settings", label: "设置", glyph: "⚙" },
] as const;

export function AppShell({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  return <div className="app-shell">
    <header className="app-header">
      <Brand />
      <nav className="primary-nav" aria-label="主要功能">
        {navItems.map((item) => <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? "active" : ""}><span className="nav-glyph" aria-hidden="true">{item.glyph}</span>{item.label}</NavLink>)}
      </nav>
      <div className="header-actions">
        <NavLink className="knowledge-link" to="/knowledge" aria-label="搜索">搜索</NavLink>
        <span className="notification-dot" aria-label="8 条新通知">8</span>
        <div className="user-identity"><span className="user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>Private Alpha</small></span></div>
        <button className="text-button" onClick={() => void onLogout()}>退出</button>
      </div>
    </header>
    <div className="shell-body">
      <aside className="academy-sidebar">
        <nav aria-label="学习工作区">{sideItems.map((item) => <NavLink key={item.label} to={item.to} end={item.to === "/"} className={({ isActive }) => isActive ? "active" : ""}><span>{item.glyph}</span>{item.label}</NavLink>)}</nav>
        <div className="membership-promo"><strong>升级会员</strong><p>解锁全部课程与专属权益</p><button>去升级</button><i /></div>
      </aside>
      <div className="app-content"><Outlet /></div>
    </div>
    <nav className="mobile-nav" aria-label="移动端主要功能">
      {navItems.map((item) => <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? "active" : ""}><span className="nav-glyph" aria-hidden="true">{item.glyph}</span><span>{item.label.replace("学习", "") || "首页"}</span></NavLink>)}
    </nav>
  </div>;
}
