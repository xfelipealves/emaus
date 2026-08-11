# Emaús MVP Validation

**Date**: 2026-08-11  
**Spec**: `.specs/features/emaus-mvp/spec.md`  
**Diff range**: `3ef7b0b..ca42cb2` (M8 validation work, including correction tasks)  
**Verifier**: standalone fresh-eyes Codex pass; no external runner or sub-agent was used, and the validation pass re-read the spec and evidence independently of implementation.

## Verdict

**PASS ✅** — all 31 acceptance criteria have spec-anchored evidence, the required gates pass, all three behavior-level sensor mutants were killed, and the automated UAT journeys pass. No unresolved P1 gap remains.

## Gate evidence

The local `.env` was exported before Vitest so `DATABASE_URL` is available to the child process; Prisma itself also loads `.env`.

| Gate | Command | Result |
| --- | --- | --- |
| Full | `npm run test:integration && npm run test:e2e` | ✅ 31 files / 103 tests; 27 / 27 Playwright tests |
| Build | `npm run db:validate && npm run typecheck && npm run lint && npm run build && npm run test` | ✅ schema, typecheck, build and 31 files / 103 Vitest tests passed; lint has one existing non-blocking `no-img-element` warning at `src/app/(dashboard)/pessoas/[personId]/page.tsx:59` |
| Diff hygiene | `git diff --check` | ✅ passed before each implementation/bookkeeping commit |

**Test integrity**: M8 started with T35 evidence of 100 integration tests and 24 E2E tests; it ends with 103 and 27 respectively. Diff review found additions and strengthened assertions only—no deleted test and no relaxed behavioral assertion. T46 replaced a stale hard-coded age with the exact current Brazil-calendar value and retained the exact rendered birth date; its 30-second timeout keeps the same protected URL assertion while handling documented local cold start.

## Task completion

| Task | Status | Evidence |
| --- | --- | --- |
| T34 | ✅ Done | Idempotent demo scenario committed in `7d8e0b4` |
| T35 | ✅ Done | Critical isolated Playwright suite, recorded in `9156947` |
| T37–T47 | ✅ Done | All correction tasks have atomic implementation commits, Full gate and adequacy review recorded in `tasks.md` |
| T36 | ✅ PASS | This report, gates, sensor and automated UAT; final state is recorded by the following bookkeeping commit |

## Spec-anchored acceptance criteria (evidence-or-zero)

