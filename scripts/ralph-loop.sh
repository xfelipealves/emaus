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
PR_BODY_FILE=""
TASK_STATE_SNAPSHOT=""

cleanup_pr_body() {
  if [[ -n "$PR_BODY_FILE" ]]; then
    rm -f -- "$PR_BODY_FILE"
  fi
  if [[ -n "$TASK_STATE_SNAPSHOT" ]]; then
    rm -f -- "$TASK_STATE_SNAPSHOT"
  fi
}

trap cleanup_pr_body EXIT

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

persist_last_push() {
  python3 - "$STATE_FILE" "$1" origin "$RUN_BRANCH" passed <<'PY'
import datetime
import json
import os
import sys
import tempfile

path, sha, remote, branch, status = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    state = json.load(source)

state["lastPush"] = {
    "sha": sha,
    "remote": remote,
    "branch": branch,
    "status": status,
}
state["updatedAt"] = datetime.date.today().isoformat()

directory = os.path.dirname(os.path.abspath(path))
with tempfile.NamedTemporaryFile("w", dir=directory, encoding="utf-8", delete=False) as target:
    json.dump(state, target, indent=2)
    target.write("\n")
    temporary_path = target.name
os.replace(temporary_path, path)
PY
}

persist_task_metadata() {
  python3 - "$STATE_FILE" "$1" "$2" <<'PY'
import datetime
import json
import os
import sys
import tempfile

path, task_id, commit_sha = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    state = json.load(source)

state["lastCommit"] = commit_sha
last_gate = state.get("lastGate")
if isinstance(last_gate, dict):
    gate_results = state.get("gateResults")
    if not isinstance(gate_results, list):
        gate_results = []
    if not any(
        isinstance(result, dict) and result.get("task") == task_id
        for result in gate_results
    ):
        result = dict(last_gate)
        result["task"] = task_id
        gate_results.append(result)
    state["gateResults"] = gate_results
state["updatedAt"] = datetime.date.today().isoformat()

directory = os.path.dirname(os.path.abspath(path))
with tempfile.NamedTemporaryFile("w", dir=directory, encoding="utf-8", delete=False) as target:
    json.dump(state, target, indent=2)
    target.write("\n")
    temporary_path = target.name
os.replace(temporary_path, path)
PY
}

persist_pull_request() {
  python3 - "$STATE_FILE" "$1" "$2" "$BASE_BRANCH" "$RUN_BRANCH" "$3" <<'PY'
import datetime
import json
import os
import sys
import tempfile

path, number, url, base_branch, head_branch, draft = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    state = json.load(source)

state["pullRequest"] = {
    "number": int(number),
    "url": url,
    "base": base_branch,
    "head": head_branch,
    "draft": draft == "true",
}
state["updatedAt"] = datetime.date.today().isoformat()

directory = os.path.dirname(os.path.abspath(path))
with tempfile.NamedTemporaryFile("w", dir=directory, encoding="utf-8", delete=False) as target:
    json.dump(state, target, indent=2)
    target.write("\n")
    temporary_path = target.name
os.replace(temporary_path, path)
PY
}

commit_state_transition() {
  local message="$1"
  if git diff --quiet -- "$STATE_FILE"; then
    return 0
  fi
  git add -- "$STATE_FILE"
  git commit -m "$message"
}

push_published_state() {
  local push_status
  if git push origin "$RUN_BRANCH"; then
    return 0
  else
    push_status="$?"
    printf 'Metadata push failed for %s; local state is preserved. Retry with --resume.\n' \
      "$RUN_BRANCH" >&2
    return "$push_status"
  fi
}

stored_pull_request() {
  python3 - "$STATE_FILE" "$BASE_BRANCH" "$RUN_BRANCH" <<'PY'
import json
import sys

path, base_branch, head_branch = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    pull_request = json.load(source).get("pullRequest")

if not isinstance(pull_request, dict):
    raise SystemExit(1)
if pull_request.get("base") != base_branch or pull_request.get("head") != head_branch:
    raise SystemExit(1)
number = pull_request.get("number")
url = pull_request.get("url")
draft = pull_request.get("draft")
if not isinstance(number, int) or number <= 0 or not isinstance(url, str) or not url:
    raise SystemExit(1)
if not isinstance(draft, bool):
    raise SystemExit(1)
print(f"{number}\t{url}\t{str(draft).lower()}")
PY
}

