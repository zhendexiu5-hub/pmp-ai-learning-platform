PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sessions_user_idx ON sessions(user_id, expires_at);

CREATE TABLE login_attempts (
  identifier_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE knowledge_points (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  task TEXT NOT NULL,
  priority TEXT NOT NULL,
  approach TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  exam_focus TEXT NOT NULL,
  common_trap TEXT NOT NULL,
  content_coverage TEXT NOT NULL CHECK (content_coverage IN ('teachable', 'brief', 'index_only'))
);
CREATE INDEX knowledge_chapter_idx ON knowledge_points(chapter_id, id);

CREATE VIRTUAL TABLE knowledge_fts USING fts5(title, exam_focus, common_trap, tokenize='unicode61');

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  stem TEXT NOT NULL,
  options_json TEXT NOT NULL CHECK (json_valid(options_json)),
  domain TEXT NOT NULL,
  task TEXT NOT NULL,
  approach TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  trap TEXT NOT NULL
);

CREATE TABLE question_keys (
  question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  rationale TEXT NOT NULL
);

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  approach TEXT NOT NULL,
  scenario TEXT NOT NULL,
  prompts_json TEXT NOT NULL CHECK (json_valid(prompts_json)),
  tags TEXT NOT NULL
);

CREATE TABLE case_keys (
  case_id TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  guide TEXT NOT NULL
);

CREATE TABLE question_knowledge (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary')),
  weight REAL NOT NULL CHECK (weight > 0 AND weight <= 1),
  reason TEXT NOT NULL,
  reviewed INTEGER NOT NULL CHECK (reviewed IN (0, 1)),
  PRIMARY KEY (question_id, knowledge_id)
);

CREATE TABLE case_knowledge (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary')),
  weight REAL NOT NULL CHECK (weight > 0 AND weight <= 1),
  reason TEXT NOT NULL,
  reviewed INTEGER NOT NULL CHECK (reviewed IN (0, 1)),
  PRIMARY KEY (case_id, knowledge_id)
);

CREATE TABLE teaching_blocks (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  knowledge_id TEXT NOT NULL UNIQUE REFERENCES knowledge_points(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  exam_logic TEXT NOT NULL,
  decision_rule TEXT NOT NULL,
  common_trap TEXT NOT NULL,
  example TEXT NOT NULL,
  source TEXT NOT NULL,
  case_prompt TEXT NOT NULL,
  case_expected_json TEXT NOT NULL CHECK (json_valid(case_expected_json)),
  recall_prompt TEXT NOT NULL,
  recall_keywords_json TEXT NOT NULL CHECK (json_valid(recall_keywords_json)),
  practice_question_id TEXT NOT NULL REFERENCES questions(id),
  variation_question_id TEXT NOT NULL REFERENCES questions(id),
  remediation TEXT NOT NULL
);

CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id),
  knowledge_index INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL,
  retry_origin TEXT,
  last_feedback TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX learning_sessions_user_idx ON learning_sessions(user_id, updated_at DESC);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_session_id TEXT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('case', 'recall', 'question', 'chapter_test')),
  content_id TEXT NOT NULL,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id),
  stage TEXT NOT NULL,
  response TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  elapsed_ms INTEGER CHECK (elapsed_ms >= 0),
  guessed INTEGER NOT NULL DEFAULT 0 CHECK (guessed IN (0, 1)),
  error_code TEXT CHECK (error_code IN ('K', 'C', 'M', 'R', 'Q', 'E')),
  variation_check INTEGER NOT NULL DEFAULT 0 CHECK (variation_check IN (0, 1)),
  algorithm_version TEXT NOT NULL DEFAULT 'mastery-v1',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX attempts_user_idx ON attempts(user_id, created_at DESC);

CREATE TABLE user_knowledge_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  mastery REAL NOT NULL DEFAULT 0.5 CHECK (mastery BETWEEN 0 AND 1),
  correct_streak INTEGER NOT NULL DEFAULT 0,
  last_result INTEGER CHECK (last_result IN (0, 1)),
  last_error_code TEXT,
  algorithm_version TEXT NOT NULL DEFAULT 'mastery-v1',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, knowledge_id)
);

CREATE TABLE review_schedule (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  PRIMARY KEY (user_id, knowledge_id)
);
CREATE INDEX review_due_idx ON review_schedule(user_id, due_at);
