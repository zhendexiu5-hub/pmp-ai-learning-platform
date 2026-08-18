import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { caseMappings, questionMappings, type Mapping } from "./mappings.js";
import { teachingBlocks } from "./teaching.js";

const here = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(here, "../../..");
const sourcePath = resolve(workspace, "08_来源与版本/library_data.json");
const generatedDir = resolve(workspace, "packages/content/generated");
const migrationPath = resolve(workspace, "apps/web/migrations/0002_seed_content.sql");

const KnowledgeSchema = z.object({
  ID: z.string().regex(/^KP-\d{3}$/),
  Domain: z.string().min(1),
  Task: z.string().min(1),
  Chapter: z.string().regex(/^\d{2}$/),
  Priority: z.string().min(1),
  Approach: z.string().min(1),
  "中文术语": z.string().min(1),
  "English Term": z.string().min(1),
  "考试理解 Exam Focus": z.string().min(1),
  "易错提醒 Common Trap": z.string().min(1),
});

const QuestionSchema = z.object({
  id: z.string().min(1), stem: z.string().min(1),
  options: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length >= 2),
  answer: z.string().min(1), rationale: z.string().min(1), domain: z.string().min(1),
  task: z.string().min(1), approach: z.string().min(1), difficulty: z.string().min(1), trap: z.string().min(1),
});

const CaseSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), domain: z.string().min(1), approach: z.string().min(1),
  scenario: z.string().min(1), prompts: z.array(z.string().min(1)).min(1), guide: z.string().min(1), tags: z.string().min(1),
});

const LibrarySchema = z.object({
  knowledge: z.array(KnowledgeSchema).length(209),
  questions: z.array(QuestionSchema).length(63),
  cases: z.array(CaseSchema).length(20),
});

const sql = (value: unknown) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const jsonSql = (value: unknown) => sql(JSON.stringify(value));