generate_pr_body() {
  if [[ -n "$PR_BODY_FILE" ]]; then
    rm -f -- "$PR_BODY_FILE"
  fi
  PR_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/ralph-pr-body.XXXXXX")"
  python3 - "$STATE_FILE" "$BATCH_ID" "$SCOPE_SLUG" "$BASE_BRANCH" "$RUN_BRANCH" > "$PR_BODY_FILE" <<'PY'
import json
import re
import subprocess
import sys

state_path, batch, scope, base_branch, head_branch = sys.argv[1:]
with open(state_path, encoding="utf-8") as source:
    state = json.load(source)

completed_tasks = [
    task for task in state.get("completedTasks", [])
    if isinstance(task, str) and re.fullmatch(r"T\d{2}", task)
]
base_tasks = []
base_sha = state.get("baseSha")
if isinstance(base_sha, str) and base_sha:
    try:
        base_state = json.loads(
            subprocess.check_output(
                ["git", "show", f"{base_sha}:{state_path}"], text=True
            )
        )
        base_tasks = [
            task for task in base_state.get("completedTasks", [])
            if isinstance(task, str) and re.fullmatch(r"T\d{2}", task)
        ]
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError):
        base_tasks = []
if completed_tasks[:len(base_tasks)] == base_tasks:
    task_ids = completed_tasks[len(base_tasks):]
else:
    task_ids = completed_tasks
if task_ids:
    task_range = task_ids[0] if len(task_ids) == 1 else f"{task_ids[0]}..{task_ids[-1]}"
else:
    task_range = "none"

gate = state.get("lastGate")

push = state.get("lastPush")
push_result = push.get("status") if isinstance(push, dict) else None
if push_result not in {"passed", "failed"}:
    push_result = "not recorded"

commit_shas = subprocess.check_output(
    ["git", "log", "--format=%H", f"{base_sha}..HEAD"], text=True
).splitlines()
gate_results = state.get("gateResults")
if not isinstance(gate_results, list) or not gate_results:
    gate_results = [gate] if isinstance(gate, dict) else []

print(f"# Ralph batch {batch}")
print()
print("## Batch")
print(f"- Scope: `{scope}`")
print(f"- Base: `{base_branch}`")
print(f"- Head: `{head_branch}`")
print(f"- Completed task range: `{task_range}`")
print()
print("## Commit SHAs")
for sha in commit_shas:
    print(f"- `{sha}`")
print()
print("## Gate Results")
if gate_results:
    for result in gate_results:
        if isinstance(result, dict):
            print(f"- `{result.get('command', 'unknown')}`: {result.get('result', 'not recorded')}")
else:
    print("- No gate result recorded.")
print()
print("## Push Status")
print(f"- Status: `{push_result}`")
if isinstance(push, dict):
    print(f"- Commit: `{push.get('sha', 'not recorded')}`")
    print(f"- Remote: `{push.get('remote', 'not recorded')}`")
    print(f"- Branch: `{push.get('branch', 'not recorded')}`")
print()
print("## Known Risks")
print("- Review scope drift and dependency assumptions before marking this PR ready.")
print("- Keep this PR Draft until independent QA passes against the complete batch range.")
print()
print("## QA Checklist")
print("- [ ] Confirm the complete `base...head` diff and task range.")
print("- [ ] Run the configured project gates for the completed tasks.")
print("- [ ] Check desktop and mobile behavior, console errors, and failed requests.")
print("- [ ] Check keyboard access, generated files, and accidental secrets.")
print("- [ ] Confirm scope, branch, and loop-state metadata before making ready.")
PY
}

parse_pr_list() {
  python3 - "$1" <<'PY'
import json
import sys

items = json.loads(sys.argv[1])
if not isinstance(items, list):
    raise SystemExit("gh pr list returned a non-list result")
for item in items:
    if not isinstance(item, dict):
        raise SystemExit("gh pr list returned an invalid PR record")
    number = item.get("number")
    url = item.get("url")
    draft = item.get("isDraft")
    if not isinstance(number, int) or number <= 0 or not isinstance(url, str) or not isinstance(draft, bool):
        raise SystemExit("gh pr list returned incomplete PR metadata")
    print(f"{number}\t{url}\t{str(draft).lower()}")
PY
}

