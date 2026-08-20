# Atividades compartilhadas — tasks

## Execution Protocol

Implement with `tlc-spec-driven` and TDD. One atomic commit per task; every task must pass its gate before completion. After the final task, run the independent feature verifier and write `validation.md`.

**Spec**: `.specs/features/emaus-activities/spec.md`
**Design**: `.specs/features/emaus-activities/design.md`
**Status**: In Progress

## Test Coverage Matrix

| Layer | Required coverage | Location | Gate |
| --- | --- | --- | --- |
| Domain/service | validation, active-session boundary, buckets, delete cascade and subtask CRUD | `src/features/atividades/activity-service.integration.test.ts` | `npm test` with temporary DB |
| Server actions/page | session guard and filter wiring | `src/app/(dashboard)/atividades/` | `npm run typecheck && npm run lint` |
| User-critical flow | create/filter, subtask CRUD, confirmed delete | `e2e/activities.spec.ts` | `npm run test:e2e` |
| Prisma | migration chain and schema | `prisma/schema.prisma`, migration | `npm run db:validate` + fresh reset |

## Gate Check Commands

| Gate | Command |
| --- | --- |
| Quick | `npm test -- src/features/atividades/activity-service.test.ts` |
| Full | `npm test && npm run test:e2e` |
| Build | `npm run db:validate && npm run typecheck && npm run lint && npm run build && npm test` |

## Execution Plan

### Phase 1: Domain and persistence

`T1 → T2 → T3`

### Phase 2: User-facing vertical slice

`T3 → T4 → T5`

### Phase 3: Final quality and documentation

`T5 → T6`

## Task Breakdown

### T1: Add shared activity and subtask persistence

**What**: Add Prisma models, enums, indexes and an additive migration.
**Where**: `prisma/schema.prisma`, `prisma/migrations/20260820180000_add_shared_activities/migration.sql`
**Depends on**: None
**Requirement**: ACT-01, ACT-04, ACT-05
**Done when**:

- [x] Fresh migration creates activity and subtask tables with the three buckets.
- [x] Activity deletion cascades to subtasks at the database boundary.
- [x] Existing migrations remain unchanged.

**Tests**: integration/reset
**Gate**: Build
**Commit**: `feat(atividades): add shared activity persistence`

### T2: Implement activity and subtask service rules

**What**: Implement active-account authorization, activity bucket CRUD and subtask CRUD with audit records.
**Where**: `src/features/atividades/activity-service.ts`, `src/features/atividades/activity-service.integration.test.ts`
**Depends on**: T1
**Requirement**: ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07
**Done when**:

- [x] Tests first prove create/list/filter, invalid input and inactive-account rejection.
- [x] Tests prove subtask create, update title/completion and delete while preserving the parent.
- [x] Tests prove confirmed service deletion removes the activity and all subtasks and records audit evidence.

**Tests**: integration
**Gate**: Quick, then Full after T5
**Commit**: `feat(atividades): add shared activity service`

### T3: Add server actions and protected activities route

**What**: Expose typed server actions and the authenticated `/atividades` page with a discreet bucket selector.
**Where**: `src/app/(dashboard)/atividades/actions.ts`, `src/app/(dashboard)/atividades/page.tsx`
**Depends on**: T2
**Requirement**: ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-07
**Done when**:

- [x] All actions resolve an active session before calling the service.
- [x] Invalid action input returns a contextual error without partial writes.
- [x] The page accepts valid bucket query values and defaults safely for invalid values.

**Tests**: typecheck + integration coverage
**Gate**: Build
**Commit**: `feat(atividades): expose activity actions and page`

### T4: Build activity and subtask interactions

**What**: Add forms/cards for creation, bucket update, subtask CRUD and confirmed activity deletion, plus the compact app-shell entry point.
**Where**: `src/app/(dashboard)/atividades/activity-board.tsx`, `src/components/layout/app-shell.tsx`
**Depends on**: T3
**Requirement**: ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06
**Done when**:

- [x] User can create activities in all three buckets.
- [x] User can create, edit/complete and delete subtasks.
- [x] User must confirm before activity deletion.
- [x] The selector is accessible despite being visually secondary.

**Tests**: E2E
**Gate**: Full
**Commit**: `feat(atividades): add shared activity interactions`

### T5: Add E2E regression coverage

**What**: Cover the complete user journey and the cancelled-delete branch.
**Where**: `e2e/activities.spec.ts`
**Depends on**: T4
**Requirement**: ACT-01 through ACT-07
**Done when**:

- [x] E2E proves all buckets and the `Amanhã` filter.
- [x] E2E proves subtask CRUD and parent preservation after subtask deletion.
- [x] E2E proves cancelled deletion keeps activity/subtasks and confirmed deletion removes them.

**Tests**: E2E
**Gate**: Full
**Commit**: `test(atividades): cover shared activity journeys`

### T6: Final gates, verifier and traceability

**What**: Run the complete build/test gates, update spec status and record an independent validation report.
**Where**: `.specs/features/emaus-activities/spec.md`, `.specs/features/emaus-activities/tasks.md`, `.specs/features/emaus-activities/validation.md`, `.specs/STATE.md`
**Depends on**: T5
**Requirement**: ACT-01 through ACT-07
**Done when**:

- [ ] Full gates pass without reducing the pre-feature test count.
- [ ] Independent verifier confirms spec-anchored coverage and kills targeted mutants.
- [ ] Feature status and traceability are updated to Verified.

**Tests**: full gate + independent verifier
**Gate**: Build
**Commit**: `docs(atividades): record feature validation`

## Requirement Mapping

| Requirement | Task(s) |
| --- | --- |
| ACT-01 | T1, T2, T3, T4, T5 |
| ACT-02 | T2, T3, T4, T5 |
| ACT-03 | T2, T3, T4, T5 |
| ACT-04 | T1, T2, T3, T4, T5 |
| ACT-05 | T1, T2, T3, T4, T5 |
| ACT-06 | T2, T4, T5 |
| ACT-07 | T2, T3, T5 |