function validateMappings(kind: string, ids: string[], knowledgeIds: Set<string>, mappings: Mapping[]) {
  const grouped = Map.groupBy(mappings, (mapping) => mapping.contentId);
  const errors: string[] = [];
  for (const id of ids) {
    const rows = grouped.get(id) ?? [];
    if (rows.length === 0) errors.push(`${kind} ${id}: unmapped`);
    if (!rows.some((row) => row.role === "primary")) errors.push(`${kind} ${id}: missing primary`);
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    if (Math.abs(total - 1) > 0.000_001) errors.push(`${kind} ${id}: weights=${total}`);
    for (const row of rows) {
      if (!knowledgeIds.has(row.knowledgeId)) errors.push(`${kind} ${id}: invalid ${row.knowledgeId}`);
      if (!row.reviewed) errors.push(`${kind} ${id}: unreviewed mapping`);
    }
  }
  for (const mappedId of grouped.keys()) {
    if (!ids.includes(mappedId)) errors.push(`${kind} ${mappedId}: source does not exist`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

const raw = await readFile(sourcePath, "utf8");
const library = LibrarySchema.parse(JSON.parse(raw));
const knowledgeIds = new Set(library.knowledge.map((item) => item.ID));
validateMappings("question", library.questions.map((item) => item.id), knowledgeIds, questionMappings);
validateMappings("case", library.cases.map((item) => item.id), knowledgeIds, caseMappings);

const teachableIds = new Set(teachingBlocks.map((block) => block.knowledgeId));
const coveredIds = new Set([...questionMappings, ...caseMappings].map((mapping) => mapping.knowledgeId));
const knowledge = library.knowledge.map((item) => ({
  id: item.ID,
  domain: item.Domain,
  task: item.Task,
  chapterId: item.Chapter,
  priority: item.Priority,
  approach: item.Approach,
  titleZh: item["中文术语"],
  titleEn: item["English Term"],
  examFocus: item["考试理解 Exam Focus"],
  commonTrap: item["易错提醒 Common Trap"],
  contentCoverage: teachableIds.has(item.ID) ? "teachable" : coveredIds.has(item.ID) ? "brief" : "index_only",
}));

if (knowledge.some((item) => !["teachable", "brief", "index_only"].includes(item.contentCoverage))) {
  throw new Error("Every knowledge point must have content_coverage");
}
for (const id of coveredIds) {
  const item = knowledge.find((candidate) => candidate.id === id);
  if (!item || item.contentCoverage === "index_only") throw new Error(`${id} is mapped but index_only`);
}

const publicContent = {
  knowledge,
  questions: library.questions.map(({ answer: _answer, rationale: _rationale, ...question }) => question),
  cases: library.cases.map(({ guide: _guide, ...caseItem }) => caseItem),
  questionMappings,
  caseMappings,
};
const publicJson = JSON.stringify(publicContent, null, 2);
const answerLeakPatterns = [
  ...library.questions.map((item) => item.rationale),
  ...library.cases.map((item) => item.guide),
].filter((value) => value.length >= 12);
if (answerLeakPatterns.some((secret) => publicJson.includes(secret)) || /"(answer|rationale|guide)"\s*:/.test(publicJson)) {
  throw new Error("Answer leakage detected in browser-safe content");
}

const statements: string[] = [
  "PRAGMA defer_foreign_keys = ON;",
  "DELETE FROM teaching_blocks;", "DELETE FROM case_knowledge;", "DELETE FROM question_knowledge;",
  "DELETE FROM case_keys;", "DELETE FROM cases;", "DELETE FROM question_keys;", "DELETE FROM questions;",
  "DELETE FROM knowledge_fts;", "DELETE FROM knowledge_points;",
];
for (const item of knowledge) {
  statements.push(`INSERT INTO knowledge_points (id, chapter_id, domain, task, priority, approach, title_zh, title_en, exam_focus, common_trap, content_coverage) VALUES (${sql(item.id)}, ${sql(item.chapterId)}, ${sql(item.domain)}, ${sql(item.task)}, ${sql(item.priority)}, ${sql(item.approach)}, ${sql(item.titleZh)}, ${sql(item.titleEn)}, ${sql(item.examFocus)}, ${sql(item.commonTrap)}, ${sql(item.contentCoverage)});`);
}
for (const item of library.questions) {
  statements.push(`INSERT INTO questions (id, stem, options_json, domain, task, approach, difficulty, trap) VALUES (${sql(item.id)}, ${sql(item.stem)}, ${jsonSql(item.options)}, ${sql(item.domain)}, ${sql(item.task)}, ${sql(item.approach)}, ${sql(item.difficulty)}, ${sql(item.trap)});`);
  statements.push(`INSERT INTO question_keys (question_id, answer, rationale) VALUES (${sql(item.id)}, ${sql(item.answer)}, ${sql(item.rationale)});`);
}
for (const item of library.cases) {
  statements.push(`INSERT INTO cases (id, title, domain, approach, scenario, prompts_json, tags) VALUES (${sql(item.id)}, ${sql(item.title)}, ${sql(item.domain)}, ${sql(item.approach)}, ${sql(item.scenario)}, ${jsonSql(item.prompts)}, ${sql(item.tags)});`);
  statements.push(`INSERT INTO case_keys (case_id, guide) VALUES (${sql(item.id)}, ${sql(item.guide)});`);
}
for (const item of questionMappings) statements.push(`INSERT INTO question_knowledge (question_id, knowledge_id, role, weight, reason, reviewed) VALUES (${sql(item.contentId)}, ${sql(item.knowledgeId)}, ${sql(item.role)}, ${item.weight}, ${sql(item.reason)}, 1);`);
for (const item of caseMappings) statements.push(`INSERT INTO case_knowledge (case_id, knowledge_id, role, weight, reason, reviewed) VALUES (${sql(item.contentId)}, ${sql(item.knowledgeId)}, ${sql(item.role)}, ${item.weight}, ${sql(item.reason)}, 1);`);
for (const block of teachingBlocks) {
  statements.push(`INSERT INTO teaching_blocks (id, chapter_id, knowledge_id, title, explanation, exam_logic, decision_rule, common_trap, example, source, case_prompt, case_expected_json, recall_prompt, recall_keywords_json, practice_question_id, variation_question_id, remediation) VALUES (${sql(block.id)}, ${sql(block.chapterId)}, ${sql(block.knowledgeId)}, ${sql(block.title)}, ${sql(block.explanation)}, ${sql(block.examLogic)}, ${sql(block.decisionRule)}, ${sql(block.commonTrap)}, ${sql(block.example)}, ${sql(block.source)}, ${sql(block.casePrompt)}, ${jsonSql(block.caseExpected)}, ${sql(block.recallPrompt)}, ${jsonSql(block.recallKeywords)}, ${sql(block.practiceQuestionId)}, ${sql(block.variationQuestionId)}, ${sql(block.remediation)});`);
}
statements.push("INSERT INTO knowledge_fts(rowid, title, exam_focus, common_trap) SELECT rowid, title_zh || ' ' || title_en, exam_focus, common_trap FROM knowledge_points;");

const manifest = {
  version: "private-alpha-v1",
  source: "08_来源与版本/library_data.json",
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  counts: {
    knowledge: knowledge.length,
    questions: library.questions.length,
    cases: library.cases.length,
    mappedQuestions: new Set(questionMappings.map((item) => item.contentId)).size,
    mappedCases: new Set(caseMappings.map((item) => item.contentId)).size,
    coverage: Object.fromEntries(Array.from(Map.groupBy(knowledge, (item) => item.contentCoverage), ([key, value]) => [key, value.length])),
  },
  answerLeakage: "passed",
};

if (!process.argv.includes("--check")) {
  await mkdir(generatedDir, { recursive: true });
  await mkdir(dirname(migrationPath), { recursive: true });
  await writeFile(resolve(generatedDir, "public-content.json"), `${publicJson}\n`, "utf8");
  await writeFile(resolve(generatedDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(migrationPath, `${statements.join("\n")}\n`, "utf8");
}

console.log(JSON.stringify(manifest, null, 2));
