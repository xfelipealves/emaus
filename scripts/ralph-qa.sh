#!/usr/bin/env bash
set -euo pipefail

# Independent end-to-end QA for one Ralph batch. This script never commits,
# pushes, merges, or changes application files.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_FILE=".specs/loop-state.json"
TASKS_FILE=".specs/features/emaus-mvp/tasks.md"
BATCH_ID=""
SCOPE=""
SCOPE_SLUG=""
BASE_BRANCH="dev"
RUN_BRANCH=""
BASE_SHA=""
LAST_PUSH_SHA=""
TASK_RANGE=""
PR_NUMBER=""
PR_URL=""
PR_BODY_FILE=""
CHECKLIST_FILE=""
APP_LOG_FILE=""
APP_PID=""
APP_PORT=""
TESTED_HEAD_SHA=""
TESTED_STATE_SHA=""
TESTED_DIFF_SHA=""
START_COMMAND="${RALPH_START_COMMAND:-npm run dev -- --hostname 127.0.0.1}"
APP_URL="${RALPH_APP_URL:-http://127.0.0.1:3000}"
BROWSER_VIEWPORTS="${RALPH_BROWSER_VIEWPORTS:-desktop,mobile}"
BROWSER_QA_COMMAND="${RALPH_BROWSER_QA_COMMAND:-}"
WAIT_FOR_APP="${RALPH_WAIT_FOR_APP:-true}"

cleanup() {
  local exit_status=$?

  if declare -F stop_app >/dev/null 2>&1; then
    stop_app
  fi
  [[ -z "$PR_BODY_FILE" ]] || rm -f -- "$PR_BODY_FILE"
  [[ -z "$CHECKLIST_FILE" ]] || rm -f -- "$CHECKLIST_FILE"
  [[ -z "$APP_LOG_FILE" ]] || rm -f -- "$APP_LOG_FILE"
  exit "$exit_status"
}

trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: ./scripts/ralph-qa.sh --batch <Lnnn> --scope <scope> [options]

Required:
  --batch <Lnnn>            Recorded Ralph batch ID.
  --scope <scope>           Recorded batch scope.