| ID | Spec-defined outcome | Evidence (`file:line` + asserted outcome) | Result |
| --- | --- | --- | --- |
| AUTH-01.1 | Valid active credentials create a secure session and reach protected area | `e2e/auth.spec.ts:65-72` — URL `/` and dashboard heading; `src/features/auth/session-service.integration.test.ts:59-74` — HttpOnly session cookie and `ACTIVE` account | ✅ PASS |
| AUTH-01.2 | Inactive account is denied and creates no session | `src/features/auth/session-service.integration.test.ts:86-90` — rejects inactive account and count is `0`; `e2e/auth.spec.ts:57-62` — login remains `/login` with generic error | ✅ PASS |
| AUTH-01.3 | Existing Person, unique username/e-mail and role are required for account creation | `src/features/auth/account-service.integration.test.ts:49-84` — duplicate username, case-normalized duplicate e-mail and `0` extra accounts; `e2e/auth.spec.ts:33-50` — administrator creates account in UI | ✅ PASS |
| AUTH-01.4 | Server enforces role and ministry scope | `src/server/authorization.test.ts:30-52` — secretary/leader permissions; `e2e/permissions.spec.ts:16-39` — granted scope visible, out-of-scope `404`, settings boundary | ✅ PASS |
| AUTH-01.5 | Deactivation preserves history and blocks new login | `e2e/auth.spec.ts:51-62` — deactivated status, preserved Person and denied login; `src/features/auth/account-service.integration.test.ts:61-80` — account/Person retained | ✅ PASS |
| PES-01.1 | Visitor needs only full name, gets `VISITOR`, and gains timeline event | `src/features/pessoas/person-actions.integration.test.ts:32-40` — name-only `VISITOR`; `e2e/people.spec.ts:26-33` — persisted profile/status and registration confirmation | ✅ PASS |
| PES-01.2 | Promotion requires phone and birth date, allows effective date and preserves prior history | `src/features/pessoas/status-service.integration.test.ts:34-56,59-75` — `MEMBER`, effective date, timeline/audit and required-field rejection; `e2e/people.spec.ts:41-49` — UI status/contact/age | ✅ PASS |
| PES-01.3 | Inactivation preserves profile, memberships, attendance and timeline without deletion | `e2e/people.spec.ts:71-84` — `INACTIVE`, membership/attendance retained, 3 timeline events and audit; `src/features/pessoas/status-service.integration.test.ts:77-100` — same persisted invariant | ✅ PASS |
| PES-01.4 | Age is calculated when birth date exists and absent otherwise | `src/lib/dates.test.ts:11-19` — exact birthday boundary and `null`; `e2e/people-profile.spec.ts:77-82` — exact birth date plus current calculated age | ✅ PASS |
| PES-01.5 | Create/update returns to profile with discreet confirmation | `e2e/people-registration.spec.ts:49-53,67-77` — profile URL and exact `Pessoa cadastrada com sucesso.` for visitor/member; `e2e/people.spec.ts:41-42,71-72` — promotion/inactivation confirmations | ✅ PASS |
| MIN-01.1 | Administrator can create/edit/archive and action is audited | `e2e/ministries.spec.ts:43-66` — UI create/edit/archive; `src/features/ministerios/ministry-service.integration.test.ts:75-86` — `CREATE`, `UPDATE`, `ARCHIVE`, before/after | ✅ PASS |
| MIN-01.2 | Archived ministry keeps history and blocks new membership/attendance operations | `src/features/ministerios/ministry-service.integration.test.ts:60-72` — membership history retained and `Ministério arquivado` rejection; `src/features/encontros/attendance-service.integration.test.ts:63-69` — incompatible cancelled-meeting attendance operation rejects without changing state | ✅ PASS |
| MIN-01.3 | Membership stores entry, leader/member role and editable effective date | `src/features/ministerios/membership-service.integration.test.ts:54-74` — two memberships, roles and exact start dates | ✅ PASS |
| MIN-01.4 | Ending membership preserves record and creates timeline history | `src/features/ministerios/membership-service.integration.test.ts:89-99` — persisted `endDate`, timeline and audit before/after | ✅ PASS |
| MIN-01.5 | Scoped leader sees only authorized current/historic participants | `e2e/ministries.spec.ts:69-96` — current + historic participants and other ministry absent; `e2e/permissions.spec.ts:16-26` — out-of-scope Person is `404` | ✅ PASS |
| ENC-01.1 | Weekly/biweekly/monthly selected weekdays, optional end and independent occurrences | `src/features/encontros/series-service.test.ts:5-33` — exact recurrence dates; `src/features/encontros/category-series.integration.test.ts:45-61` — independent, idempotent occurrences | ✅ PASS |
| ENC-01.2 | Meeting supports whole-church or selected ministries and draft/scheduled/cancelled states | `src/features/encontros/meeting-service.integration.test.ts:50-64` — audience variants and persisted `CANCELLED`; `e2e/meetings.spec.ts:41-57` — selected audience, scheduled date/status UI | ✅ PASS |
| ENC-01.3 | Opening attendance uses current eligibility and creates `NOT_CONFIRMED` idempotently | `src/features/encontros/attendance-service.integration.test.ts:72-81` — one current eligible record, `NOT_CONFIRMED`, no duplication | ✅ PASS |
| ENC-01.4 | Touch cycles not-confirmed → present → absent → not-confirmed, persists immediately and gives feedback | `e2e/attendance.spec.ts:21-41` — all labels, `Presença salva.` and persisted `PRESENT`; `src/features/encontros/attendance-service.integration.test.ts:52-60` — domain cycle | ✅ PASS |
| ENC-01.5 | Search/add Person and quick visitor work without leaving attendance flow | `e2e/attendance.spec.ts:102-121` — added Person, quick visitor and exact summary | ✅ PASS |
| ENC-01.6 | Attendance correction records before/after, author, time and optional reason; timeline updates | `src/features/encontros/attendance-service.integration.test.ts:52-60` — actor, `PRESENT`→`ABSENT`, reason and timeline; `e2e/audit.spec.ts:49-54` — rendered audit values | ✅ PASS |
| TIM-01.1 | Profile shows essential data, status, age, ministries, attendance and newest-first timeline | `e2e/people-profile.spec.ts:77-89` — exact profile fields/frequency; `src/features/timeline/timeline-query.integration.test.ts:49-60` — newest-first event order | ✅ PASS |
| TIM-01.2 | Registration/status/membership/attendance/correction/note events are queryable by type | `src/features/timeline/timeline-query.integration.test.ts:30-38,62-74` — seeded categories and exact per-category filter; `e2e/people-profile.spec.ts:99-112` — UI filtering | ✅ PASS |
| TIM-01.3 | Notes retain author, dates and complete edit versions | `src/features/timeline/note-service.integration.test.ts:34-65` — author, timeline/audit and two complete versions; `e2e/people-profile.spec.ts:115-129` — UI versions count `2` | ✅ PASS |
| TIM-01.4 | Archived notes are hidden by default and shown only by explicit filter | `src/features/timeline/note-service.integration.test.ts:67-82` — default absence/archived presence and versions retained; `e2e/people-profile.spec.ts:132-148` — UI default/filter behavior | ✅ PASS |
| TIM-01.5 | Unauthorized profile, notes and timeline are denied before exposure | `e2e/people-profile.spec.ts:92-96` — leader gets `404`; `src/features/timeline/timeline-query.integration.test.ts:85-97` — unauthorized timeline is empty | ✅ PASS |
| AUD-01.1 | Sensitive action stores actor, timestamp, entity/action and before/after where applicable | `src/features/auditoria/audit-query.integration.test.ts:55-69` — actor, target, action, before/after, reason, `Date`; `e2e/audit.spec.ts:49-54` — rendered audit record | ✅ PASS |
| AUD-01.2 | Failed autosave restores previous UI, gives contextual error and offers retry | `e2e/attendance.spec.ts:73-85` — `Não confirmado`, exact cancelled error, `Tentar novamente`, then `Presente`; `attendance-board.tsx:43-51` restores/retries state | ✅ PASS |
| AUD-01.3 | Inactivate/archive/cancel/deactivate require explicit confirmation | `e2e/people.spec.ts:68-72`, `e2e/ministries.spec.ts:60-66`, `e2e/auth.spec.ts:51-55`, `e2e/meetings.spec.ts:60-83` — confirmations cover all four actions, including dismissal without persistence | ✅ PASS |
| AUD-01.4 | Registration and attendance remain usable on desktop and mobile | `e2e/shell.spec.ts:31-48` — desktop navigation and mobile bottom navigation; `e2e/people-registration.spec.ts:44-77` and `e2e/attendance.spec.ts:7-121` — critical operational flows | ✅ PASS |
| AUD-01.5 | Business dates/times are parsed, persisted and displayed in `America/Sao_Paulo` | `src/lib/dates.test.ts:22-31` — date-only and `19:00` São Paulo → `22:00Z`; `e2e/meetings.spec.ts:52-57` and `e2e/people-registration.spec.ts:71-77` — rendered local dates | ✅ PASS |

