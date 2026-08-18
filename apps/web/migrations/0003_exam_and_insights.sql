CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  question_ids_json TEXT NOT NULL CHECK (json_valid(question_ids_json)),
  answers_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(answers_json)),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  score INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  submitted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX exam_sessions_user_idx ON exam_sessions(user_id, updated_at DESC);

CREATE TABLE exam_question_results (
  exam_session_id TEXT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  knowledge_id TEXT NOT NULL REFERENCES knowledge_points(id),
  answer TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_session_id, question_id)
);

CREATE INDEX exam_results_knowledge_idx ON exam_question_results(knowledge_id, correct);