require_open_pr_draft() {
  local pr_list_output
  local parsed_prs
  local row
  local pr_rows=()
  local pr_number
  local pr_url
  local pr_draft

  if ! pr_list_output="$(gh pr list --head "$RUN_BRANCH" --base "$BASE_BRANCH" \
    --state open --json number,url,isDraft 2>&1)"; then
    printf 'Unable to query open PRs for %s -> %s.\n%s\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" "$pr_list_output" >&2
    return 69
  fi
  if ! parsed_prs="$(parse_pr_list "$pr_list_output" 2>&1)"; then
    printf 'Unable to parse open PR metadata for %s -> %s.\n%s\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" "$parsed_prs" >&2
    return 69
  fi
  while IFS= read -r row; do
    [[ -n "$row" ]] && pr_rows+=("$row")
  done <<< "$parsed_prs"
  if [[ "${#pr_rows[@]}" -gt 1 ]]; then
    printf 'Multiple open PRs exist for %s -> %s; refusing to guess.\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" >&2
    return 66
  fi
  if [[ "${#pr_rows[@]}" -eq 0 ]]; then
    printf 'No open Draft PR exists for %s -> %s; refusing to continue.\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" >&2
    return 66
  fi
  if [[ "${#pr_rows[@]}" -eq 1 ]]; then
    IFS=$'\t' read -r pr_number pr_url pr_draft <<< "${pr_rows[0]}"
    if [[ "$pr_draft" != true ]]; then
      printf 'Existing PR #%s is already ready; refusing to violate Draft-until-QA.\n' \
        "$pr_number" >&2
      return 66
    fi
  fi
}

ensure_pull_request() {
  local allow_create="${1:-false}"
  local pr_list_output
  local parsed_prs
  local pr_number
  local pr_url
  local pr_draft
  local create_output
  local create_status
  local created_metadata
  local pr_rows=()
  local created_pr=false

  generate_pr_body
  if ! pr_list_output="$(gh pr list --head "$RUN_BRANCH" --base "$BASE_BRANCH" \
    --state open --json number,url,isDraft 2>&1)"; then
    printf 'Unable to query open PRs for %s -> %s.\n%s\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" "$pr_list_output" >&2
    return 69
  fi
  if ! parsed_prs="$(parse_pr_list "$pr_list_output" 2>&1)"; then
    printf 'Unable to parse open PR metadata for %s -> %s.\n%s\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" "$parsed_prs" >&2
    return 69
  fi
  while IFS= read -r row; do
    [[ -n "$row" ]] && pr_rows+=("$row")
  done <<< "$parsed_prs"

  if [[ "${#pr_rows[@]}" -gt 1 ]]; then
    printf 'Multiple open PRs exist for %s -> %s; refusing to guess.\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" >&2
    return 66
  fi

  if [[ "${#pr_rows[@]}" -eq 1 ]]; then
    IFS=$'\t' read -r pr_number pr_url pr_draft <<< "${pr_rows[0]}"
  elif [[ "$allow_create" == true ]]; then
    if create_output="$(gh pr create --draft --base "$BASE_BRANCH" --head "$RUN_BRANCH" \
      --title "[$BATCH_ID] $SCOPE_SLUG" --body-file "$PR_BODY_FILE" 2>&1)"; then
      :
    else
      create_status="$?"
      printf 'Draft PR creation failed after the branch was pushed; retry with --resume.\n%s\n' \
        "$create_output" >&2
      return "$create_status"
    fi
    if ! created_metadata="$(python3 - "$create_output" <<'PY'
import re
import sys

match = re.search(r"(https?://[^\s]+/pull/(\d+))", sys.argv[1])
if not match:
    raise SystemExit("gh pr create did not return a PR URL")
print(f"{match.group(2)}\t{match.group(1)}\ttrue")
PY
)"; then
      printf 'Draft PR creation returned no usable PR URL; retry with --resume.\n%s\n' \
        "$create_output" >&2
      return 69
    fi
    IFS=$'\t' read -r pr_number pr_url pr_draft <<< "$created_metadata"
    created_pr=true
  else
    printf 'No open PR exists for %s -> %s; refusing to create or execute another task.\n' \
      "$RUN_BRANCH" "$BASE_BRANCH" >&2
    return 66
  fi

  if [[ "$pr_draft" != true ]]; then
    printf 'Existing PR #%s is already ready; refusing to violate Draft-until-QA.\n' \
      "$pr_number" >&2
    return 66
  fi

  if [[ "$created_pr" == false ]]; then
    if ! gh pr edit "$pr_number" --body-file "$PR_BODY_FILE" >/dev/null 2>&1; then
      printf 'Unable to update Draft PR #%s; retry with --resume.\n' "$pr_number" >&2
      return 69
    fi
  fi
  persist_pull_request "$pr_number" "$pr_url" "$pr_draft"
  printf 'Maintaining Draft PR #%s: %s\n' "$pr_number" "$pr_url"
}