Options:
  --base-branch <branch>    Base branch (default: dev; must match the PR/state).
  --start-command <command> Application command for browser QA.
  --app-url <url>           URL used to wait for the application (default: http://127.0.0.1:3000).
  --browser-qa-command <command>
                            Browser QA hook; receives the generated checklist path.
  --no-wait-for-app         Start the application without waiting for --app-url.
  -h, --help                Show this help.

The browser hook must check desktop and mobile viewports, console and network
errors, navigation, and the acceptance criteria listed in the checklist. The
hook must not modify application files.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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
    --start-command)
      [[ $# -ge 2 && -n "$2" ]] || { echo "Missing value for --start-command" >&2; exit 64; }
      START_COMMAND="$2"
      shift 2
      ;;
    --app-url)
      [[ $# -ge 2 && -n "$2" ]] || { echo "Missing value for --app-url" >&2; exit 64; }
      APP_URL="$2"
      shift 2
      ;;
    --browser-qa-command)
      [[ $# -ge 2 && -n "$2" ]] || { echo "Missing value for --browser-qa-command" >&2; exit 64; }
      BROWSER_QA_COMMAND="$2"
      shift 2
      ;;
    --no-wait-for-app)
      WAIT_FOR_APP=false
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

fail_preflight() {
  local message="$1"
  echo "QA preflight failed: $message" >&2
  echo "Rerun: ./scripts/ralph-qa.sh --batch $BATCH_ID --scope $SCOPE" >&2
  exit 66
}

require_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Refusing QA: working tree is not clean." >&2
    git status --short >&2
    exit 65
  fi
}

require_commands() {
  local command_name
  for command_name in git gh npm python3 curl lsof; do
    command -v "$command_name" >/dev/null 2>&1 || {
      echo "Required command is not on PATH: $command_name" >&2
      exit 69
    }
  done
  gh auth status >/dev/null 2>&1 || {
    echo "GitHub CLI is not authenticated. Run 'gh auth login' and retry." >&2
    exit 69
  }
}

require_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "QA preflight failed: DATABASE_URL is required for the project gates (npm run db:validate)." >&2
    exit 69
  fi
}

read_batch_metadata() {
  local metadata
  if ! metadata="$(python3 - "$STATE_FILE" "$TASKS_FILE" "$BATCH_ID" \
    "$SCOPE_SLUG" "$BASE_BRANCH" "$RUN_BRANCH" <<'PY'
import json
import re
import subprocess
import sys

state_path, tasks_path, batch, scope, base_branch, run_branch = sys.argv[1:]
with open(state_path, encoding="utf-8") as source:
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
            f"recorded {key} is {state.get(key)!r}, expected {expected_value!r}"
        )

base_sha = state.get("baseSha")
if not isinstance(base_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", base_sha):
    raise SystemExit("recorded baseSha is missing or invalid")
try:
    subprocess.check_call(
        ["git", "cat-file", "-e", f"{base_sha}^{{commit}}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
except subprocess.CalledProcessError:
    raise SystemExit(f"recorded baseSha is not present locally: {base_sha}")

completed = state.get("completedTasks")
if not isinstance(completed, list) or not completed:
    raise SystemExit("loop state has no completed task list")
if any(
    not isinstance(task, str)
    or not re.fullmatch(r"T\d{2}", task)
    or not 1 <= int(task[1:]) <= 36
    for task in completed
):
    raise SystemExit("loop state contains an invalid completed task ID")

try:
    base_state = json.loads(
        subprocess.check_output(["git", "show", f"{base_sha}:{state_path}"], text=True)
    )
except (subprocess.CalledProcessError, json.JSONDecodeError):
    raise SystemExit("could not read loop state at recorded baseSha")
base_completed = base_state.get("completedTasks")
if not isinstance(base_completed, list):
    raise SystemExit("recorded base state has no completed task list")
if any(
    not isinstance(task, str)
    or not re.fullmatch(r"T\d{2}", task)
    or not 1 <= int(task[1:]) <= 36
    for task in base_completed
):
    raise SystemExit("recorded base state contains an invalid completed task ID")
if completed[:len(base_completed)] != base_completed:
    raise SystemExit("completed tasks are not an extension of the recorded base task list")
new_tasks = completed[len(base_completed):]
if not new_tasks:
    raise SystemExit("batch has no completed tasks after the recorded base")

base_numbers = [int(task[1:]) for task in base_completed]
base_next_number = base_numbers[-1] + 1 if base_numbers else 1
base_next = f"T{base_next_number:02d}" if base_next_number <= 36 else None
if base_next is None or base_state.get("currentTask") != base_next:
    raise SystemExit("recorded base state currentTask is not the next task after its completedTasks")
new_numbers = [int(task[1:]) for task in new_tasks]
expected_numbers = list(range(base_next_number, new_numbers[-1] + 1))
if new_numbers != expected_numbers:
    raise SystemExit("completed task sequence is not contiguous from the recorded base next task")

with open(tasks_path, encoding="utf-8") as source:
    task_text = source.read()
for task in new_tasks:
    if not re.search(rf"^### {re.escape(task)}:", task_text, re.MULTILINE):
        raise SystemExit(f"task definition is missing for {task}")

pull_request = state.get("pullRequest")
if not isinstance(pull_request, dict):
    raise SystemExit("recorded pullRequest metadata is missing")
number = pull_request.get("number")
url = pull_request.get("url")
if not isinstance(number, int) or number <= 0 or not isinstance(url, str) or not url:
    raise SystemExit("recorded pullRequest metadata is incomplete")
if pull_request.get("base") != base_branch or pull_request.get("head") != run_branch:
    raise SystemExit("recorded pullRequest metadata has the wrong base/head")
if pull_request.get("draft") is not True:
    raise SystemExit("recorded pullRequest must still be Draft before QA")

last_push = state.get("lastPush")
last_push_sha = last_push.get("sha") if isinstance(last_push, dict) else None
if not isinstance(last_push_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", last_push_sha):
    raise SystemExit("recorded lastPush.sha is missing or invalid")
if last_push.get("remote") != "origin" or last_push.get("branch") != run_branch:
    raise SystemExit("recorded lastPush metadata has the wrong remote or branch")
if last_push.get("status") != "passed":
    raise SystemExit("recorded lastPush status is not passed")

numbers = [int(task[1:]) for task in completed]
expected_current = f"T{numbers[-1] + 1:02d}" if numbers[-1] < 36 else None
status = state.get("status")
if status not in {"ready", "verification_required", "complete"}:
    raise SystemExit(f"loop status is not valid for QA: {status!r}")
if status == "ready":
    if expected_current is None or state.get("currentTask") != expected_current:
        raise SystemExit("ready state must have the next task after completedTasks")
elif expected_current is not None or state.get("currentTask") is not None:
    raise SystemExit(f"{status} state must have all T01..T36 completed and no currentTask")

task_range = new_tasks[0] if len(new_tasks) == 1 else f"{new_tasks[0]}..{new_tasks[-1]}"
print("\t".join((base_sha, last_push_sha, task_range, str(number), url)))
PY
  )"; then
    fail_preflight "$metadata"
  fi
  IFS=$'\t' read -r BASE_SHA LAST_PUSH_SHA TASK_RANGE PR_NUMBER PR_URL <<< "$metadata"
}

validate_published_head() {
  local remote_head
  git fetch origin "$RUN_BRANCH" >/dev/null 2>&1 ||
    fail_preflight "unable to fetch origin/$RUN_BRANCH"
  remote_head="$(git rev-parse --verify "refs/remotes/origin/$RUN_BRANCH^{commit}" 2>/dev/null)" ||
    fail_preflight "origin/$RUN_BRANCH is missing"
  [[ "$(git rev-parse HEAD)" == "$remote_head" ]] ||
    fail_preflight "local HEAD is not published to origin/$RUN_BRANCH"
  git merge-base --is-ancestor "$LAST_PUSH_SHA" "$remote_head" ||
    fail_preflight "lastPush.sha is not published in origin/$RUN_BRANCH history"
}

validate_git_range() {
  local current_base_sha
  local diff_stat

  current_base_sha="$(git rev-parse --verify "refs/remotes/origin/$BASE_BRANCH^{commit}" 2>/dev/null)" ||
    fail_preflight "origin/$BASE_BRANCH is missing"
  [[ "$current_base_sha" == "$BASE_SHA" ]] ||
    fail_preflight "origin/$BASE_BRANCH changed from recorded base $BASE_SHA to $current_base_sha"
  git merge-base --is-ancestor "$BASE_SHA" HEAD ||
    fail_preflight "checked-out branch is not based on recorded $BASE_BRANCH"
  git diff --quiet "origin/$BASE_BRANCH...HEAD" &&
    fail_preflight "the complete origin/$BASE_BRANCH...HEAD range is empty"
  git diff --check "origin/$BASE_BRANCH...HEAD" ||
    fail_preflight "the complete origin/$BASE_BRANCH...HEAD diff has whitespace errors"
  diff_stat="$(git diff --stat "origin/$BASE_BRANCH...HEAD")"
  printf 'Validated diff origin/%s...HEAD (%s):\n%s\n' "$BASE_BRANCH" "$TASK_RANGE" "$diff_stat"
  printf 'Validated commits:\n'
  git log --oneline "origin/$BASE_BRANCH..HEAD"
}

fetch_origin_base() {
  git fetch origin "$BASE_BRANCH" >/dev/null 2>&1 ||
    fail_preflight "unable to fetch origin/$BASE_BRANCH"
}

validate_pr_metadata() {
  local listed_prs
  local listed_metadata
  local viewed_pr
  local viewed_metadata

  listed_prs="$(gh pr list --head "$RUN_BRANCH" --base "$BASE_BRANCH" --state open \
    --json number,url,isDraft)" || fail_preflight "unable to query the recorded PR"
  if ! listed_metadata="$(python3 - "$listed_prs" "$PR_NUMBER" "$PR_URL" <<'PY'
import json
import sys

items = json.loads(sys.argv[1])
expected_number = int(sys.argv[2])
expected_url = sys.argv[3]
if not isinstance(items, list) or len(items) != 1:
    raise SystemExit("expected exactly one open PR for the batch base/head")
item = items[0]
if item.get("number") != expected_number or item.get("url") != expected_url:
    raise SystemExit("open PR does not match recorded PR metadata")
if item.get("isDraft") is not True:
    raise SystemExit("recorded PR is not Draft before QA")
print("ok")
PY
  )"; then
    fail_preflight "$listed_metadata"
  fi

  viewed_pr="$(gh pr view "$PR_NUMBER" --json number,url,isDraft,baseRefName,headRefName,body)" ||
    fail_preflight "unable to read PR #$PR_NUMBER metadata"
  if ! viewed_metadata="$(python3 - "$viewed_pr" "$PR_NUMBER" "$PR_URL" \
    "$BASE_BRANCH" "$RUN_BRANCH" <<'PY'
import json
import sys

pr = json.loads(sys.argv[1])
expected_number, expected_url, expected_base, expected_head = int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
if (
    pr.get("number") != expected_number
    or pr.get("url") != expected_url
    or pr.get("isDraft") is not True
    or pr.get("baseRefName") != expected_base
    or pr.get("headRefName") != expected_head
):
    raise SystemExit("PR metadata has the wrong base/head, URL, number, or Draft state")
print("ok")
PY
  )"; then
    fail_preflight "$viewed_metadata"
  fi
}

capture_tested_snapshot() {
  TESTED_HEAD_SHA="$(git rev-parse HEAD)"
  TESTED_STATE_SHA="$(git hash-object -- "$STATE_FILE")"
  TESTED_DIFF_SHA="$(git diff --binary "origin/$BASE_BRANCH...$TESTED_HEAD_SHA" | git hash-object --stdin)"
}

validate_final_readiness() {
  local current_base_sha
  local remote_head
  local remote_state_sha
  local current_diff_sha

  fetch_origin_base
  git fetch origin "$RUN_BRANCH" >/dev/null 2>&1 ||
    fail_preflight "unable to refetch origin/$RUN_BRANCH immediately before readiness"
  current_base_sha="$(git rev-parse --verify "refs/remotes/origin/$BASE_BRANCH^{commit}" 2>/dev/null)" ||
    fail_preflight "origin/$BASE_BRANCH is missing immediately before readiness"
  [[ "$current_base_sha" == "$BASE_SHA" ]] ||
    fail_preflight "origin/$BASE_BRANCH changed after QA began"
  [[ "$(git rev-parse HEAD)" == "$TESTED_HEAD_SHA" ]] ||
    fail_preflight "checked-out HEAD changed after QA completed"
  remote_head="$(git rev-parse --verify "refs/remotes/origin/$RUN_BRANCH^{commit}" 2>/dev/null)" ||
    fail_preflight "origin/$RUN_BRANCH is missing immediately before readiness"
  [[ "$remote_head" == "$TESTED_HEAD_SHA" ]] ||
    fail_preflight "origin/$RUN_BRANCH changed after QA completed"
  [[ "$(git hash-object -- "$STATE_FILE")" == "$TESTED_STATE_SHA" ]] ||
    fail_preflight "loop state changed after QA completed"
  remote_state_sha="$(git rev-parse "$remote_head:$STATE_FILE" 2>/dev/null)" ||
    fail_preflight "remote batch HEAD does not contain loop state"
  [[ "$remote_state_sha" == "$TESTED_STATE_SHA" ]] ||
    fail_preflight "published loop state changed after QA completed"
  current_diff_sha="$(git diff --binary "origin/$BASE_BRANCH...$TESTED_HEAD_SHA" | git hash-object --stdin)"
  [[ "$current_diff_sha" == "$TESTED_DIFF_SHA" ]] ||
    fail_preflight "tested batch diff changed after QA completed"
  read_batch_metadata
  validate_pr_metadata
}

build_browser_checklist() {
  CHECKLIST_FILE="$(mktemp "${TMPDIR:-/tmp}/ralph-browser-checklist.XXXXXX")"
  python3 - "$CHECKLIST_FILE" "$BATCH_ID" "$SCOPE_SLUG" "$TASK_RANGE" \
    "$BASE_BRANCH" "$RUN_BRANCH" "$TASKS_FILE" <<'PY'
import re
import sys

path, batch, scope, task_range, base, head, tasks_path = sys.argv[1:]
task_ids = task_range.split("..")
start = int(task_ids[0][1:])
end = int(task_ids[-1][1:])
selected = [f"T{number:02d}" for number in range(start, end + 1)]
with open(tasks_path, encoding="utf-8") as source:
    task_text = source.read()

lines = [
    f"Ralph browser QA checklist for {batch} ({scope})",
    f"Diff: origin/{base}...{head}",
    f"Task range: {task_range}",
    "",
    "- Start application from the checked-out batch branch.",
    "- Check affected flows at a desktop viewport.",
    "- Check affected flows at a mobile viewport.",
    "- Capture and investigate browser console errors.",
    "- Capture and investigate failed network requests.",
    "- Check loading, empty, and error states relevant to the affected flows.",
    "- Check keyboard access and visible focus for affected flows.",
    "- Check every affected acceptance criteria item below.",
    "",
    "Affected acceptance criteria:",
]
for task in selected:
    match = re.search(
        rf"^### {re.escape(task)}:.*?(?=^### |\Z)", task_text, re.MULTILINE | re.DOTALL
    )
    if not match:
        raise SystemExit(f"task definition is missing for {task}")
    section = match.group(0)
    lines.append(f"{task}:")
    in_done_when = False
    for line in section.splitlines():
        if line.startswith("**Done when**:"):
            in_done_when = True
            continue
        if in_done_when and line.startswith("**Tests**:"):
            break
        if in_done_when and line.startswith("- "):
            lines.append(line)

with open(path, "w", encoding="utf-8") as target:
    target.write("\n".join(lines) + "\n")
PY
}

app_port_from_url() {
  python3 - "$APP_URL" <<'PY'
from urllib.parse import urlparse
import sys

parsed = urlparse(sys.argv[1])
if parsed.scheme not in {"http", "https"} or not parsed.hostname:
    raise SystemExit("application URL must be an HTTP or HTTPS URL")
port = parsed.port or (443 if parsed.scheme == "https" else 80)
if not 1 <= port <= 65535:
    raise SystemExit("application URL port is outside the valid range")
print(port)
PY
}

app_descendant_pids() {
  local parent_pid="$1"
  local child_pid

  while read -r child_pid; do
    [[ -n "$child_pid" ]] || continue
    printf '%s\n' "$child_pid"
    app_descendant_pids "$child_pid"
  done < <(pgrep -P "$parent_pid" 2>/dev/null || true)
}

process_belongs_to_app() {
  local process_pid="$1"
  local parent_pid

  while [[ "$process_pid" =~ ^[0-9]+$ && "$process_pid" -gt 1 ]]; do
    [[ "$process_pid" == "$APP_PID" ]] && return 0
    parent_pid="$(ps -o ppid= -p "$process_pid" 2>/dev/null | tr -d ' ')"
    [[ "$parent_pid" =~ ^[0-9]+$ ]] || break
    process_pid="$parent_pid"
  done
  return 1
}

stop_app() {
  local descendant_pids
  local process_pid

  [[ -n "$APP_PID" ]] || return 0
  descendant_pids="$(app_descendant_pids "$APP_PID")"
  while read -r process_pid; do
    [[ "$process_pid" =~ ^[0-9]+$ ]] || continue
    kill "$process_pid" >/dev/null 2>&1 || true
  done <<< "$descendant_pids"
  kill "$APP_PID" >/dev/null 2>&1 || true
  wait "$APP_PID" >/dev/null 2>&1 || true
  APP_PID=""
}

wait_for_app() {
  [[ "$WAIT_FOR_APP" == true ]] || return 0
  command -v curl >/dev/null 2>&1 || {
    echo "curl is required to wait for the browser QA application." >&2
    exit 69
  }
  APP_PORT="$(app_port_from_url)" || {
    echo "Unable to determine the application port from $APP_URL." >&2
    exit 69
  }
  for _ in {1..30}; do
    if [[ -n "$APP_PID" ]] && ! kill -0 "$APP_PID" >/dev/null 2>&1; then
      echo "Browser QA application exited before becoming ready." >&2
      cat "$APP_LOG_FILE" >&2 || true
      exit 70
    fi
    app_listener_ready=false
    while read -r listener_pid; do
      if [[ "$listener_pid" =~ ^[0-9]+$ ]] && process_belongs_to_app "$listener_pid"; then
        app_listener_ready=true
        break
      fi
    done < <(lsof -nP -a -iTCP:"$APP_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ "$app_listener_ready" == true ]] &&
      curl --fail --silent --show-error "$APP_URL" >/dev/null 2>&1; then
      kill -0 "$APP_PID" >/dev/null 2>&1 || {
        echo "Browser QA application exited after becoming ready." >&2
        cat "$APP_LOG_FILE" >&2 || true
        exit 70
      }
      return 0
    fi
    sleep 1
  done
  echo "Browser QA application did not become ready at $APP_URL." >&2
  cat "$APP_LOG_FILE" >&2 || true
  exit 70
}

run_browser_qa() {
  [[ -n "$BROWSER_QA_COMMAND" ]] || {
    echo "Browser QA hook is required; set RALPH_BROWSER_QA_COMMAND or --browser-qa-command." >&2
    exit 69
  }
  build_browser_checklist
  APP_LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/ralph-browser-app.XXXXXX")"
  APP_PORT="$(app_port_from_url)" || {
    echo "Unable to determine the application port from $APP_URL." >&2
    exit 69
  }
  if [[ -n "$(lsof -nP -a -iTCP:"$APP_PORT" -sTCP:LISTEN -t 2>/dev/null || true)" ]]; then
    echo "Browser QA application port $APP_PORT is already in use; refusing to validate a preexisting server." >&2
    exit 70
  fi
  echo "=== Browser QA: starting application ==="
  bash -c "$START_COMMAND" >"$APP_LOG_FILE" 2>&1 &
  APP_PID=$!
  echo "Started browser QA application PID $APP_PID for $APP_URL"
  wait_for_app

  export RALPH_APP_URL="$APP_URL"
  export RALPH_BROWSER_VIEWPORTS
  export RALPH_BROWSER_QA_CHECKLIST="$CHECKLIST_FILE"
  export RALPH_QA_BATCH="$BATCH_ID"
  export RALPH_QA_SCOPE="$SCOPE_SLUG"
  export RALPH_QA_TASK_RANGE="$TASK_RANGE"
  export RALPH_QA_DIFF_BASE="origin/$BASE_BRANCH"
  export RALPH_QA_DIFF_HEAD="$RUN_BRANCH"
  echo "=== Browser QA: desktop/mobile, console/network, and acceptance criteria ==="
  if bash -c "$BROWSER_QA_COMMAND"; then
    :
  else
    local browser_status=$?
    echo "Browser QA hook failed with status $browser_status." >&2
    echo "Checklist: $CHECKLIST_FILE" >&2
    exit "$browser_status"
  fi
  require_clean_tree
}

run_gate() {
  local gate="$1"
  echo "=== QA gate: npm run $gate ==="
  if [[ "$gate" == build ]]; then
    if run_build_gate; then
      return 0
    else
      local gate_status=$?
      echo "First QA failure: npm run $gate (status $gate_status)." >&2
      echo "The PR remains Draft. Rerun: ./scripts/ralph-qa.sh --batch $BATCH_ID --scope $SCOPE" >&2
      return "$gate_status"
    fi
  elif npm run "$gate"; then
    return 0
  else
    local gate_status=$?
    echo "First QA failure: npm run $gate (status $gate_status)." >&2
    echo "The PR remains Draft. Rerun: ./scripts/ralph-qa.sh --batch $BATCH_ID --scope $SCOPE" >&2
    return "$gate_status"
  fi
}

run_build_gate() {
  local next_env_file="next-env.d.ts"
  local backup_file=""
  local build_status=0

  if git ls-files --error-unmatch -- "$next_env_file" >/dev/null 2>&1; then
    backup_file="$(mktemp "${TMPDIR:-/tmp}/ralph-next-env.XXXXXX")"
    cp "$next_env_file" "$backup_file"
  fi

  if npm run build; then
    build_status=0
  else
    build_status="$?"
  fi

  if [[ -n "$backup_file" ]]; then
    if ! cp "$backup_file" "$next_env_file"; then
      rm -f -- "$backup_file"
      echo "Unable to restore tracked $next_env_file after the build." >&2
      return 70
    fi
    rm -f -- "$backup_file"
  fi
  return "$build_status"
}

write_pr_body() {
  local qa_status="$1"
  PR_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/ralph-qa-pr-body.XXXXXX")"
  cat > "$PR_BODY_FILE" <<EOF
# Ralph batch $BATCH_ID

## Batch
- Scope: \`$SCOPE_SLUG\`
- Base: \`$BASE_BRANCH\`
- Head: \`$RUN_BRANCH\`
- Completed task range: \`$TASK_RANGE\`
- Published HEAD: \`$LAST_PUSH_SHA\`
- Independent QA: $qa_status

## Commit SHAs
$(git log --format='- `%H` %s' "origin/$BASE_BRANCH..HEAD")

## Gate Results
- \`npm run db:validate\`: passed
- \`npm run typecheck\`: passed
- \`npm run lint\`: passed
- \`npm run build\`: passed
- \`npm run test\`: passed
- \`npm run test:integration\`: passed
- \`npm run test:e2e\`: passed

## Push Status
- Status: passed
- Remote: \`origin\`
- Branch: \`$RUN_BRANCH\`
- Remote HEAD: \`$LAST_PUSH_SHA\`

## Known Risks
- Review scope drift and dependency assumptions before merge.
- Merge remains a manual maintainer action after review.

## QA Checklist
- [x] Recorded batch, branch, base, head, and Draft PR metadata match.
- [x] Complete \`origin/$BASE_BRANCH...HEAD\` diff and task range validated.
- [x] Database, typecheck, lint, build, unit, integration, and E2E gates passed.
- [x] Browser QA passed on desktop and mobile viewports.
- [x] Console, network, loading, empty, error, and keyboard checks passed.
- [x] Affected acceptance criteria were checked.
- [x] QA did not modify application files.
- [$([[ "$qa_status" == passed ]] && printf 'x' || printf ' ')] Final readiness revalidation passed.

QA does not merge this PR. Merge remains a manual maintainer action.
EOF
}

update_pr_and_ready() {
  write_pr_body "pending final readiness revalidation"
  echo "=== Updating PR #$PR_NUMBER with the passing QA checklist ==="
  if gh pr edit "$PR_NUMBER" --body-file "$PR_BODY_FILE"; then
    :
  else
    local edit_status=$?
    echo "Unable to update PR #$PR_NUMBER; it remains Draft." >&2
    exit "$edit_status"
  fi
  echo "=== Revalidating batch and PR immediately before marking #$PR_NUMBER ready ==="
  validate_final_readiness
  write_pr_body "passed"
  echo "=== Updating PR #$PR_NUMBER with the final passing QA checklist ==="
  if gh pr edit "$PR_NUMBER" --body-file "$PR_BODY_FILE"; then
    :
  else
    local final_edit_status=$?
    echo "Unable to update PR #$PR_NUMBER with the final QA result; it remains Draft." >&2
    exit "$final_edit_status"
  fi
  if gh pr ready "$PR_NUMBER"; then
    :
  else
    local ready_status=$?
    echo "Unable to mark PR #$PR_NUMBER ready; it remains Draft." >&2
    exit "$ready_status"
  fi
}

[[ "$BASE_BRANCH" == "dev" ]] || {
  echo "Task 5 QA requires --base-branch dev." >&2
  exit 64
}
[[ "$BATCH_ID" =~ ^L[0-9]{3}$ ]] || {
  echo "Invalid batch ID: $BATCH_ID (expected Lnnn)." >&2
  exit 64
}
if ! SCOPE_SLUG="$(normalize_scope "$SCOPE")"; then
  echo "Invalid scope: $SCOPE" >&2
  exit 64
fi
RUN_BRANCH="lote/${BATCH_ID}-${SCOPE_SLUG}"
[[ -f "$STATE_FILE" && -f "$TASKS_FILE" ]] || fail_preflight "loop governance files are missing"

require_clean_tree
require_commands
require_database_url
[[ "$(git branch --show-current)" == "$RUN_BRANCH" ]] ||
  fail_preflight "checked-out branch is not $RUN_BRANCH"
read_batch_metadata
fetch_origin_base
validate_published_head
validate_git_range
validate_pr_metadata
capture_tested_snapshot

for gate in db:validate typecheck lint build test test:integration test:e2e; do
  if run_gate "$gate"; then
    :
  else
    gate_status=$?
    exit "$gate_status"
  fi
  require_clean_tree
done

run_browser_qa
update_pr_and_ready
echo "QA passed for $BATCH_ID ($TASK_RANGE); PR #$PR_NUMBER is ready and was not merged."
