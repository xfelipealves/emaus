# Emaús MVP Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not execute more than one task per commit. Every task must pass its gate before being marked done. After all tasks, run a fresh Verifier and write `validation.md`.

**Design**: `.specs/features/emaus-mvp/design.md`  
**Status**: Approved

---

## Test Coverage Matrix

> No application or test configuration exists yet. The commands below are planned conventions and become real in T01; do not begin T02 until they exist and run.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain/service/authorization | unit (Vitest) | Every acceptance criterion and relevant failure branch | `src/**/*.test.ts` | `npm run test` |
| Server Actions / integration | integration (Vitest) | Happy path, validation, permission and transaction failure | `src/**/*.integration.test.ts` | `npm run test:integration` |
| User-critical flows | E2E (Playwright) | Login, Person lifecycle, leader restriction, attendance cycle | `e2e/**/*.spec.ts` | `npm run test:e2e` |
| Prisma schema/config | build gate | Prisma validation, typecheck and lint | `prisma/**`, config files | `npm run db:validate && npm run typecheck && npm run lint` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Domain/UI task with unit tests | `npm run test` |
| Full | Action, database or E2E task | `npm run test:integration && npm run test:e2e` |
| Build (foundation) | T01–T02, before Prisma exists | `npm run typecheck && npm run lint && npm run build && npm run test` |
| Build | At end of every milestone | `npm run db:validate && npm run typecheck && npm run lint && npm run build && npm run test` |

---

## Execution Plan

```text
M1 Foundation:       T01 → T02 → T03 → T04 → T05
M2 Data/bootstrap:   T06 → T07 → T08 → T09 → T10
M3 Auth/access:      T11 → T12 → T13 → T14 → T15
M4 People:           T16 → T17 → T18 → T19 → T20
M5 Ministries:       T21 → T22 → T23 → T24
M6 Meetings:         T25 → T26 → T27 → T28 → T29
M7 History/audit:    T30 → T31 → T32 → T33
M8 Validation:       T34 → T35 → T36 → T37 → T38 → T39 → T40 → T41 (correction)
```

Phases are sequential. Within each milestone, tasks are sequential unless their `Depends on` field says otherwise.

---

## Task Breakdown

### M1 — Foundation local

### T01: Bootstrap the Next.js application and quality scripts

**What**: Create the TypeScript Next.js application with Tailwind, lint, typecheck, Vitest and Playwright scripts.
**Where**: `package.json`, `src/app/`, `vitest.config.ts`, `playwright.config.ts`, `e2e/`
**Depends on**: None
**Requirement**: AUD-01
**Done when**:
- [ ] `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run test:e2e` and `npm run build` are defined.
- [ ] A minimal Vitest and Playwright smoke test pass.
- [ ] No visual library is installed.
**Tests**: unit + E2E smoke
**Gate**: Build (foundation)
**Commit**: `chore: bootstrap Emaus application`

### T02: Add local PostgreSQL runtime and environment contract

**What**: Add Docker Compose PostgreSQL and safe environment examples.
**Where**: `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`
**Depends on**: T01
**Requirement**: AUD-01
**Done when**:
- [ ] `docker compose up -d` starts PostgreSQL.
- [ ] `.env.example` documents no secret values.
- [ ] Database URL is consumed only through environment configuration.
**Tests**: none (configuration)
**Gate**: Build (foundation)
**Commit**: `chore: add local PostgreSQL environment`

### T03: Configure Prisma client and migration workflow

**What**: Install Prisma, create client singleton and database validation scripts.
**Where**: `prisma/schema.prisma`, `src/lib/prisma.ts`, `package.json`
**Depends on**: T02
**Requirement**: AUD-01
**Done when**:
- [ ] Prisma validates against local PostgreSQL.
- [ ] Client singleton avoids duplicate clients in development.
- [ ] `npm run db:validate` runs Prisma validation.
**Tests**: none (schema/config)
**Gate**: Build
**Commit**: `chore: configure Prisma workflow`

### T04: Establish application shell and responsive navigation

**What**: Build the authenticated layout shell, desktop sidebar and mobile bottom navigation from approved wireframes.
**Where**: `src/app/(dashboard)/layout.tsx`, `src/components/layout/`
**Depends on**: T01
**Requirement**: AUD-01
**Done when**:
- [x] Desktop exposes Início, Pessoas, Ministérios, Encontros and Configurações.
- [x] Mobile exposes Início, Pessoas, Ministérios and Encontros; Configurações is under Mais.
- [x] Navigation has accessible labels and active state.
**Tests**: E2E smoke
**Gate**: Full
**Commit**: `feat: add responsive application shell`