last_pushed_sha() {
  python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    state = json.load(source)
print(state.get("lastPush", {}).get("sha", ""))
PY
}

has_pending_task_commit() {
  python3 - "$STATE_FILE" "$BASE_SHA" <<'PY'
import json
import subprocess
import sys

state_path, base_sha = sys.argv[1:]
with open(state_path, encoding="utf-8") as source:
    state = json.load(source)
base_state = json.loads(
    subprocess.check_output(
        ["git", "show", f"{base_sha}:{state_path}"], text=True
    )
)
raise SystemExit(0 if state.get("lastCommit") != base_state.get("lastCommit") else 1)
PY
}

allow_resume_push_state() {
  [[ "$RESUME" == true && -f "$STATE_FILE" ]] || return 1
  local status
  status="$(git status --porcelain)"
  [[ -z "$status" || "$status" == " M $STATE_FILE" ]] || return 1
  [[ "$(last_pushed_sha)" == "$(git rev-parse HEAD)" ]] || return 1
  [[ "$(python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    print(json.load(source).get("lastPush", {}).get("status", ""))
PY
)" == "passed" ]]
}

validate_task_transition() {
  local snapshot="$1"
  local task_id="$2"
  local expected_next="$3"
  local before_commit="$4"
  local after_commit="$5"

  python3 - "$snapshot" "$STATE_FILE" "$task_id" "$expected_next" \
    "$before_commit" "$after_commit" <<'PY'
import json
import re
import sys

before_path, after_path, task_id, expected_next, before_commit, after_commit = sys.argv[1:]
with open(before_path, encoding="utf-8") as source:
    before = json.load(source)
with open(after_path, encoding="utf-8") as source:
    after = json.load(source)

before_tasks = before.get("completedTasks")
after_tasks = after.get("completedTasks")
if not isinstance(before_tasks, list) or not isinstance(after_tasks, list):
    raise SystemExit("loop state completedTasks must be lists")
if after_tasks != before_tasks + [task_id]:
    raise SystemExit(
        f"completedTasks must append exactly {task_id}; "
        f"got {after_tasks!r} from {before_tasks!r}"
    )
if not re.fullmatch(r"T\d{2}", task_id):
    raise SystemExit(f"invalid task ID: {task_id}")

if expected_next:
    if after.get("status") != "ready" or after.get("currentTask") != expected_next:
        raise SystemExit(
            f"task {task_id} must advance to ready/{expected_next}; "
            f"got {after.get('status')!r}/{after.get('currentTask')!r}"
        )
else:
    if after.get("status") != "verification_required" or after.get("currentTask") is not None:
        raise SystemExit("T36 must advance to verification_required with no currentTask")

if before_commit == after_commit:
    raise SystemExit("task iteration did not create a new commit")
PY
}

require_initial_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]] && ! allow_resume_push_state; then
    echo "Refusing to start: working tree is not clean." >&2
    git status --short >&2
    exit 65
  fi
}

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "GitHub CLI is required for non-dry execution. Install it with: brew install gh" >&2
    exit 69
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated. Run 'gh auth login' and retry." >&2
    exit 69
  fi
}

push_batch_branch_ref() {
  local commit_sha="$1"
  local upstream=""
  local push_status

  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ "$upstream" == "origin/$RUN_BRANCH" ]]; then
    if git push origin "$RUN_BRANCH"; then
      :
    else
      push_status="$?"
      printf 'Push failed for %s; local commit %s is preserved. Retry with --resume.\n' \
        "$RUN_BRANCH" "$commit_sha" >&2
      return "$push_status"
    fi
  else
    if git push -u origin "$RUN_BRANCH"; then
      :
    else
      push_status="$?"
      printf 'Push failed for %s; local commit %s is preserved. Retry with --resume.\n' \
        "$RUN_BRANCH" "$commit_sha" >&2
      return "$push_status"
    fi
  fi

}

state_last_commit() {
  python3 - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    print(json.load(source).get("lastCommit", ""))
PY
}

state_file_dirty() {
  [[ -n "$(git status --porcelain -- "$STATE_FILE")" ]]
}

