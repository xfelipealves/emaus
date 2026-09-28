# Estabilidade dos módulos para Secretaria — tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: activate it by name and follow its Execute flow and Critical Rules. Tests stay co-located with the code or route behavior they verify.

---

**Design**: `.specs/features/emaus-secretary-runtime/design.md`  
**Status**: Implemented; T1 unit and T2 isolated E2E validated

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` instructions supplied for this session; no `CONTRIBUTING.md`, testing-specific README guidance, or coverage threshold was found. Strong defaults applied. Tests are explicitly authorized for this work.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Protected route fallback UI | unit | Assert the exact generic error state, alert semantics, retry affordance, and that exception text is not rendered. | `src/app/(dashboard)/error.test.tsx` | `npm test -- 'src/app/(dashboard)/error.test.tsx'` |
| Secretary route and activity flows | e2e | `/encontros`, meeting detail, `/ministerios`, `/atividades`: reload/happy path; no client exception; admin controls denied/hidden; empty and invalid-input states; active activity/subtask persistence; expired session redirect. Attendance mutation/error paths are covered by the separate attendance-reliability front. | `e2e/secretary-runtime.spec.ts` | `rtk run -c 'PLAYWRIGHT_PORT=3102 npm run test:e2e -- e2e/secretary-runtime.spec.ts'` |
| Domain services/schema | none | No service or schema change is planned; existing service and schema gates remain part of full validation. | — | build gate only |

## Gate Check Commands

> Generated from `package.json`, `vitest.config.ts`, and `playwright.config.ts`. Run this E2E through the repository's `npm run test:e2e` wrapper, which creates a unique disposable PostgreSQL container. Do not call Playwright directly or target a fixed application database.

> Safety update: `scripts/e2e/run.mjs` creates a memory-backed PostgreSQL container, constructs its URL internally, validates it with `scripts/e2e/database-safety.mjs`, and passes it to Prisma and Playwright. The setup guard repeats that validation. `rtk env` only displays variables; do not use it as a shell assignment.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit-only task | `npm test -- 'src/app/(dashboard)/error.test.tsx'` |
| Full | E2E task | `rtk npm test -- --exclude '**/*.integration.test.ts' && rtk run -c 'PLAYWRIGHT_PORT=3102 npm run test:e2e -- e2e/secretary-runtime.spec.ts'` |
| Build | Feature completion | `rtk npm run typecheck && rtk npm run lint && rtk npm run build && rtk npm test && rtk npm run test:integration && rtk run -c 'PLAYWRIGHT_PORT=3102 npm run test:e2e -- e2e/secretary-runtime.spec.ts'` |

## Execution Plan

Phases run in order. The E2E coverage follows the fallback component so it can verify both the protected runtime and the existing secretary permissions.

```text
Phase 1: T1
Phase 2: T2

