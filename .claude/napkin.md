# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-08-11] Local integration and E2E fixtures share a stateful PostgreSQL database**
   Do instead: after verified synthetic-fixture pollution, reset the project database and use serial workers to distinguish product failures from shared-state races.

## Shell & Command Reliability

## Domain Behavior Guardrails

## User Directives
1. **[2026-08-11] TLC tasks require isolated implementation and evidence gates**
   Do instead: for each task, derive tests from acceptance criteria, run the mandatory gate and adequacy review, then create one atomic commit before moving on.