### T05: Add shared UI primitives and feedback states

**What**: Create reusable button, input, dialog, empty state, toast and error presentation primitives.
**Where**: `src/components/ui/`
**Depends on**: T01
**Requirement**: AUD-01
**Done when**:
- [x] Components use Tailwind and no external visual library.
- [x] Dialog supports explicit confirm/cancel actions.
- [x] Empty state contains one primary action.
**Tests**: unit
**Gate**: Quick
**Commit**: `feat: add Emaus UI primitives`

### M2 — Persistent model and bootstrap

### T06: Model Person, Account and role enums in Prisma

**What**: Add Person, Account, role/status enums and unique constraints.
**Where**: `prisma/schema.prisma`, migration
**Depends on**: T03
**Requirement**: AUTH-01, PES-01
**Done when**:
- [x] Account has unique username, unique e-mail and unique `personId`.
- [x] Person status supports visitor, member and inactive.
- [x] No age column exists.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add people and account schema`

### T07: Model Ministry, memberships and leader scopes

**What**: Add Ministry, MinistryMembership and AccountMinistryAccess relations.
**Where**: `prisma/schema.prisma`, migration
**Depends on**: T06
**Requirement**: MIN-01, MIN-02, AUTH-02
**Done when**:
- [x] Membership stores role, start date and optional end date.
- [x] Account scope is independent from membership role.
- [x] Archived Ministry state is represented.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add ministry schema`

### T08: Model meetings, series, audiences and attendance

**What**: Add Category, MeetingSeries, Meeting, MeetingAudience and Attendance schema.
**Where**: `prisma/schema.prisma`, migration
**Depends on**: T07
**Requirement**: ENC-01
**Done when**:
- [x] Series supports weekly, biweekly and monthly recurrence plus optional end date.
- [x] Attendance is unique for meeting/person and supports three states.
- [x] Meeting supports draft, scheduled and cancelled states.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add meetings and attendance schema`

### T09: Model notes, timeline and audit records

**What**: Add Note, NoteVersion, TimelineEvent and AuditEvent schema.
**Where**: `prisma/schema.prisma`, migration
**Depends on**: T08
**Requirement**: TIM-01, AUD-01
**Done when**:
- [x] NoteVersion preserves author, content and sequence.
- [x] Audit can store actor, target, action and before/after values.
- [x] Timeline supports category and timestamp sorting.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add history and audit schema`

### T10: Create seed data and Brazil timezone utilities

**What**: Seed one development administrator and create date/age utilities using America/Sao_Paulo.
**Where**: `prisma/seed.ts`, `src/lib/dates.ts`, `src/lib/dates.test.ts`
**Depends on**: T09
**Requirement**: PES-02, AUD-01
**Done when**:
- [x] Seed creates a Person plus linked administrator Account.
- [x] Age changes correctly on birthday boundary.
- [x] Application utilities use America/Sao_Paulo.
**Tests**: unit + integration
**Gate**: Full
**Commit**: `feat: add development seed and date utilities`

### M3 — Authentication and access

### T11: Implement password hashing and credential validation

**What**: Add Argon2 hash/verify functions and login input validation.
**Where**: `src/features/auth/password.ts`, `src/features/auth/password.test.ts`, `src/lib/validations/auth.ts`
**Depends on**: T10
**Requirement**: AUTH-01
**Done when**:
- [x] Plain password is never returned or persisted.
- [x] Correct password verifies and wrong password fails.
- [x] Login input rejects blank fields.
**Tests**: unit
**Gate**: Quick
**Commit**: `feat: add password authentication primitives`

### T12: Implement session creation, lookup and logout

**What**: Add secure session persistence and cookie helpers.
**Where**: `src/lib/session.ts`, `src/features/auth/session-service.ts`
**Depends on**: T11
**Requirement**: AUTH-01
**Done when**:
- [x] Active account receives secure session cookie.
- [x] Logout invalidates session.
- [x] Inactive account cannot create session.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add secure account sessions`

### T13: Implement login page and protected dashboard redirect

**What**: Add login UI and route guard.
**Where**: `src/app/(auth)/login/`, `src/app/(dashboard)/layout.tsx`
**Depends on**: T12, T04
**Requirement**: AUTH-01
**Done when**:
- [x] Unauthenticated dashboard request redirects to login.
- [x] Valid credentials reach home.
- [x] Invalid credentials show generic feedback.
**Tests**: E2E
**Gate**: Full
**Commit**: `feat: add login flow`

### T14: Implement server-side role and ministry authorization

**What**: Centralize authorization predicates for admin, secretary and leader.
**Where**: `src/server/authorization.ts`, `src/server/authorization.test.ts`
**Depends on**: T12
**Requirement**: AUTH-02
**Done when**:
- [x] Secretary cannot manage ministries/accounts.
- [x] Leader is restricted to explicit scopes.
- [x] Administrator has full MVP access.
**Tests**: unit
**Gate**: Quick
**Commit**: `feat: add role and ministry authorization`

### T15: Implement administrator account management

**What**: Add create/deactivate account action and settings list.
**Where**: `src/features/auth/account-service.ts`, `src/app/(dashboard)/configuracoes/usuarios/`
**Depends on**: T14, T05
**Requirement**: AUTH-01, AUTH-02
**Done when**:
- [x] Admin creates account only for existing Person.
- [x] Admin can deactivate account without deleting history.
- [x] Non-admin action is denied server-side.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add account administration`

