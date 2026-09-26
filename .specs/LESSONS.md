# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Keep internal Next.js navigation on next/link so the project lint gate remains clean.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: emaus-mvp
- evidence: T37 / validation.md (ui)
- last seen: 2026-08-11T04:06:14Z

### L-002 — Give critical Playwright navigation assertions bounded cold-start tolerance without weakening their destination checks.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: emaus-mvp
- evidence: T40,T46 / validation.md (e2e)
- last seen: 2026-08-11T04:06:15Z

### L-003 — Return an exact contextual confirmation when Person registration completes and preserve destination assertions.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `people` · harmful: 0
- features: emaus-mvp
- evidence: PES-01.5 / validation.md (people)
- last seen: 2026-08-11T04:06:15Z

### L-004 — Guard every destructive or status-changing action with explicit confirmation before submitting it.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `operations` · harmful: 0
- features: emaus-mvp
- evidence: AUD-01.3 / validation.md (operations)
- last seen: 2026-08-11T04:06:15Z

### L-005 — Poll asynchronous persistence outcomes when an E2E test proves that a dismissed action did not write data.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: emaus-mvp
- evidence: T45/M3 / validation.md (e2e)
- last seen: 2026-08-11T04:06:15Z

### L-006 — Exercise uniqueness constraints at the service boundary and assert no partial record is persisted.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `auth` · harmful: 0
- features: emaus-mvp
- evidence: AUTH-01.3 / validation.md (auth)
- last seen: 2026-08-11T04:06:15Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
