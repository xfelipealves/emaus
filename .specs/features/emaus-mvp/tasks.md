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
M8 Validation:       T34 → T35 → T36
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
- [ ] Row cycles unknown → present → absent → unknown.
- [ ] UI uses white/green/red feedback and rolls back display on server failure.
- [ ] Audit stores before/after, actor, timestamp and optional reason for correction.
**Tests**: unit + integration + E2E
**Gate**: Full
**Commit**: `feat: add one-tap attendance`

### T29: Implement attendance search, quick visitor and summaries

**What**: Add attendee search, in-context visitor creation and meeting/ministry summaries.
**Where**: `src/features/encontros/attendance-query.ts`, `src/app/(dashboard)/encontros/[meetingId]/`
**Depends on**: T28, T17
**Requirement**: ENC-01
**Done when**:
- [ ] Existing Person search works without leaving attendance.
- [ ] Quick visitor requires only name and is immediately eligible.
- [ ] Summary reflects each state.
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
- [ ] Events sort newest first.
- [ ] Filters distinguish status, ministries, attendance, notes and corrections.
- [ ] Filters change query only and never data.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add person timeline filters`

### T31: Implement note creation and versioned editing

**What**: Add plain-text notes and immutable versions.
**Where**: `src/features/timeline/note-service.ts`, `src/app/(dashboard)/pessoas/[personId]/`
**Depends on**: T30
**Requirement**: TIM-01
**Done when**:
- [ ] Note stores author, creation and update timestamps.
- [ ] Every edit creates ordered NoteVersion.
- [ ] Creation/edit emits timeline and audit events.
**Tests**: unit + integration + E2E
**Gate**: Full
**Commit**: `feat: add versioned person notes`

### T32: Implement note archive and archived filter

**What**: Add archive action and explicit archived-note filter.
**Where**: `src/features/timeline/note-service.ts`, `src/app/(dashboard)/pessoas/[personId]/`
**Depends on**: T31
**Requirement**: TIM-01
**Done when**:
- [ ] Archive never deletes note/version history.
- [ ] Default timeline hides archived notes.
- [ ] Filter reveals archived notes only to authorized profile viewer.
**Tests**: integration + E2E
**Gate**: Full
**Commit**: `feat: add note archiving`

### T33: Implement audit query for sensitive changes

**What**: Add administrator audit query with target, actor, action and before/after display.
**Where**: `src/features/auditoria/audit-query.ts`, `src/app/(dashboard)/configuracoes/auditoria/`
**Depends on**: T32
**Requirement**: AUD-01
**Done when**:
- [ ] Admin sees sensitive actions specified by the spec.
- [ ] Non-admin cannot access audit query.
- [ ] Correction audit shows optional reason when present.
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
- [ ] Seed demonstrates each role and core feature.
- [ ] README documents local reset/seed command.
- [ ] No real personal data exists in seed.
**Tests**: integration
**Gate**: Full
**Commit**: `chore: add Emaus demo scenario`

### T35: Complete critical-path Playwright suite

**What**: Add end-to-end coverage for P1 journeys.
**Where**: `e2e/auth.spec.ts`, `e2e/people.spec.ts`, `e2e/attendance.spec.ts`, `e2e/permissions.spec.ts`
**Depends on**: T34
**Requirement**: AUTH-01, PES-01, MIN-02, ENC-01, TIM-01, AUD-01
**Done when**:
- [ ] Suite covers login/deactivation, Person lifecycle, leader restriction and attendance correction.
- [ ] E2E uses isolated seeded/reset state.
- [ ] All P1 acceptance criteria map to test evidence.
**Tests**: E2E
**Gate**: Full
**Commit**: `test: cover Emaus critical MVP journeys`

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