ensure_branch_published() {
  local remote_head
  git fetch origin "$RUN_BRANCH" >/dev/null 2>&1 || true
  remote_head="$(git rev-parse --verify "refs/remotes/origin/$RUN_BRANCH^{commit}" 2>/dev/null || true)"
  if [[ "$remote_head" != "$(git rev-parse HEAD)" ]]; then
    push_batch_branch_ref "$(git rev-parse HEAD)"
  fi
}

prepare_draft_pr() {
  local stored_pr=false

  if stored_pull_request >/dev/null 2>&1; then
    stored_pr=true
    require_open_pr_draft || return $?
  else
    ensure_branch_published
    ensure_pull_request true || return $?
  fi

  if [[ "$stored_pr" == true ]] && state_file_dirty; then
    ensure_pull_request false || return $?
  fi

  if [[ "$RESUME" == true && -z "$(last_pushed_sha)" ]] && has_pending_task_commit; then
    persist_last_push "$(state_last_commit)"
  fi

  if state_file_dirty; then
    commit_state_transition "chore: publish Ralph state metadata"
    push_published_state
  fi

  ensure_branch_published
  require_open_pr_draft
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
  commit_state_transition "chore: initialize Ralph batch state"
  push_batch_branch_ref "$(git rev-parse HEAD)"
  printf 'Initialized batch %s on %s from origin/%s at %s.\n' \
    "$BATCH_ID" "$RUN_BRANCH" "$BASE_BRANCH" "$BASE_SHA"
}

validate_batch_arguments
require_initial_clean_tree
[[ -f "$STATE_FILE" && -f "$TASKS_FILE" && -x scripts/run-emaus-task.sh ]] || {
  echo "Loop governance files are missing or executor is not executable." >&2
  exit 66
}

if [[ "$DRY_RUN" == false ]] && ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode is not installed or is not on PATH." >&2
  exit 69
fi
if [[ "$DRY_RUN" == false ]]; then
  require_gh
fi

if [[ "$DRY_RUN" == false ]]; then
  initialize_batch
  prepare_draft_pr
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

  if [[ "$DRY_RUN" == false ]]; then
    require_open_pr_draft || {
      pr_status="$?"
      exit "$pr_status"
    }
  fi

  assert_task_exists "$task_id"
  expected_next="$(next_task_id "$task_id")"

  if [[ "$DRY_RUN" == true ]]; then
    echo "Would execute $task_id (expected next: ${expected_next:-verification_required})."
    [[ -n "$expected_next" ]] || exit 0
    dry_run_task="$expected_next"
    continue
  fi

  before_commit="$(git rev-parse HEAD)"
  TASK_STATE_SNAPSHOT="$(mktemp "${TMPDIR:-/tmp}/ralph-task-state.XXXXXX")"
  cp "$STATE_FILE" "$TASK_STATE_SNAPSHOT"
  echo "=== Ralph Loop: starting $task_id (iteration $iteration/$MAX_TASKS) ==="

  if [[ -n "$MODEL" ]]; then
    OPENCODE_MODEL="$MODEL" ./scripts/run-emaus-task.sh "$task_id"
  else
    ./scripts/run-emaus-task.sh "$task_id"
  fi

  require_clean_tree
  after_commit="$(git rev-parse HEAD)"
  commit_count="$(git rev-list --count "$before_commit..$after_commit")"
  if [[ "$commit_count" != 1 ]]; then
    printf 'Task %s must create exactly one commit; found %s.\n' \
      "$task_id" "$commit_count" >&2
    exit 68
  fi

  if ! validate_task_transition "$TASK_STATE_SNAPSHOT" "$task_id" \
    "$expected_next" "$before_commit" "$after_commit"; then
    echo "Task $task_id did not produce the required sequential state transition; stopping." >&2
    exit 68
  fi
  rm -f -- "$TASK_STATE_SNAPSHOT"
  TASK_STATE_SNAPSHOT=""
  persist_task_metadata "$task_id" "$after_commit"

  require_open_pr_draft || {
    pr_status="$?"
    exit "$pr_status"
  }
  persist_last_push "$after_commit"
  ensure_pull_request false || {
    pr_status="$?"
    exit "$pr_status"
  }
  commit_state_transition "chore: publish Ralph task metadata"
  push_published_state || {
    push_status="$?"
    exit "$push_status"
  }

  echo "=== Ralph Loop: completed $task_id in commit $after_commit ==="
done
