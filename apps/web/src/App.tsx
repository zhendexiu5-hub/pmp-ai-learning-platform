import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { api, post, type User } from "./api";
import { LoadingState } from "./components/PageState";
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

const LearningPage = lazy(() => import("./pages/LearningPage").then((module) => ({ default: module.LearningPage })));
const PracticePage = lazy(() => import("./pages/PracticePage").then((module) => ({ default: module.PracticePage })));
const ExamHubPage = lazy(() => import("./pages/ExamHubPage").then((module) => ({ default: module.ExamHubPage })));
const ExamSessionPage = lazy(() => import("./pages/ExamSessionPage").then((module) => ({ default: module.ExamSessionPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage").then((module) => ({ default: module.KnowledgePage })));
const CourseCenterPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.CourseCenterPage })));
const MyCoursesPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.MyCoursesPage })));
const TodayTasksPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.TodayTasksPage })));
const CourseCalendarPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.CourseCalendarPage })));
const CommunityPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.CommunityPage })));
const SettingsPage = lazy(() => import("./pages/WorkspacePages").then((module) => ({ default: module.SettingsPage })));

function deferred(page: ReactNode) {
  return <Suspense fallback={<LoadingState label="正在打开页面…" />}>{page}</Suspense>;
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => { void api<{ user: User | null }>("/api/v1/auth/me").then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);
  async function logout() { await post("/api/v1/auth/logout", {}); setUser(null); }
  if (user === undefined) return <LoadingState label="正在打开 RUNLOOP…" />;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={setUser} />} />
    <Route path="/exam/:examId" element={user ? deferred(<ExamSessionPage />) : <Navigate to="/login" replace />} />
    <Route element={user ? <AppShell user={user} onLogout={logout} /> : <Navigate to="/login" replace />}>
      <Route index element={<DashboardPage />} />
      <Route path="courses" element={deferred(<CourseCenterPage />)} />
      <Route path="learn" element={deferred(<LearningPage />)} />
      <Route path="practice" element={deferred(<PracticePage />)} />
      <Route path="exam" element={deferred(<ExamHubPage />)} />
      <Route path="reports" element={deferred(<ReportsPage />)} />
      <Route path="knowledge" element={deferred(<KnowledgePage />)} />
      <Route path="my-courses" element={deferred(<MyCoursesPage />)} />
      <Route path="tasks" element={deferred(<TodayTasksPage />)} />
      <Route path="calendar" element={deferred(<CourseCalendarPage />)} />
      <Route path="community" element={deferred(<CommunityPage />)} />
      <Route path="settings" element={deferred(<SettingsPage />)} />
    </Route>
    <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
  </Routes>;
}