### M4 — People

### T16: Implement Person service and timeline event helper

**What**: Add transactional Person write service that emits timeline/audit events.
**Where**: `src/features/pessoas/person-service.ts`, `src/server/audit.ts`, `src/server/transaction.ts`
**Depends on**: T10, T14
**Requirement**: PES-01, AUD-01
**Done when**:
- [x] Service requires authorized actor.
- [x] Person mutation, timeline and audit share one transaction.
- [x] Failed transaction leaves no partial event.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add transactional person service`

### T17: Implement visitor and member registration actions

**What**: Create validated flows for quick visitor and direct member registration.
**Where**: `src/features/pessoas/person-actions.ts`, `src/app/(dashboard)/pessoas/nova/`
**Depends on**: T16
**Requirement**: PES-01
**Done when**:
- [x] Visitor requires only full name.
- [x] Member requires phone and birth date.
- [x] Successful creation opens new profile.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add person registration flows`

### T18: Implement promotion and inactivation transitions

**What**: Add status transition actions with effective date support.
**Where**: `src/features/pessoas/status-service.ts`, `src/features/pessoas/status-service.test.ts`
**Depends on**: T16
**Requirement**: PES-02
**Done when**:
- [x] Promotion rejects missing phone/birth date.
- [x] Effective date is editable.
- [x] Inactivation keeps Person and history queryable.
**Tests**: unit + integration
**Gate**: Full
**Commit**: `feat: add person status transitions`

### T19: Implement people list, search and status filters

**What**: Add server query and responsive People list UI.
**Where**: `src/features/pessoas/person-query.ts`, `src/app/(dashboard)/pessoas/`
**Depends on**: T17
**Requirement**: PES-01
**Done when**:
- [x] List filters all, visitors, members and inactive.
- [x] Search locates by name.
- [x] Age displays only when birth date exists.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add people list and search`

### T20: Implement person profile overview

**What**: Add person profile header and tabs for overview, timeline, ministries and frequency placeholders.
**Where**: `src/app/(dashboard)/pessoas/[personId]/`, `src/features/pessoas/person-query.ts`
**Depends on**: T18, T19
**Requirement**: PES-01, TIM-01
**Done when**:
- [x] Profile displays status, contact, birthday/age and actions allowed by role.
- [x] Missing photo uses initials.
- [x] Unauthorised leader is blocked.
**Tests**: E2E
**Gate**: Full
**Commit**: `feat: add person profile`

### M5 — Ministries and scopes

### T21: Implement ministry administration service and actions

**What**: Add create, edit and archive Ministry operations.
**Where**: `src/features/ministerios/ministry-service.ts`, `src/app/(dashboard)/ministerios/`
**Depends on**: T16
**Requirement**: MIN-01
**Done when**:
- [x] Only admin can mutate Ministry.
- [x] Archived Ministry rejects new memberships and attendance operations.
- [x] Mutations are audited.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add ministry administration`

### T22: Implement membership history service

**What**: Add entry, role change and end-membership actions.
**Where**: `src/features/ministerios/membership-service.ts`
**Depends on**: T21
**Requirement**: MIN-02
**Done when**:
- [x] One Person can hold multiple memberships.
- [x] Membership stores editable effective dates.
- [x] Start/end produces Person timeline event.
**Tests**: integration
**Gate**: Full
**Commit**: `feat: add ministry membership history`

### T23: Implement leader scope grants

**What**: Add explicit account-to-ministry access grants for leaders.
**Where**: `src/features/ministerios/access-scope-service.ts`, `src/server/authorization.ts`
**Depends on**: T22, T15
**Requirement**: AUTH-02, MIN-02
**Done when**:
- [x] Admin can grant/revoke scope.
- [x] Revocation blocks future access but preserves authorship.
- [x] Scope is not inferred from membership role.
**Tests**: unit + integration
**Gate**: Full
**Commit**: `feat: add leader ministry scopes`