**Status**: **31/31 PASS**, 0 evidence-or-zero gaps, 0 spec-precision gaps.

## Edge cases

| Edge case | Evidence | Result |
| --- | --- | --- |
| Promotion missing phone/birth date | `src/features/pessoas/status-service.integration.test.ts:59-75` exact required-field errors | ✅ PASS |
| Duplicate name allowed | `src/features/pessoas/person-actions.integration.test.ts:32-40` has no uniqueness rule; schema/service constraints target account identifiers, not Person name | ✅ PASS |
| Leader without current/historic granted scope | `e2e/permissions.spec.ts:16-26`; `e2e/people-profile.spec.ts:92-96` | ✅ PASS |
| Attendance persistence failure | `e2e/attendance.spec.ts:59-85` exact rollback/error/retry | ✅ PASS |
| Cancelled series occurrence remains consultable and rejects attendance | `src/features/encontros/meeting-service.integration.test.ts:58-64`; `src/features/encontros/attendance-service.integration.test.ts:63-69` | ✅ PASS |
| Deactivated account preserves references | `e2e/auth.spec.ts:51-62`; `src/features/auth/account-service.integration.test.ts:61-80` | ✅ PASS |

## Discrimination sensor

Scratch worktree: `/tmp/emaus-t36-sensor-final-iFpTY0` (removed after execution). Sensor depth: lightweight behavior-level, focused on the highest-risk M8 corrections.

