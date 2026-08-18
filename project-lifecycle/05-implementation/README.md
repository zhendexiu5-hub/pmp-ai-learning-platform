# Development Implementation Gate Packet

## Stage

Implementation — Private Alpha Stage 0A/0B/0C first vertical slice.

## Status

Implementation in progress. The previous independent gate identified retry-path, guessed-correct and test-coverage blockers; those code blockers are now corrected, while owner approval of content mappings and production deployment remain pending.

## Implemented slices

1. Cloudflare Worker + React SPA same-origin skeleton with local/staging/production bindings.
2. Closed-registration login, logout, host-only session Cookie, login rate limiting and two-user database isolation.
3. Content pipeline for 209 knowledge points, 63 questions, 20 cases, explicit mappings, content coverage, lint, manifest and D1 seed.
4. Chapter 01 KP-001/KP-002 teaching loop: preview → explanation → case → recall → practice → diagnosis → remediation → retry → variation → point passed → reverse recall → chapter test → review plan.
5. Deterministic mastery-v1 updates, attempt events and review schedule.
6. Responsive application shell with learning home, AI classroom, intelligent practice, mock exam, analytics and knowledge search routes.
7. Safe exam generation from the structurally validated candidate pool, server-enforced timed sessions, per-question concurrency-safe autosave, server-side scoring and post-submit review.
8. Explainable learning insights from attempts, exam results, mastery and review schedules.

## Files changed

- `apps/web`: UI, Worker API, migrations, tests and Wrangler configuration.
- `packages/content`: source normalization, reviewed mappings, Teaching Blocks and generated audit artifacts.
- `scripts/create-alpha-user.ts`: controlled user bootstrap.
- `.github/workflows`: CI and manual gated deployment.
- `DEVELOPMENT.md`: operator handoff.

## Behavior

- Public users cannot register.
- Authenticated users resume only their own latest learning session.
- Every session lookup and update includes `user_id` in its database predicate.
- Exam/practice responses are evaluated server-side. Answer keys and rationales are stored in separate server-only tables.
- Wrong answers do not reveal the answer; they enter explicit diagnosis and remediation before retry.
- Refreshing the browser reloads stage and mastery from D1.

## Data/model

Core tables: users, sessions, login_attempts, knowledge_points, knowledge_fts, questions/question_keys, cases/case_keys, question_knowledge, case_knowledge, teaching_blocks, learning_sessions, attempts, user_knowledge_state, review_schedule, exam_sessions, exam_answers and exam_question_results.

Generated manifest currently asserts:

- knowledge: 209
- questions: 63; mapped: 63
- cases: 20; mapped: 20
- coverage: 2 teachable, 67 brief, 140 index_only
- answer leakage: passed

## Auth/permissions

PBKDF2-SHA256 passwords, random 256-bit session tokens, SHA-256 token storage, HttpOnly/SameSite host-only Cookie, automatic Secure on HTTPS, exact-origin checks for mutations, and hashed IP+email login throttling. No public signup or password reset endpoints exist.

## Tests and evidence

- `pnpm check`: TypeScript + production Worker/client build.
- `pnpm test`: 6 Workers runtime integration tests covering health, A/B isolation, the complete Chapter 01 closure, guessed-correct remediation, reverse-recall/chapter-test retry, refresh persistence, safe exam generation, concurrent autosave, expiry enforcement, server-side submission and cross-user denial.
- Local D1: all five migrations applied successfully, including legacy exam-answer backfill.
- UI/UX V2 was verified in the live browser on desktop and 390 × 844 mobile layouts with no console warnings.

## Known gaps

- Only KP-001 and KP-002 are `teachable`; the remaining content is deliberately brief/index-only per the optimized plan.
- AI generation and AI Gateway are not called in this slice; deterministic sourced teaching is the safe baseline.
- No email verification/reset, Turnstile, Vectorize, Queues or R2 backup yet.
- Remote workers.dev deployment cannot be completed without user-owned Cloudflare credentials and real D1 IDs.
- The 83 question/case mappings remain provisional until the product owner or PMP subject-matter owner records approval; the current `reviewed=1` data must not be treated as owner approval evidence.

## Launch risks

- Placeholder D1 IDs must be replaced before any remote deploy.
- CI deployment requires protected GitHub environments and Cloudflare secrets.
- Private Alpha passwords must be exchanged outside Git and rotated if exposed.
- Chapter expansion must preserve answer separation and add teachable content before enabling AI explanation.

## Assumptions

- Two invited adult users; non-commercial and low traffic.
- `library_data.json` remains the canonical structured source for this stage.
- workers.dev is the first public origin; custom domain migration is later.

## Gate decision requested

Review acceptance criteria, code correctness, security, test adequacy and unresolved launch gaps. Recommended next skill after PASS: `development-verification`.