### T24: Implement ministry profile and participant history UI

**What**: Add ministry summary, leaders, current participants, history and upcoming meeting sections.
**Where**: `src/app/(dashboard)/ministerios/[ministryId]/`
**Depends on**: T22
**Requirement**: MIN-01, MIN-02
**Done when**:
- [x] Profile follows approved wireframe information hierarchy.
- [x] Current and historic participants are distinguishable.
- [x] Leader only sees authorized Ministry.
**Tests**: E2E
**Gate**: Full
**Commit**: `feat: add ministry profile`

### M6 — Meetings and attendance

### T25: Implement category and meeting-series services

**What**: Add category management and recurrence generation.
**Where**: `src/features/encontros/category-service.ts`, `src/features/encontros/series-service.ts`
**Depends on**: T21
**Requirement**: ENC-01
**Done when**:
- [x] Admin manages categories.
- [x] Series supports weekly, biweekly and monthly patterns, weekday selection and optional end.
- [x] Each generated occurrence remains independently editable.
**Tests**: unit + integration
**Gate**: Full
**Commit**: `feat: add meeting categories and recurrence`

### T26: Implement meeting creation and audience selection

**What**: Add draft/scheduled/cancelled meeting service and audience selectors.
**Where**: `src/features/encontros/meeting-service.ts`, `src/app/(dashboard)/encontros/nova/`
**Depends on**: T25
**Requirement**: ENC-01
**Done when**:
- [x] Audience accepts whole church or selected Ministries.
- [x] Leader can create only within granted scope.
- [x] Cancelled meeting remains queryable and rejects new attendance writes.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add meeting creation and audiences`

### T27: Implement eligible attendee projection and initialization

**What**: Calculate current eligible people and create missing non-confirmed Attendance records idempotently.
**Where**: `src/features/encontros/attendance-service.ts`, `src/features/encontros/attendance-service.test.ts`
**Depends on**: T26
**Requirement**: ENC-01
**Done when**:
- [x] Current Ministry memberships determine eligibility.
- [x] Reopening attendance does not duplicate rows.
- [x] Every displayed person has an attendance record.
**Tests**: unit + integration
**Gate**: Full
**Commit**: `feat: initialize meeting attendance`

### T28: Implement one-tap attendance cycle and correction audit

**What**: Add immediate state cycle and transactional timeline/audit persistence.
**Where**: `src/features/encontros/attendance-service.ts`, `src/app/(dashboard)/encontros/[meetingId]/`
**Depends on**: T27, T05
**Requirement**: ENC-01, AUD-01
**Done when**:
- [x] Row cycles unknown → present → absent → unknown.
- [x] UI uses white/green/red feedback and rolls back display on server failure.
- [x] Audit stores before/after, actor, timestamp and optional reason for correction.
**Tests**: unit + integration + E2E
**Gate**: Full
**Commit**: `feat: add one-tap attendance`

### T29: Implement attendance search, quick visitor and summaries

**What**: Add attendee search, in-context visitor creation and meeting/ministry summaries.
**Where**: `src/features/encontros/attendance-query.ts`, `src/app/(dashboard)/encontros/[meetingId]/`
**Depends on**: T28, T17
**Requirement**: ENC-01
**Done when**:
- [x] Existing Person search works without leaving attendance.
- [x] Quick visitor requires only name and is immediately eligible.
- [x] Summary reflects each state.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: complete attendance operation`

### M7 — Timeline, notes and full audit

### T30: Implement timeline query, ordering and filters

**What**: Add timeline projection and category filters to the Person profile.
**Where**: `src/features/timeline/timeline-query.ts`, `src/app/(dashboard)/pessoas/[personId]/timeline/`
**Depends on**: T20, T22, T28
**Requirement**: TIM-01
**Done when**:
- [x] Events sort newest first.
- [x] Filters distinguish status, ministries, attendance, notes and corrections.
- [x] Filters change query only and never data.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add person timeline filters`

### T31: Implement note creation and versioned editing

**What**: Add plain-text notes and immutable versions.
**Where**: `src/features/timeline/note-service.ts`, `src/app/(dashboard)/pessoas/[personId]/`
**Depends on**: T30
**Requirement**: TIM-01
**Done when**:
- [x] Note stores author, creation and update timestamps.
- [x] Every edit creates ordered NoteVersion.
- [x] Creation/edit emits timeline and audit events.
**Tests**: unit + integration + E2E
**Gate**: Full
**Commit**: `feat: add versioned person notes`

### T32: Implement note archive and archived filter

**What**: Add archive action and explicit archived-note filter.
**Where**: `src/features/timeline/note-service.ts`, `src/app/(dashboard)/pessoas/[personId]/`
**Depends on**: T31
**Requirement**: TIM-01
**Done when**:
- [x] Archive never deletes note/version history.
- [x] Default timeline hides archived notes.
- [x] Filter reveals archived notes only to authorized profile viewer.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add note archiving`