| Mutation | File:line | Targeted test | Killed? |
| --- | --- | --- | --- |
| Replace `setRetryRowId(row.id)` with `setRetryRowId(null)` | `src/app/(dashboard)/encontros/[meetingId]/attendance-board.tsx:45` | `e2e/attendance.spec.ts:79` fails because `Tentar novamente` is absent | ✅ Killed |
| Replace `Pessoa cadastrada com sucesso.` with `Pessoa cadastrada.` | `src/app/(dashboard)/pessoas/[personId]/page.tsx:39` | `e2e/people-registration.spec.ts:51` fails exact status text | ✅ Killed |
| Invert the cancellation dismissal guard | `src/app/(dashboard)/encontros/meeting-forms.tsx:14` | `e2e/meetings.spec.ts:78` poll finds persisted `CANCELLED` meeting after dismissal | ✅ Killed |

**Result**: **3/3 killed, 0 survived — PASS ✅**.

## Adequacy and quality review

| Check | Result |
| --- | --- |
| Scope and abstractions | ✅ M8 changes are narrow, use existing Next/Prisma/Playwright patterns, and add no unrelated capability |
| AC mapping and assertion depth | ✅ each criterion maps to an exact UI, persistence, authorization or domain assertion above; spot-checks include attendance rollback, cancellation dismissal and timeline history |
| Layer coverage | ✅ domain/integration coverage for rules and persistence; E2E coverage for protected, destructive and responsive workflows |
| Test ownership | ✅ every in-scope test maps to an AC, edge case or T34–T46 done criterion |
| Project guidance | ✅ `.claude/napkin.md` followed: isolated synthetic database reset and serial Playwright worker; no repository test was removed or weakened |
| Senior-review judgement | ✅ PASS; the only lint item is a pre-existing warning, not an error |

## UAT

Interactive human UAT was not requested because execution was explicitly autonomous and must not pause. The following automated UAT substitute ran against the local browser and database:

| # | Journey | Result | Observable outcome |
| --- | --- | --- | --- |
| 1 | Desktop shell | ✅ Pass | Primary areas visible and active navigation asserted in `e2e/shell.spec.ts:31-36` |
| 2 | Mobile shell | ✅ Pass | Operational bottom navigation and `Mais` settings route asserted in `e2e/shell.spec.ts:39-48` |
| 3 | Register, promote and inactivate Person | ✅ Pass | Profile confirmations, preserved history, timeline and audit asserted in `e2e/people.spec.ts:26-84` |
| 4 | Create/cancel meeting and launch/retry attendance | ✅ Pass | Confirmation dismissal/acceptance and attendance recovery asserted in `e2e/meetings.spec.ts:60-83` and `e2e/attendance.spec.ts:59-85` |

## Revalidation history and lessons signal

The maximum of three fix→re-verify cycles was respected: (1) T37 fixed the initial lint/build failure; (2) T38–T42 closed lifecycle, history, cold-start, timezone and retry gaps; (3) T43–T47 closed registration confirmation, cancellation confirmation/sensor evidence, calendar-relative profile evidence and explicit account-identifier coverage. The final gates and final sensor above are green; no fourth cycle was opened.

Grounded execution signals from those cycles are distilled through `lessons.py` immediately after this report: lint/build navigation, cold-start waits, exact registration confirmation, destructive-action confirmation, and asynchronous dismissal persistence evidence.
