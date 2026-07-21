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
BATCH_ID=""
SCOPE=""
SCOPE_SLUG=""
BASE_BRANCH="dev"
RESUME=false

usage() {
  cat <<'EOF'
Usage: ./scripts/ralph-loop.sh [options]

Options:
  --model <provider/model>  Model sent to OpenCode for this run.
  --max-tasks <n>           Maximum consecutive approved tasks (default: 1).
  --batch <Lnnn>            Batch ID, required for non-dry execution.
  --scope <scope>           Batch scope, required for non-dry execution.
  --base-branch <branch>    Base branch (default: dev).
  --resume                  Reuse the recorded batch branch and metadata.
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
    --batch)
      [[ $# -ge 2 && -n "$2" ]] || { echo "Missing value for --batch" >&2; exit 64; }
      BATCH_ID="$2"
      shift 2
      ;;
    --scope)
      [[ $# -ge 2 && -n "$2" ]] || { echo "Missing value for --scope" >&2; exit 64; }
      SCOPE="$2"
      shift 2
      ;;
    --base-branch)
      [[ $# -ge 2 && -n "$2" ]] || { echo "Missing value for --base-branch" >&2; exit 64; }
      BASE_BRANCH="$2"
      shift 2
      ;;
    --resume)
      RESUME=true
      shift
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

normalize_scope() {
  python3 - "$1" <<'PY'
import re
import sys

scope = sys.argv[1].strip().lower()
slug = re.sub(r"[^a-z0-9]+", "-", scope).strip("-")
if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
    raise SystemExit("scope must normalize to a non-empty safe branch slug")
print(slug)
PY
}

validate_batch_arguments() {
  if [[ ! "$BASE_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] ||
    ! git check-ref-format --branch "$BASE_BRANCH" >/dev/null 2>&1; then
    echo "Invalid base branch: $BASE_BRANCH" >&2
    exit 64
  fi

  if [[ -n "$BATCH_ID" && ! "$BATCH_ID" =~ ^L[0-9]{3}$ ]]; then
    echo "Invalid batch ID: $BATCH_ID (expected Lnnn)." >&2
    exit 64
  fi

  if [[ -n "$SCOPE" ]]; then
    if ! SCOPE_SLUG="$(normalize_scope "$SCOPE")"; then
      echo "Invalid scope: $SCOPE" >&2
      exit 64
    fi
  fi

  if [[ "$DRY_RUN" == false ]]; then
    [[ -n "$BATCH_ID" ]] || {
      echo "--batch is required for non-dry execution." >&2
      exit 64
    }
    [[ -n "$SCOPE_SLUG" ]] || {
      echo "--scope is required for non-dry execution." >&2
      exit 64
    }
  fi
}

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

persist_batch_state() {
  python3 - "$STATE_FILE" "$BATCH_ID" "$SCOPE_SLUG" "$BASE_BRANCH" \
    "$RUN_BRANCH" "$BASE_SHA" <<'PY'
import datetime
import json
import os
import sys
import tempfile

path, batch, scope, base_branch, run_branch, base_sha = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    state = json.load(source)

state["batch"] = batch
state["scope"] = scope
state["baseBranch"] = base_branch
state["runBranch"] = run_branch
state["baseSha"] = base_sha
state["updatedAt"] = datetime.date.today().isoformat()

directory = os.path.dirname(os.path.abspath(path))
with tempfile.NamedTemporaryFile("w", dir=directory, encoding="utf-8", delete=False) as target:
    json.dump(state, target, indent=2)
    target.write("\n")
    temporary_path = target.name
os.replace(temporary_path, path)
PY
}

validate_resume_state() {
  python3 - "$STATE_FILE" "$BATCH_ID" "$SCOPE_SLUG" "$BASE_BRANCH" \
    "$RUN_BRANCH" <<'PY'
import json
import sys

path, batch, scope, base_branch, run_branch = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    state = json.load(source)

expected = {
    "batch": batch,
    "scope": scope,
    "baseBranch": base_branch,
    "runBranch": run_branch,
}
for key, expected_value in expected.items():
    if state.get(key) != expected_value:
        raise SystemExit(
            f"Persisted batch metadata does not match requested {key}: "
            f"expected {expected_value!r}, got {state.get(key)!r}."
        )

base_sha = state.get("baseSha")
if not isinstance(base_sha, str) or not base_sha:
    raise SystemExit("Persisted batch metadata does not contain a valid baseSha.")
print(base_sha)
PY
}

initialize_batch() {
  RUN_BRANCH="lote/${BATCH_ID}-${SCOPE_SLUG}"

  if [[ "$RESUME" == true ]]; then
    checked_out_branch="$(git branch --show-current)"
    if [[ "$checked_out_branch" != "$RUN_BRANCH" ]]; then
      printf 'Refusing to resume: checked-out branch is %s, expected %s.\n' \
        "${checked_out_branch:-detached HEAD}" "$RUN_BRANCH" >&2
      exit 66
    fi

    if BASE_SHA="$(validate_resume_state)"; then
      :
    else
      echo "Refusing to resume: batch metadata validation failed." >&2
      exit 66
    fi
    if ! git fetch origin "$BASE_BRANCH"; then
      printf 'Refusing to resume: unable to fetch origin/%s.\n' "$BASE_BRANCH" >&2
      exit 66
    fi
    current_base_sha="$(git rev-parse "refs/remotes/origin/$BASE_BRANCH")"
    if [[ "$current_base_sha" != "$BASE_SHA" ]]; then
      printf 'Refusing to resume: origin/%s changed from recorded base %s to %s.\n' \
        "$BASE_BRANCH" "$BASE_SHA" "$current_base_sha" >&2
      exit 66
    fi
    if ! git merge-base --is-ancestor "$BASE_SHA" HEAD; then
      printf 'Refusing to resume: %s is not based on recorded base %s.\n' \
        "$RUN_BRANCH" "$BASE_SHA" >&2
      exit 66
    fi
    return
  fi

  if git show-ref --verify --quiet "refs/heads/$RUN_BRANCH" ||
    git show-ref --verify --quiet "refs/remotes/origin/$RUN_BRANCH"; then
    printf 'Refusing to start: batch branch %s already exists; use --resume.\n' \
      "$RUN_BRANCH" >&2
    exit 66
  fi
  if git ls-remote --exit-code --heads origin "$RUN_BRANCH" >/dev/null 2>&1; then
    printf 'Refusing to start: batch branch %s already exists on origin; use --resume.\n' \
      "$RUN_BRANCH" >&2
    exit 66
  else
    remote_branch_status="$?"
    if [[ "$remote_branch_status" -ne 2 ]]; then
      printf 'Refusing to start: unable to query origin/%s (git ls-remote exited %d).\n' \
        "$RUN_BRANCH" "$remote_branch_status" >&2
      exit "$remote_branch_status"
    fi
  fi

  if ! git fetch origin "$BASE_BRANCH"; then
    printf 'Refusing to start: unable to fetch origin/%s.\n' "$BASE_BRANCH" >&2
    exit 66
  fi
  BASE_SHA="$(git rev-parse "refs/remotes/origin/$BASE_BRANCH")"
  git switch -c "$RUN_BRANCH" "refs/remotes/origin/$BASE_BRANCH"
  created_sha="$(git rev-parse HEAD)"
  if [[ "$created_sha" != "$BASE_SHA" ]]; then
    printf 'Refusing to continue: %s was not created at origin/%s (%s != %s).\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" "$created_sha" "$BASE_SHA" >&2
    exit 66
  fi
  persist_batch_state
  printf 'Initialized batch %s on %s from origin/%s at %s.\n' \
    "$BATCH_ID" "$RUN_BRANCH" "$BASE_BRANCH" "$BASE_SHA"
}

validate_batch_arguments
require_clean_tree
[[ -f "$STATE_FILE" && -f "$TASKS_FILE" && -x scripts/run-emaus-task.sh ]] || {
  echo "Loop governance files are missing or executor is not executable." >&2
  exit 66
}

if [[ "$DRY_RUN" == false ]] && ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode is not installed or is not on PATH." >&2
  exit 69
fi

if [[ "$DRY_RUN" == false ]]; then
  initialize_batch
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