### T33: Implement audit query for sensitive changes

**What**: Add administrator audit query with target, actor, action and before/after display.
**Where**: `src/features/auditoria/audit-query.ts`, `src/app/(dashboard)/configuracoes/auditoria/`
**Depends on**: T32
**Requirement**: AUD-01
**Done when**:
- [x] Admin sees sensitive actions specified by the spec.
- [x] Non-admin cannot access audit query.
- [x] Correction audit shows optional reason when present.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add audit history view`

### M8 — Local MVP validation

### T34: Create realistic demo seed scenario

**What**: Extend seed with demo people, memberships, accounts, meetings and attendance.
**Where**: `prisma/seed.ts`, `README.md`
**Depends on**: T33
**Requirement**: AUD-01
**Done when**:
- [x] Seed demonstrates each role and core feature.
- [x] README documents local reset/seed command.
- [x] No real personal data exists in seed.
**Tests**: integration
**Gate**: Full
**Commit**: `chore: add Emaus demo scenario`

**Verification**: `npm run test:integration -- --maxWorkers=1` — 100 passed; `npm run test:e2e -- --workers=1` — 21 passed. The default parallel E2E command remains subject to the pre-existing shared-fixture race documented in the handoff.

### T35: Complete critical-path Playwright suite

**What**: Add end-to-end coverage for P1 journeys.
**Where**: `e2e/auth.spec.ts`, `e2e/audit.spec.ts`, `e2e/people.spec.ts`, `e2e/attendance.spec.ts`, `e2e/permissions.spec.ts`, `e2e/demo-fixtures.ts`, `e2e/global-setup.ts`, `playwright.config.ts`, `vitest.config.ts`
**Depends on**: T34
**Requirement**: AUTH-01, PES-01, MIN-02, ENC-01, TIM-01, AUD-01
**Done when**:
- [x] Suite covers login/deactivation, Person lifecycle, leader restriction and attendance correction.
- [x] E2E uses isolated seeded/reset state.
- [x] All P1 acceptance criteria map to test evidence.
**Tests**: E2E
**Gate**: Full
**Commit**: `test: cover Emaus critical MVP journeys`

**Verification**: `npm run test:integration && npm run test:e2e` — integration 31 files/100 tests passed; E2E 24 tests passed. `workers: 1`, Vitest `fileParallelism: false` and Prisma reset/seed global setup isolate the shared local PostgreSQL fixtures. `npm run typecheck` and `git diff --check` passed. Adequacy review PASS: `e2e/auth.spec.ts:33-62` asserts account creation, deactivation, preserved Person and denied login; `e2e/people.spec.ts:24-84` asserts visitor→member→inactive UI plus persisted status, ministry, attendance, timeline and audit; `e2e/permissions.spec.ts:16-39` asserts leader scope and secretary/admin boundary; `e2e/attendance.spec.ts:21-43` asserts all three states, before/after/reason audit and timeline; existing full E2E tests remain green and audit locators are scoped to their own record.

### T36: Run TLC verifier and local UAT

**What**: Run independent verification, discrimination sensor and user-facing UAT against the spec.
**Where**: `.specs/features/emaus-mvp/validation.md`, `.specs/STATE.md`
**Depends on**: T35
**Requirement**: all requirements
**Done when**:
- [ ] Fresh verifier writes PASS/FAIL evidence for every requirement ID.
- [ ] Discrimination sensor results are recorded.
- [ ] Any gap becomes a new atomic task; no unresolved P1 gap is marked done.
**Tests**: full suite + UAT
**Gate**: Build
**Commit**: `docs: validate Emaus MVP locally`

### T37: Restore clean Build gate navigation

**What**: Correct internal navigation elements flagged by the T36 lint gate and remove the unused meeting-form import.
**Where**: `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/pessoas/nova/person-form.tsx`, `src/app/(dashboard)/encontros/page.tsx`, `e2e/shell.spec.ts`
**Depends on**: T36 validation gap
**Requirement**: AUD-01
**Done when**:
- [x] Dashboard shortcuts and Person-form cancel keep their destinations while using `next/link`.
- [x] The Encontros page has no unused `CreateMeetingForm` import.
- [x] Build gate passes without lint errors and the existing E2E suite remains green.
**Tests**: Build + E2E smoke
**Gate**: Build
**Commit**: `fix: restore clean navigation lint gate`

**Verification**: `npm run db:validate && npm run typecheck && npm run lint && npm run build && npm run test` passed: schema valid, typecheck/lint clean of errors, production build succeeded, 31 files/100 tests passed. `npm run test:e2e -- --workers=1 e2e/shell.spec.ts` passed 3/3. Adequacy review PASS: `e2e/shell.spec.ts:53-55` asserts `/pessoas` and both `/encontros` shortcut hrefs; `e2e/shell.spec.ts:58-59` asserts Cancelar navigates to `/pessoas`; lint is the precise static evidence for the `next/link` and unused-import criteria. No tests were deleted or weakened.

### T38: Expose Person status lifecycle in the profile

**What**: Add authorized profile actions to promote a visitor to member and inactivate a Person, including effective dates, validation feedback and explicit inactivation confirmation.
**Where**: `src/app/(dashboard)/pessoas/[personId]/actions.ts`, `src/app/(dashboard)/pessoas/[personId]/page.tsx`, `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx`, `e2e/people.spec.ts`
**Depends on**: T36 validation gap
**Requirement**: PES-02, AUD-01
**Done when**:
- [x] Authorized users can promote a visitor from the profile with phone, birth date and effective date.
- [x] Authorized users can inactivate a Person from the profile without deleting history.
- [x] Promotion/inactivation errors remain contextual and inactivation asks for explicit confirmation.
- [x] Browser evidence covers the complete visitor → member → inactive journey through the profile UI.
**Tests**: E2E
**Gate**: Full
**Commit**: `feat: expose person status lifecycle`

**Verification**: `npm run test:integration && npm run test:e2e` passed: 31 files/100 integration tests and 25/25 E2E tests. Adequacy review PASS: `e2e/people.spec.ts:36-48` submits promotion through labeled profile controls and asserts the redirect, confirmation, persisted member status, phone and exact effective timestamp; `e2e/people.spec.ts:67-87` accepts the explicit inactivation dialog and asserts confirmation, preserved memberships/attendance/timeline and exact `INACTIVE` audit action. `src/app/(dashboard)/pessoas/[personId]/actions.ts:13-25,44-46,64-66` provides server-side role/date validation and contextual error results; no tests were deleted or weakened.

### T39: Render Person attendance history in the profile

**What**: Query historical Attendance records with their meetings and render them in the Person profile with Brazil dates and explicit status labels.
**Where**: `src/features/pessoas/person-query.ts`, `src/app/(dashboard)/pessoas/[personId]/page.tsx`, `e2e/people-profile.spec.ts`
**Depends on**: T36 validation gap
**Requirement**: TIM-01
**Done when**:
- [x] Profile frequency section lists persisted meetings for the Person.
- [x] Each entry shows meeting, scheduled date and exact attendance status.
- [x] Empty history remains an intentional, readable state.
- [x] Browser evidence confirms a persisted attendance is visible in the profile.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: show person attendance history`

