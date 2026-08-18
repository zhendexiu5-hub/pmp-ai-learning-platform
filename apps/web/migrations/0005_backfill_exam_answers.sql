INSERT OR IGNORE INTO exam_answers (exam_session_id, question_id, answer, updated_at)
SELECT exam.id, saved.key, CAST(saved.value AS TEXT), exam.updated_at
FROM exam_sessions AS exam, json_each(exam.answers_json) AS saved
WHERE json_type(exam.answers_json, '$.' || saved.key) = 'text';
