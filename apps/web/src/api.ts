export type User = { id: string; email: string; displayName: string };
export type Question = { id: string; stem: string; options: Record<string, string>; difficulty: string };
export type LearningSession = {
  id: string;
  chapter: { id: string; title: string; position: number; total: number };
  knowledge: { id: string; titleZh: string; titleEn: string; commonTrap: string; coverage: string } | null;
  knowledgeIndex: number;
  knowledgeTotal: number;
  stage: string;
  retryOrigin: string | null;
  feedback: string | null;
  block: {
    title: string;
    explanation?: string;
    examLogic?: string;
    decisionRule?: string;
    commonTrap?: string;
    example?: string;
    source?: string;
    casePrompt?: string;
    recallPrompt?: string;
    remediation?: string;
  };
  question?: Question;
  mastery: number;
  correctStreak: number;
  lastErrorCode: string | null;
  updatedAt: string;
};

export type Dashboard = {
  user: User;
  current: LearningSession | null;
  route: Array<{ id: string; title_zh: string; title_en: string; common_trap: string; mastery: number }>;
  dueReviews: Array<{ knowledge_id: string; title_zh: string; due_at: string; reason: string }>;
};

export type ExamQuestion = {
  id: string;
  stem: string;
  options: Record<string, string>;
  domain: string;
  task: string;
  approach: string;
  difficulty: string;
  trap?: string;
  knowledgeId?: string;
  knowledgeTitle?: string;
};

export type ExamReview = {
  questionId: string;
  answer: string;
  correctAnswer: string;
  correct: boolean;
  rationale: string;
};

export type ExamSession = {
  id: string;
  mode: "practice" | "exam";
  status: "in_progress" | "submitted";
  config: { strategy?: string; domain?: string | null; generatedFrom?: string };
  totalQuestions: number;
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  score: number | null;
  answers: Record<string, string>;
  questions: ExamQuestion[];
  review?: ExamReview[];
};

export type ExamHistoryItem = Pick<ExamSession, "id" | "mode" | "status" | "totalQuestions" | "durationSeconds" | "score" | "startedAt" | "submittedAt">;

export type Insights = {
  summary: {
    attempts: number;
    accuracy: number;
    averageResponseSeconds: number;
    guessedRate: number;
    exams: number;
    averageExamScore: number;
    latestExamAt: string | null;
  };
  activity: Array<{ day: string; total: number; correct: number }>;
  weakPoints: Array<{ id: string; title: string; chapterId: string; mastery: number; commonTrap: string; lastErrorCode: string | null }>;
  dueReviews: Array<{ knowledgeId: string; title: string; dueAt: string; reason: string }>;
  recommendations: Array<{ type: string; knowledgeId: string; title: string; reason: string; action: string }>;
};

export type KnowledgeSearchResult = {
  id: string;
  chapter_id: string;
  title_zh: string;
  title_en: string;
  exam_focus: string;
  content_coverage: string;
  rank: number;
};

type ApiError = { error?: { code?: string; message?: string } };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const payload = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(payload.error?.message ?? "请求失败，请稍后重试");
  return payload;
}

export const post = <T>(path: string, payload: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(payload) });