**Verification**: `npm run test:integration && npm run test:e2e` passed: 31 files/101 integration tests and 25/25 E2E tests. Adequacy review PASS: `src/features/pessoas/person-query.integration.test.ts:97-102` asserts the profile query returns meeting, scheduled timestamp and `PRESENT`; `e2e/people-profile.spec.ts:80-84` asserts the named frequency region renders meeting, Brazil date and status; `src/app/(dashboard)/pessoas/[personId]/page.tsx:92-106` preserves an explicit empty state. No existing test was deleted or weakened.

### T41: Normalize business date and time inputs to São Paulo

**What**: Parse date-only and `datetime-local` inputs as `America/Sao_Paulo`, and format persisted calendar dates without host-timezone drift.
**Where**: `src/lib/dates.ts`, `src/lib/dates.test.ts`, `src/app/(dashboard)/pessoas/nova/actions.ts`, `src/app/(dashboard)/encontros/actions.ts`, `src/app/(dashboard)/pessoas/page.tsx`, `src/app/(dashboard)/pessoas/[personId]/page.tsx`, `src/app/(dashboard)/ministerios/[ministryId]/page.tsx`, `src/features/encontros/series-service.ts`, `src/features/encontros/series-service.test.ts`, `e2e/people-registration.spec.ts`, `e2e/meetings.spec.ts`, `e2e/people-profile.spec.ts`
**Depends on**: T36 validation gap
**Requirement**: AUD-01, PES-01, ENC-01
**Done when**:
- [x] Date-only fields preserve the entered Brazil calendar date after persistence.
- [x] Meeting local date/time persists as the equivalent São Paulo instant independent of host timezone.
- [x] Date-only and instant display paths use the correct formatter for their data type.
- [x] Unit/integration/browser evidence asserts exact dates and timestamps.
**Tests**: unit + integration + E2E
**Gate**: Full
**Commit**: `fix: preserve Sao Paulo calendar inputs`

