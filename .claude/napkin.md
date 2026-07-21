# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-21] Execute one Ralph task per atomic commit**
   Do instead: verify the task gate before updating loop state or committing.

## Shell & Command Reliability
1. **[2026-07-21] Keep later-task tooling out of earlier task commits**
   Do instead: use placeholders only when the current task explicitly requires a future script name.

## Domain Behavior Guardrails
1. **[2026-07-21] Preserve approved MVP scope**
   Do instead: implement only the current task and leave authentication, data and operational features for their listed tasks.

## User Directives
1. **[2026-07-21] Prefer direct Unicode literals in APEX/SQL exports**
   Do instead: use direct literals such as `Césio` rather than `unistr(...)` when editing those exports.
