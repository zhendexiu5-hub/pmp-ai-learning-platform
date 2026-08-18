CREATE TABLE exam_answers (
  exam_session_id TEXT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_session_id, question_id)
);

CREATE INDEX exam_answers_session_idx ON exam_answers(exam_session_id, updated_at DESC);