**Verification**: Unit date tests in `src/lib/dates.test.ts:23-31` assert date-only formatting and the exact `2026-09-10T19:00` → `2026-09-10T22:00:00.000Z` conversion; recurrence tests in `src/features/encontros/series-service.test.ts:6-47` assert calendar dates remain stable at noon UTC. Browser evidence in `e2e/people-registration.spec.ts:71-80` asserts the persisted birth date and profile rendering, `e2e/meetings.spec.ts:61-64` asserts the persisted São Paulo instant and agenda date, and `e2e/people-profile.spec.ts:68` asserts the date-only profile value. Adequacy review PASS: assertions cover persistence plus both date-only and instant display paths; no existing test was deleted or weakened.

### T40: Stabilize critical-path E2E cold-start waits

**What**: Give the audit login helper and Person registration navigation assertions the same cold-start tolerance as the other critical flows so the full gate does not fail on valid behavior during application compilation.
**Where**: `e2e/audit.spec.ts`, `e2e/people-registration.spec.ts`
**Depends on**: T39 Full gate failure
**Requirement**: AUTH-01, AUD-01
**Done when**:
- [x] Audit administrator and secretary login assertions tolerate the documented dev-server cold start.
- [x] Person registration navigation assertions tolerate the documented dev-server cold start.
- [x] The audit spec remains exact and passes in isolation.
- [x] The Full gate can be rerun without the observed login timeout.
**Tests**: E2E
**Gate**: Full
**Commit**: `test: stabilize audit e2e login`

**Verification**: `npm run test:integration && npm run test:e2e` passed: 31 files/100 integration tests and 25/25 E2E tests; `npm run test:e2e -- --workers=1 e2e/audit.spec.ts e2e/people-registration.spec.ts` passed 4/4. Adequacy review PASS: `e2e/audit.spec.ts:41` preserves the exact `/` destination while allowing only 30 seconds for cold start; `e2e/people-registration.spec.ts:49-50,66-67` preserves exact profile URL assertions with the same bounded wait. No behavior assertion was weakened and no test was deleted.

### T42: Provide an explicit attendance retry path after cancellation failure

**What**: Keep the optimistic attendance rollback visible when the server rejects a cancelled meeting, and expose a retry action that succeeds after the meeting becomes writable again.
**Where**: `src/app/(dashboard)/encontros/[meetingId]/attendance-board.tsx`, `e2e/attendance.spec.ts`
**Depends on**: T41
**Requirement**: AUD-01
**Done when**:
- [x] A failed attendance cycle restores the previous status and preserves the exact server feedback.
- [x] The board exposes an explicit retry action for the failed row.
- [x] A retry after the meeting is reopened persists the new attendance status and feedback.
- [x] Browser evidence covers the failure, rollback, retry and persistence sequence.
**Tests**: E2E
**Gate**: Full
**Commit**: `fix: add attendance retry feedback`

**Verification**: Full gate `npm run test:integration && npm run test:e2e` passed with 31 files/102 integration tests and 26/26 E2E tests. Adequacy review PASS: `src/app/(dashboard)/encontros/[meetingId]/attendance-board.tsx:33-57,88` restores the prior optimistic value, retains the exact server error and renders an explicit retry; `e2e/attendance.spec.ts:59-100` forces cancellation, asserts rollback/error/retry, reopens the meeting and asserts `PRESENT` in both UI and database. No existing test was deleted or weakened.

### T43: Confirm initial Person registration in the profile

**What**: Return a discreet success confirmation after creating a Person and render it in the destination profile without changing the existing registration flow.
**Where**: `src/app/(dashboard)/pessoas/nova/actions.ts`, `src/app/(dashboard)/pessoas/[personId]/page.tsx`, `e2e/people-registration.spec.ts`, `e2e/people.spec.ts`
**Depends on**: T42
**Requirement**: PES-01
**Done when**:
- [x] Initial visitor and member registrations redirect to the profile with a success status message.
- [x] The confirmation is exact, contextual and does not replace the persisted profile/status assertions.
- [x] Browser evidence covers both registration variants.
**Tests**: E2E
**Gate**: Full
**Commit**: `fix: confirm person registration`

