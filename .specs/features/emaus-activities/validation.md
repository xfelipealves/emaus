# Atividades compartilhadas — validation

**Status**: Verified  
**Date**: 2026-08-20  
**Branch**: `feat/emaus-shared-activities`

## Scope validated

- Shared activities visible and editable by active accounts.
- Buckets `TOMORROW`, `BACKLOG` and `PARKED`, including the `Amanhã` and `Estacionado` filters.
- Activity creation, bucket update and confirmed permanent deletion.
- Subtask create, read, title update, completion toggle and deletion without deleting the parent.
- Database cascade from activity to subtasks and audit evidence for destructive operations.

## Final gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Prisma schema | PASS | `npm run db:validate` |
| Prisma client | PASS | `npm run db:generate` |
| TypeScript | PASS | `npm run typecheck` |
| Lint | PASS with one pre-existing warning | Warning is the existing `<img>` rule in `src/app/(dashboard)/pessoas/[personId]/page.tsx`; no warning comes from this feature |
| Production build | PASS | `npm run build` |
| Integration/unit suite | PASS | 32 Vitest files, 114 tests |
| Browser suite | PASS | 29 Playwright scenarios, including `e2e/activities.spec.ts` |
| Fresh migration chain | PASS | Playwright global setup reset and applied all 7 migrations, including `20260820180000_add_shared_activities` |

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| ACT-01 | Prisma `Activity`/`ActivityBucket`, service CRUD, shared-user integration test and activity board |
| ACT-02 | Bucket validation, update service/action and all three bucket creation/filter E2E coverage |
| ACT-03 | `TOMORROW` query mapping and explicit `Amanhã` filter E2E |
| ACT-04 | `ActivitySubtask`, service/actions and subtask CRUD E2E |
| ACT-05 | Confirmation dialog, hard delete action and cancelled/confirmed delete E2E |
| ACT-06 | Foreign-key cascade migration plus parent-preservation/cascade integration assertions |
| ACT-07 | Active-account guard on every service operation, contextual action errors and audit events |

## Independent review

An Orca worker performed a read-only review in `run_20c4928653c2`, dispatch `ctx_f7e6e5c3b8df`, and returned `worker_done` with outcome `succeeded`. It inspected the spec, design, tasks, schema, service, actions, page, board, shell and tests without modifying files. The review initially identified missing assertions for inactive mutations, `PARKED`, `completed=false` and invalid subtask input; those cases were added in `1e12ec1` and the complete gates were rerun successfully.

The worker could not independently connect to the temporary database from its isolated terminal, so its own integration/E2E attempts were not used as the final evidence. The coordinator ran those final gates against the temporary database and recorded the passing results above.

## Non-blocking notes

- The existing lint warning in the Person profile page remains outside this feature.
- Entity links, civil dates, recurrence, assignment, comments and notifications remain explicitly out of scope.
