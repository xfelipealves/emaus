#!/usr/bin/env bash
set -euo pipefail

# Runs exactly one approved TLC task through OpenCode.
# Usage: OPENCODE_MODEL='provider/model' ./scripts/run-emaus-task.sh T01

TASK_ID="${1:-}"
if [[ ! "$TASK_ID" =~ ^T[0-9]{2}$ ]]; then
  echo "Usage: OPENCODE_MODEL='provider/model' $0 Tnn" >&2
  exit 64
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASKS_FILE="$ROOT_DIR/.specs/features/emaus-mvp/tasks.md"
if ! grep -q "^### ${TASK_ID}:" "$TASKS_FILE"; then
  echo "Task ${TASK_ID} is not defined in ${TASKS_FILE}." >&2
  exit 66
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode is not installed or is not on PATH." >&2
  exit 69
fi

MODEL_ARGS=()
if [[ -n "${OPENCODE_MODEL:-}" ]]; then
  MODEL_ARGS=(--model "$OPENCODE_MODEL")
fi

PROMPT=$(cat <<EOF
You are the Emaús MVP Ralph Loop implementer. Execute ONLY task ${TASK_ID} from .specs/features/emaus-mvp/tasks.md.

Mandatory procedure:
1. Read .specs/STATE.md, .specs/features/emaus-mvp/spec.md, .specs/features/emaus-mvp/design.md and the full definition of ${TASK_ID} before changing files.
2. Confirm all dependencies of ${TASK_ID} are complete. If they are not, stop and report the blocker; do not substitute another task.
3. Implement only the defined scope. Do not start a later task, refactor unrelated code, change product decisions, or add unapproved dependencies.
4. Add the test types declared by the task, run its Gate command, and fix only failures caused by this task.
5. If the gate passes, update .specs/STATE.md and .specs/loop-state.json in the same atomic commit. Append ${TASK_ID} to completedTasks; set currentTask to the next task defined in tasks.md and status to ready. For the terminal task defined in tasks.md, set currentTask to null and status to verification_required. Record the commit SHA and the gate command/result in loop-state.json.
6. This executor is commit-only: do not run git push and do not create or update a pull request. The Ralph runner owns all push and PR operations after it verifies the new commit, clean tree, and state transition.
7. If a requirement or technical decision is unclear, stop without a commit and report the question. Do not guess.
8. End with: task ID, files changed, exact verification commands/results, commit SHA or blocker.
EOF
)

opencode run "$PROMPT" \
  -f .specs/STATE.md \
  -f .specs/features/emaus-mvp/spec.md \
  -f .specs/features/emaus-mvp/design.md \
  -f .specs/features/emaus-mvp/tasks.md \
  "${MODEL_ARGS[@]+${MODEL_ARGS[@]}}"