**Verification**: Full gate `npm run test:integration && npm run test:e2e` passed with 31 files/102 integration tests and 26/26 E2E tests. Adequacy review PASS: `src/app/(dashboard)/pessoas/nova/actions.ts:51` redirects with `status=created`, `src/app/(dashboard)/pessoas/[personId]/page.tsx:29-37` renders the exact contextual message, and `e2e/people-registration.spec.ts:49-52,66-69` plus `e2e/people.spec.ts:27-30` assert visitor/member confirmation without dropping persistence or status checks. No existing test was deleted or weakened.

### T44: Confirm meeting cancellation before creation

**What**: Require explicit confirmation when a user submits a new meeting with the `CANCELLED` state, preventing creation on dismissal and preserving creation on acceptance.
**Where**: `src/app/(dashboard)/encontros/meeting-forms.tsx`, `e2e/meetings.spec.ts`
**Depends on**: T43
**Requirement**: AUD-01
**Done when**:
- [x] Submitting a cancelled meeting opens an explicit confirmation dialog.
- [x] Dismissing the dialog prevents creation and does not show a success result.
- [x] Accepting the dialog creates the cancelled meeting and preserves its status.
- [x] Browser evidence covers both dismissal and acceptance.
**Tests**: E2E
**Gate**: Full
**Commit**: `fix: confirm meeting cancellation`

**Verification**: Full gate `npm run test:integration && npm run test:e2e` passed with 31 files/102 integration tests and 27/27 E2E tests. Adequacy review PASS: `src/app/(dashboard)/encontros/meeting-forms.tsx:10-18` confirms only the `CANCELLED` path and prevents default on dismissal; `e2e/meetings.spec.ts:60-85` asserts the exact dialog text, no database row/success after dismissal, and persisted `CANCELLED` after acceptance. The 30-second success wait preserves the exact result while tolerating the documented dev-server cold start. No existing test was deleted or weakened.

### T45: Strengthen cancellation-dismissal evidence

**What**: Await the asynchronous outcome of a dismissed cancellation confirmation so the test fails if a cancelled meeting is accidentally created after dismissal.
**Where**: `e2e/meetings.spec.ts`
**Depends on**: T44
**Requirement**: AUD-01
**Done when**:
- [x] Dismissal evidence waits for the form to settle and polls persistence, rather than checking only the immediate state.
- [x] The test kills a mutation that bypasses the dismissal guard while preserving the exact acceptance assertions.
**Tests**: E2E
**Gate**: Full
**Commit**: `test: harden cancellation dismissal evidence`

**Verification**: Full gate `npm run test:integration && npm run test:e2e` passed with 31 files/102 integration tests and 27/27 E2E tests. Adequacy review PASS: `e2e/meetings.spec.ts:72-82` waits for the submit button to settle and polls the database for absence after dismissal, then preserves exact accepted-dialog/status assertions. The sensor mutation that inverted the confirmation guard failed this strengthened test; no existing behavior assertion was weakened or deleted.

---

## Phase Execution Map

```text
M1 Foundation → M2 Data → M3 Auth → M4 People → M5 Ministries → M6 Meetings → M7 History/Audit → M8 Validation
```

## Task Granularity Check

| Task range | Scope | Status |
| --- | --- | --- |
| T01–T05 | one setup concern or UI primitive layer per task | ✅ granular |
| T06–T10 | one cohesive schema/domain foundation per task | ✅ granular |
| T11–T33 | one service, action, query or page capability per task | ✅ granular |
| T34–T36 | one validation deliverable per task | ✅ granular |

## Diagram-Definition Cross-Check

| Milestone | Depends on | Map | Status |
| --- | --- | --- | --- |
| M1 | none | starts sequence | ✅ |
| M2 | M1 | M1 → M2 | ✅ |
| M3 | M2 | M2 → M3 | ✅ |
| M4 | M3 | M3 → M4 | ✅ |
| M5 | M4 | M4 → M5 | ✅ |
| M6 | M5 | M5 → M6 | ✅ |
| M7 | M6 | M6 → M7 | ✅ |
| M8 | M7 | M7 → M8 | ✅ |

## Test Co-location Validation

| Task range | Layer | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T01–T05 | config/UI | build, smoke/E2E where interactive | declared per task | ✅ |
| T06–T10 | schema/data | integration/build | integration or build | ✅ |
| T11–T15 | auth/authorization | unit, integration, E2E | declared per task | ✅ |
| T16–T33 | domain/actions/UI | unit/integration/E2E as applicable | declared per task | ✅ |
| T34–T36 | validation | full suite/E2E/UAT | declared per task | ✅ |
