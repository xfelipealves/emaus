#!/usr/bin/env bash
set -euo pipefail

# Guarded Ralph Loop for the Emaús MVP.
# It executes only the task recorded in .specs/loop-state.json and advances
# only after OpenCode exits successfully, creates a commit, and leaves a clean tree.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MAX_TASKS=1
DRY_RUN=false
MODEL="${OPENCODE_MODEL:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/ralph-loop.sh [options]

Options:
  --model <provider/model>  Model sent to OpenCode for this run.
  --max-tasks <n>           Maximum consecutive approved tasks (default: 1).
  --dry-run                 Print the planned task sequence without calling OpenCode.
  -h, --help                Show this help.

The loop stops immediately if OpenCode fails, leaves uncommitted changes, does
not create a commit, or does not advance .specs/loop-state.json correctly.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)
      [[ $# -ge 2 ]] || { echo "Missing value for --model" >&2; exit 64; }
      MODEL="$2"
      shift 2
      ;;
    --max-tasks)
      [[ $# -ge 2 && "$2" =~ ^[1-9][0-9]*$ ]] || { echo "--max-tasks must be a positive integer" >&2; exit 64; }
      MAX_TASKS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

STATE_FILE=".specs/loop-state.json"
TASKS_FILE=".specs/features/emaus-mvp/tasks.md"

require_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Refusing to start: working tree is not clean." >&2
    git status --short >&2
    exit 65
  fi
}

read_state() {
  python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    state = json.load(source)

status = state.get("status")
current = state.get("currentTask")
if status not in {"ready", "verification_required", "complete", "blocked"}:
    raise SystemExit(f"Invalid loop status: {status!r}")
if status == "ready" and (not isinstance(current, str) or not current.startswith("T")):
    raise SystemExit("ready loop state requires currentTask")
print(f"{status}\t{current or ''}")
PY
}

next_task_id() {
  python3 - "$1" <<'PY'
import re
import sys

match = re.fullmatch(r"T(\d{2})", sys.argv[1])
if not match:
    raise SystemExit(f"Invalid task ID: {sys.argv[1]}")
number = int(match.group(1))
print(f"T{number + 1:02d}" if number < 36 else "")
PY
}

assert_task_exists() {
  grep -q "^### ${1}:" "$TASKS_FILE" || {
    echo "Task $1 is not defined in $TASKS_FILE." >&2
    exit 66
  }
}

require_clean_tree
[[ -f "$STATE_FILE" && -f "$TASKS_FILE" && -x scripts/run-emaus-task.sh ]] || {
  echo "Loop governance files are missing or executor is not executable." >&2
  exit 66
}

if [[ "$DRY_RUN" == false ]] && ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode is not installed or is not on PATH." >&2
  exit 69
fi

dry_run_task=""
for ((iteration = 1; iteration <= MAX_TASKS; iteration++)); do
  if [[ "$DRY_RUN" == true && -n "$dry_run_task" ]]; then
    status="ready"
    task_id="$dry_run_task"
  else
    IFS=$'\t' read -r status task_id < <(read_state)
  fi

  case "$status" in
    complete)
      echo "Loop is complete; no further task will run."
      exit 0
      ;;
    blocked|verification_required)
      echo "Loop status is $status; human action is required before continuing." >&2
      exit 67
      ;;
    ready)
      ;;
  esac

  assert_task_exists "$task_id"
  expected_next="$(next_task_id "$task_id")"

  if [[ "$DRY_RUN" == true ]]; then
    echo "Would execute $task_id (expected next: ${expected_next:-verification_required})."
    [[ -n "$expected_next" ]] || exit 0
    dry_run_task="$expected_next"
    continue
  fi

  before_commit="$(git rev-parse HEAD)"
  echo "=== Ralph Loop: starting $task_id (iteration $iteration/$MAX_TASKS) ==="

  if [[ -n "$MODEL" ]]; then
    OPENCODE_MODEL="$MODEL" ./scripts/run-emaus-task.sh "$task_id"
  else
    ./scripts/run-emaus-task.sh "$task_id"
  fi

  require_clean_tree
  after_commit="$(git rev-parse HEAD)"
  if [[ "$before_commit" == "$after_commit" ]]; then
    echo "Task $task_id returned successfully but no commit was created; stopping." >&2
    exit 68
  fi

  IFS=$'\t' read -r new_status new_task_id < <(read_state)
  if [[ -n "$expected_next" ]]; then
    if [[ "$new_status" != "ready" || "$new_task_id" != "$expected_next" ]]; then
      echo "Task $task_id did not advance loop state to $expected_next; stopping." >&2
      exit 68
    fi
  elif [[ "$new_status" != "verification_required" ]]; then
    echo "T36 must change loop state to verification_required; stopping." >&2
    exit 68
  fi

  echo "=== Ralph Loop: completed $task_id in commit $after_commit ==="
done