T1 → T2
```

### T1: Add a safe error boundary for protected pages

**What**: Render a controlled fallback with a retry action for uncaught page-render errors in the authenticated dashboard, and record a technical diagnostic without displaying exception details.
**Where**: `src/app/(dashboard)/error.tsx`, `src/app/(dashboard)/error.test.tsx`
**Depends on**: None
**Reuses**: Next.js 15 `error.tsx` contract; existing typography, buttons, and `role="alert"` conventions.
**Requirement**: SEC-RUN-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Fallback renders an alert with a safe, exact user-facing title and retry button.
- [x] The retry button calls the supplied `reset` function.
- [x] The UI never includes `error.message`; the diagnostic logs the dashboard scope and `error.digest`, and includes `error.message` only in development.
- [x] A co-located Vitest test asserts the alert, generic copy, retry label, and absence of a deliberately private exception string.
- [x] `npm test -- 'src/app/(dashboard)/error.test.tsx'` passes without skips.

**Tests**: unit  
**Gate**: quick

### T2: Verify the Secretary runtime across protected modules

**What**: Add an isolated Playwright scenario for the Secretary that reloads the routes, confirms the existing ministry permission boundary, and persists a shared activity and subtask.
**Where**: `e2e/secretary-runtime.spec.ts`
**Depends on**: T1
**Reuses**: `e2e/demo-fixtures.ts`, `e2e/activities.spec.ts`, `e2e/permissions.spec.ts`, existing app actions and services.
**Requirement**: SEC-RUN-01, SEC-RUN-02, SEC-RUN-03, SEC-RUN-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The active Secretary reloads `/encontros` and `/encontros/demo-meeting-scheduled`, sees the meeting/frequency page, and records no `pageerror` or exception screen.
- [x] `/ministerios` gives a valid current read page, records no `pageerror`, and exposes no create, edit, archive, or membership-management form.
- [x] `/atividades` renders its empty state in the isolated database; the Secretary creates an activity and subtask, updates completion, and sees the persisted state after reload.
- [x] Invalid activity data yields an alert and creates no record; the route remains usable afterward.
- [x] Clearing the authenticated session before each protected route redirects to `/login` without a client exception.
- [x] All test records are uniquely named and removed after the run; no pre-existing activity UI files are edited.
- [x] All five E2E cases pass through `rtk run -c 'PLAYWRIGHT_PORT=3102 npm run test:e2e -- e2e/secretary-runtime.spec.ts'` on the project's disposable database runner. The earlier direct Playwright attempt used the wrong target and is not valid evidence.
- [x] Shared runner safety tests pass before any reset (`npm run test:e2e:safety`, 2/2 passed).
- [x] Frequency mutation/failure assertions remain owned by the separate attendance-reliability front and its reserved E2E file.

**Tests**: e2e  
**Gate**: full

## Task Validation

### Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Add protected-page error boundary | One route-boundary component plus its co-located test | ✅ Granular |
| T2: Verify Secretary runtime | One E2E scenario file covering the single Secretary runtime story | ✅ Granular |

### Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | No incoming arrow | ✅ Match |
| T2 | T1 | `T1 → T2` | ✅ Match |

### Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Protected route fallback UI | unit | unit | ✅ Co-located in T1 |
| T2 | Secretary route behavior | e2e | e2e | ✅ Co-located in T2 |

## Phase Execution Map

```text
Phase 1: T1
    T1 — boundary + unit test
     ↓
Phase 2: T2
    T2 — Secretary E2E runtime
```

## Execution Notes

- The E2E wrapper starts a unique temporary PostgreSQL container with a memory-backed data directory, validates the generated loopback-only URL, applies migrations, then passes the same isolated environment to the web server and Playwright. A direct Playwright invocation bypasses this protection; use only `npm run test:e2e`.
- Use `PLAYWRIGHT_PORT=3102`; do not reuse or terminate another worker's server.
- Do not edit `.specs/STATE.md`, `.specs/LESSONS.md`, `.specs/lessons.json`, the reserved attendance/audit paths, or pre-existing local activities UI changes.
- The list policy for Ministries remains the behavior currently exposed by the application; this task does not settle or broaden the product's read scope.

## Validation Record

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| RED — boundary behavior | Observed | The provisional unsafe implementation failed all three unit assertions: it showed the exception, did not support the reset-only fallback call, and logged the raw error object without structured dashboard scope. |
| GREEN — boundary unit test | Passed | `rtk npm test -- 'src/app/(dashboard)/error.test.tsx'` — 1 file, 3 tests passed. |
| Unit suite (excluding database integration tests) | Passed | `rtk npm test -- --exclude '**/*.integration.test.ts'` — 11 files, 33 tests passed. |
| TypeScript inicial | Passed | `rtk ./node_modules/.bin/tsc --noEmit --incremental false` passou antes das mudanças compartilhadas de integração. O typecheck atual do workspace falha em `src/features/auth/account-service.integration.test.ts`, arquivo fora desta frente, por importar `resetAccountPassword`, que não é exportado. |
| ESLint for changed code | Passed | `rtk ./node_modules/.bin/eslint 'src/app/(dashboard)/error.tsx' 'src/app/(dashboard)/error.test.tsx' e2e/secretary-runtime.spec.ts`; após os últimos ajustes, ESLint direcionado ao E2E também passou. |
| Guarda do runner E2E | Passed | `rtk npm run test:e2e:safety` — 2/2; aceita apenas URL loopback criada para banco temporário e rejeita URL ausente, compartilhada ou remota. |
| E2E | Passed | `rtk run -c 'PLAYWRIGHT_PORT=3102 npm run test:e2e -- e2e/secretary-runtime.spec.ts'` — 5/5 no Postgres temporário `emaus_e2e_0c67e8467267`; runner removeu o container e 3102 ficou livre. Evidência detalhada em `validation.md`. |
| Build / database integration | Not run | Não executados nesta rodada; o `.next` compartilhado e o banco de desenvolvimento foram preservados. |

`e2e/secretary-runtime.spec.ts` uses `waitUntil: "domcontentloaded"` on route loads/reloads and asserts rendered content afterward, without changing the global navigation timeout.
