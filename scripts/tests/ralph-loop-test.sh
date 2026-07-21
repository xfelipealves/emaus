#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SETUP_SCRIPT="$ROOT_DIR/scripts/setup-ralph-branches.sh"
RALPH_LOOP_SCRIPT="$ROOT_DIR/scripts/ralph-loop.sh"
RALPH_QA_SCRIPT="$ROOT_DIR/scripts/ralph-qa.sh"
TASK_RUNNER_SCRIPT="$ROOT_DIR/scripts/run-emaus-task.sh"
TEST_ROOT=""
TEST_ROOTS=()
TEST_ENV_ROOT=""

cleanup_test_roots() {
  local test_root

  if [[ -n "$TEST_ENV_ROOT" ]]; then
    rm -rf "$TEST_ENV_ROOT"
  fi

  for test_root in "${TEST_ROOTS[@]-}"; do
    rm -rf "$test_root"
  done
}

trap cleanup_test_roots EXIT

TEST_ENV_ROOT="$(mktemp -d)"
TEST_HOME="$TEST_ENV_ROOT/home"
TEST_GIT_CONFIG_GLOBAL="$TEST_ENV_ROOT/gitconfig"
TEST_GIT_HOOKS="$TEST_ENV_ROOT/hooks"
mkdir -p "$TEST_HOME" "$TEST_GIT_HOOKS"
: > "$TEST_GIT_CONFIG_GLOBAL"

export HOME="$TEST_HOME"
export GIT_CONFIG_GLOBAL="$TEST_GIT_CONFIG_GLOBAL"
export GIT_CONFIG_NOSYSTEM=1
git config --global core.hooksPath "$TEST_GIT_HOOKS"
git config --global commit.gpgSign false
git config --global tag.gpgSign false

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_ref() {
  local repository="$1"
  local reference="$2"

  git -C "$repository" show-ref --verify --quiet "$reference" ||
    fail "expected $reference in $repository"
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local description="$3"

  [[ "$expected" == "$actual" ]] ||
    fail "$description (expected '$expected', got '$actual')"
}

state_value() {
  python3 - "$1" "$2" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    state = json.load(source)

value = state
for key in sys.argv[2].split('.'):
    value = value[key]
if isinstance(value, (dict, list)):
    print(json.dumps(value, sort_keys=True))
else:
    print(value)
PY
}

run_qa_metadata_rejection_case() {
  local case_name="$1"
  local mutation="$2"
  local remote="$3"
  local branch_name="$4"
  local fake_bin="$5"
  local test_root="$6"
  local invalid_work="$test_root/${case_name}-work"
  local valid_state="$test_root/${case_name}-valid-state.json"
  local output

  git clone "$remote" "$invalid_work" >/dev/null
  git -C "$invalid_work" config user.name 'Ralph Test'
  git -C "$invalid_work" config user.email 'ralph-test@example.invalid'
  git -C "$invalid_work" switch -c "$branch_name" "origin/$branch_name" >/dev/null
  cp "$invalid_work/.specs/loop-state.json" "$valid_state"
  python3 - "$invalid_work/.specs/loop-state.json" "$mutation" <<'PY'
import json
import sys

path, mutation = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    state = json.load(source)

if mutation == "sequence-gap":
    state["completedTasks"] = ["T01", "T03"]
    state["currentTask"] = "T04"
elif mutation == "ready-wrong-current":
    state["currentTask"] = "T04"
elif mutation == "complete-incomplete":
    state["status"] = "complete"
    state["currentTask"] = None
else:
    state["status"] = mutation

with open(path, "w", encoding="utf-8") as target:
    json.dump(state, target, indent=2)
    target.write("\n")
PY
  git -C "$invalid_work" add .specs/loop-state.json
  git -C "$invalid_work" commit -m "test: create invalid QA state $case_name" >/dev/null
  git -C "$invalid_work" push origin "$branch_name" >/dev/null

  if output="$(cd "$invalid_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail "QA must reject invalid metadata state $case_name"
  fi
  [[ "$output" == *'QA preflight failed'* ]] ||
    fail "invalid metadata state $case_name should fail during QA preflight: $output"

  cp "$valid_state" "$invalid_work/.specs/loop-state.json"
  git -C "$invalid_work" add .specs/loop-state.json
  git -C "$invalid_work" commit -m "test: restore valid QA state $case_name" >/dev/null
  git -C "$invalid_work" push origin "$branch_name" >/dev/null
}

run_setup_case() {
  [[ -f "$SETUP_SCRIPT" ]] || fail "missing setup script: $SETUP_SCRIPT"

  local remote
  local source
  local work
  local first_refs
  local second_refs
  local dirty_refs
  local dirty_output
  local push_failure_output
  local push_failure_status
  local remote_failure_output
  local fake_git
  local real_git

  TEST_ROOT="$(mktemp -d)"
  TEST_ROOTS+=("$TEST_ROOT")

  remote="$TEST_ROOT/remote.git"
  source="$TEST_ROOT/source"
  work="$TEST_ROOT/work"

  git init --bare "$remote" >/dev/null
  git init -b main "$source" >/dev/null
  git -C "$source" config user.name 'Ralph Test'
  git -C "$source" config user.email 'ralph-test@example.invalid'
  printf 'Ralph setup test\n' > "$source/README.md"
  mkdir -p "$source/scripts"
  cp "$SETUP_SCRIPT" "$source/scripts/setup-ralph-branches.sh"
  chmod +x "$source/scripts/setup-ralph-branches.sh"
  git -C "$source" add README.md scripts/setup-ralph-branches.sh
  git -C "$source" commit -m 'test: seed main branch' >/dev/null
  git -C "$source" remote add origin "$remote"
  git -C "$source" push -u origin main >/dev/null
  git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
  git clone "$remote" "$work" >/dev/null

  git -C "$work" config user.name 'Ralph Test'
  git -C "$work" config user.email 'ralph-test@example.invalid'

  real_git="$(command -v git)"
  fake_git="$TEST_ROOT/fake-bin/git"
  mkdir -p "$(dirname "$fake_git")"
  {
    printf '%s\n' '#!/usr/bin/env bash'
    printf '%s\n' 'if [[ "${1:-}" == "push" && "$*" == *" origin dev" ]]; then'
    printf '%s\n' '  printf "simulated dev push failure\n" >&2'
    printf '%s\n' '  exit 73'
    printf '%s\n' 'fi'
    printf 'exec %q "$@"\n' "$real_git"
  } > "$fake_git"
  chmod +x "$fake_git"
  if push_failure_output="$(cd "$work" && PATH="$(dirname "$fake_git"):$PATH" ./scripts/setup-ralph-branches.sh 2>&1)"; then
    fail 'setup must reject a failed initial dev push'
  else
    push_failure_status="$?"
  fi
  assert_equal '73' "$push_failure_status" \
    'setup must return the original dev push failure status'
  [[ "$push_failure_output" == *'simulated dev push failure'* ]] ||
    fail 'initial dev push failure should be preserved in the output'
  if git -C "$work" show-ref --verify --quiet refs/heads/dev; then
    fail 'failed initial dev push must remove only the newly-created local dev branch'
  fi

  "$work/scripts/setup-ralph-branches.sh" >/dev/null

  assert_ref "$work" refs/remotes/origin/main
  assert_ref "$work" refs/remotes/origin/dev
  assert_ref "$work" refs/heads/main
  assert_ref "$work" refs/heads/dev
  assert_equal "$(git -C "$work" rev-parse refs/heads/main)" \
    "$(git -C "$work" rev-parse refs/heads/dev)" \
    'dev must start at main'

  first_refs="$(git -C "$work" for-each-ref --format='%(refname) %(objectname)' refs/heads refs/remotes/origin)"
  "$work/scripts/setup-ralph-branches.sh" >/dev/null
  second_refs="$(git -C "$work" for-each-ref --format='%(refname) %(objectname)' refs/heads refs/remotes/origin)"
  assert_equal "$first_refs" "$second_refs" 'second setup run must be idempotent'

  {
    printf '%s\n' '#!/usr/bin/env bash'
    printf '%s\n' 'if [[ "${1:-}" == "ls-remote" ]]; then'
    printf '%s\n' '  printf "simulated remote lookup failure\\n" >&2'
    printf '%s\n' '  exit 1'
    printf '%s\n' 'fi'
    printf 'exec %q "$@"\n' "$real_git"
  } > "$fake_git"
  chmod +x "$fake_git"
  if remote_failure_output="$(cd "$work" && PATH="$(dirname "$fake_git"):$PATH" ./scripts/setup-ralph-branches.sh 2>&1)"; then
    fail 'setup must reject a failed remote dev lookup'
  fi
  [[ "$remote_failure_output" == *'unable to query origin/dev'* ]] ||
    fail 'remote lookup failure should explain that origin/dev could not be queried'

  printf 'uncommitted change\n' > "$work/dirty.txt"
  if dirty_output="$(cd "$work" && ./scripts/setup-ralph-branches.sh 2>&1)"; then
    fail 'setup must reject a dirty checkout'
  fi
  [[ "$dirty_output" == *'working tree is not clean'* ]] ||
    fail 'dirty checkout failure should explain the clean-tree requirement'
  dirty_refs="$(git -C "$work" for-each-ref --format='%(refname) %(objectname)' refs/heads refs/remotes/origin)"
  assert_equal "$first_refs" "$dirty_refs" \
    'dirty checkout rejection must not change branch refs'

  printf 'PASS: setup\n'
}

run_existing_remote_dev_case() {
  [[ -f "$SETUP_SCRIPT" ]] || fail "missing setup script: $SETUP_SCRIPT"

  local remote
  local source
  local work
  local remote_dev_sha
  local remote_dev_after_sha
  local local_dev_sha
  local upstream
  local stale_output
  local untracked_output

  TEST_ROOT="$(mktemp -d)"
  TEST_ROOTS+=("$TEST_ROOT")

  remote="$TEST_ROOT/remote.git"
  source="$TEST_ROOT/source"
  work="$TEST_ROOT/work"

  git init --bare "$remote" >/dev/null
  git init -b main "$source" >/dev/null
  git -C "$source" config user.name 'Ralph Test'
  git -C "$source" config user.email 'ralph-test@example.invalid'
  printf 'Ralph existing remote test\n' > "$source/README.md"
  mkdir -p "$source/scripts"
  cp "$SETUP_SCRIPT" "$source/scripts/setup-ralph-branches.sh"
  chmod +x "$source/scripts/setup-ralph-branches.sh"
  git -C "$source" add README.md scripts/setup-ralph-branches.sh
  git -C "$source" commit -m 'test: seed main branch' >/dev/null
  git -C "$source" remote add origin "$remote"
  git -C "$source" push -u origin main >/dev/null
  git -C "$source" switch -c dev >/dev/null
  printf 'Existing dev branch\n' > "$source/DEV.md"
  git -C "$source" add DEV.md
  git -C "$source" commit -m 'test: seed dev branch' >/dev/null
  git -C "$source" push -u origin dev >/dev/null
  git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
  git clone "$remote" "$work" >/dev/null

  git -C "$work" config user.name 'Ralph Test'
  git -C "$work" config user.email 'ralph-test@example.invalid'
  remote_dev_sha="$(git --git-dir="$remote" rev-parse refs/heads/dev)"

  "$work/scripts/setup-ralph-branches.sh" >/dev/null

  assert_ref "$work" refs/remotes/origin/dev
  assert_ref "$work" refs/heads/dev
  local_dev_sha="$(git -C "$work" rev-parse refs/heads/dev)"
  upstream="$(git -C "$work" rev-parse --abbrev-ref dev@{upstream})"
  remote_dev_after_sha="$(git --git-dir="$remote" rev-parse refs/heads/dev)"
  assert_equal "$remote_dev_sha" "$local_dev_sha" \
    'existing remote dev must create local dev at the same commit'
  assert_equal 'origin/dev' "$upstream" \
    'local dev must track origin/dev when the remote branch already exists'
  assert_equal "$remote_dev_sha" "$remote_dev_after_sha" \
    'setup must not change the existing remote dev commit'

  git -C "$source" switch dev >/dev/null
  printf 'Updated existing remote dev branch\n' > "$source/DEV-UPDATE.md"
  git -C "$source" add DEV-UPDATE.md
  git -C "$source" commit -m 'test: advance dev branch' >/dev/null
  git -C "$source" push origin dev >/dev/null
  git -C "$work" switch main >/dev/null

  if stale_output="$(cd "$work" && ./scripts/setup-ralph-branches.sh 2>&1)"; then
    fail 'setup must reject a local dev branch that no longer matches origin/dev'
  fi
  [[ "$stale_output" == *'local dev does not match origin/dev'* ]] ||
    fail 'stale local dev failure should explain the branch mismatch'

  git -C "$work" branch -f dev refs/remotes/origin/dev
  git -C "$work" config --unset branch.dev.remote || true
  git -C "$work" config --unset branch.dev.merge || true
  if untracked_output="$(cd "$work" && ./scripts/setup-ralph-branches.sh 2>&1)"; then
    fail 'setup must reject a local dev branch without origin/dev upstream'
  fi
  [[ "$untracked_output" == *'local dev must track origin/dev'* ]] ||
    fail 'untracked local dev failure should explain the upstream requirement'

  printf 'PASS: existing remote dev\n'
}

run_branch_init_case() {
  [[ -f "$RALPH_LOOP_SCRIPT" ]] || fail "missing loop script: $RALPH_LOOP_SCRIPT"
  [[ -f "$TASK_RUNNER_SCRIPT" ]] || fail "missing task runner: $TASK_RUNNER_SCRIPT"

  local remote
  local source
  local work
  local dirty_work
  local fake_bin
  local remote_dev_sha
  local created_sha
  local initial_output
  local initial_status
  local collision_output
  local collision_status
  local resume_output
  local resume_status
  local checked_out_output
  local checked_out_status
  local metadata_output
  local metadata_status
  local branch_name='lote/L001-m3-auth-access'

  TEST_ROOT="$(mktemp -d)"
  TEST_ROOTS+=("$TEST_ROOT")

  remote="$TEST_ROOT/remote.git"
  source="$TEST_ROOT/source"
  work="$TEST_ROOT/work"
  dirty_work="$TEST_ROOT/dirty-work"
  fake_bin="$TEST_ROOT/fake-bin"

  git init --bare "$remote" >/dev/null
  git init -b main "$source" >/dev/null
  git -C "$source" config user.name 'Ralph Test'
  git -C "$source" config user.email 'ralph-test@example.invalid'
  printf 'Ralph loop branch init test\n' > "$source/README.md"
  mkdir -p "$source/scripts" "$source/.specs/features/emaus-mvp"
  cp "$RALPH_LOOP_SCRIPT" "$source/scripts/ralph-loop.sh"
  cp "$TASK_RUNNER_SCRIPT" "$source/scripts/run-emaus-task.sh"
  chmod +x "$source/scripts/ralph-loop.sh" "$source/scripts/run-emaus-task.sh"
  cat > "$source/.specs/loop-state.json" <<'EOF'
{
  "schemaVersion": 1,
  "feature": "emaus-mvp",
  "status": "ready",
  "currentTask": "T12",
  "completedTasks": ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11"],
  "completedMilestones": [],
  "lastCommit": "1111111111111111111111111111111111111111",
  "lastGate": {
    "command": "test gate",
    "result": "passed"
  },
  "updatedAt": "2026-07-21",
  "notes": "Preserve this sequencing data."
}
EOF
  printf '%s\n' '# Ralph test tasks' '### T12: Test branch initialization' > \
    "$source/.specs/features/emaus-mvp/tasks.md"
  git -C "$source" add README.md scripts .specs
  git -C "$source" commit -m 'test: seed main branch' >/dev/null
  git -C "$source" remote add origin "$remote"
  git -C "$source" push -u origin main >/dev/null
  git -C "$source" switch -c dev >/dev/null
  printf 'Ralph dev base\n' > "$source/DEV.md"
  git -C "$source" add DEV.md
  git -C "$source" commit -m 'test: seed dev branch' >/dev/null
  git -C "$source" push -u origin dev >/dev/null
  git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
  git clone "$remote" "$work" >/dev/null
  git clone "$remote" "$dirty_work" >/dev/null

  for repository in "$work" "$dirty_work"; do
    git -C "$repository" config user.name 'Ralph Test'
    git -C "$repository" config user.email 'ralph-test@example.invalid'
  done

  mkdir -p "$fake_bin"
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > "$fake_bin/opencode"
  chmod +x "$fake_bin/opencode"
  cat > "$fake_bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == 'auth' && "${2:-}" == 'status' ]]; then
  exit 0
fi
if [[ "${1:-}" == 'pr' && "${2:-}" == 'list' ]]; then
  if [[ -f "${RALPH_TEST_PR_EXISTS:?}" ]]; then
    printf '[{"number":1,"url":"https://github.com/example/emaus/pull/1","isDraft":true}]\n'
  else
    printf '[]\n'
  fi
  exit 0
fi
if [[ "${1:-}" == 'pr' && "${2:-}" == 'create' ]]; then
  touch "${RALPH_TEST_PR_EXISTS:?}"
  printf 'https://github.com/example/emaus/pull/1\n'
  exit 0
fi
exit 0
EOF
  chmod +x "$fake_bin/gh"
  export RALPH_TEST_PR_EXISTS="$TEST_ROOT/pr-exists"
  remote_dev_sha="$(git --git-dir="$remote" rev-parse refs/heads/dev)"

  if initial_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L001 --scope 'M3 Auth/Access' --max-tasks 1 2>&1)"; then
    fail 'new batch initialization should stop when the fake executor creates no commit'
  else
    initial_status="$?"
  fi
  assert_equal '68' "$initial_status" \
    'initialization case should reach the task commit requirement'
  assert_equal "$branch_name" "$(git -C "$work" branch --show-current)" \
    'new batch should check out the normalized branch'
  created_sha="$(git -C "$work" rev-parse HEAD)"
  git -C "$work" merge-base --is-ancestor "$remote_dev_sha" "$created_sha" ||
    fail 'new batch metadata commit must remain based on the exact origin/dev tip'
  assert_equal 'L001' "$(state_value "$work/.specs/loop-state.json" batch)" \
    'state should persist the batch ID'
  assert_equal 'm3-auth-access' "$(state_value "$work/.specs/loop-state.json" scope)" \
    'state should persist the normalized scope'
  assert_equal 'dev' "$(state_value "$work/.specs/loop-state.json" baseBranch)" \
    'state should persist the base branch'
  assert_equal "$branch_name" "$(state_value "$work/.specs/loop-state.json" runBranch)" \
    'state should persist the run branch'
  assert_equal "$remote_dev_sha" "$(state_value "$work/.specs/loop-state.json" baseSha)" \
    'state should persist the exact base SHA'
  assert_equal 'T12' "$(state_value "$work/.specs/loop-state.json" currentTask)" \
    'state should preserve the current task'
  assert_equal 'ready' "$(state_value "$work/.specs/loop-state.json" status)" \
    'state should preserve the loop status'
  assert_equal '1111111111111111111111111111111111111111' \
    "$(state_value "$work/.specs/loop-state.json" lastCommit)" \
    'state should preserve the last task commit'
  [[ "$initial_output" == *'starting T12'* ]] ||
    fail 'initialization case should reach the existing task sequencing checks'

  if collision_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L001 --scope m3-auth-access --max-tasks 1 2>&1)"; then
    fail 'existing batch branch should be rejected without --resume'
  else
    collision_status="$?"
  fi
  assert_equal '66' "$collision_status" 'batch collision should be rejected'
  [[ "$collision_output" == *'already exists'* ]] ||
    fail 'batch collision should explain that the branch already exists'

  if resume_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L001 --scope m3-auth-access --resume --max-tasks 1 2>&1)"; then
    fail 'valid resume should still stop when the fake executor creates no commit'
  else
    resume_status="$?"
  fi
  assert_equal '68' "$resume_status" "valid resume should reach task execution (got '$resume_output')"
  [[ "$resume_output" == *'starting T12'* ]] ||
    fail 'valid resume should pass branch metadata validation'

  git -C "$work" switch main >/dev/null
  if checked_out_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L001 --scope m3-auth-access --resume --max-tasks 1 2>&1)"; then
    fail 'resume from the wrong checked-out branch should be rejected'
  else
    checked_out_status="$?"
  fi
  assert_equal '66' "$checked_out_status" 'resume should require the recorded branch'
  [[ "$checked_out_output" == *'checked-out branch'* ]] ||
    fail 'wrong-branch resume should explain the checked-out branch requirement'
  git -C "$work" switch "$branch_name" >/dev/null

  python3 - "$work/.specs/loop-state.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as source:
    state = json.load(source)
state["scope"] = "other-scope"
with open(path, "w", encoding="utf-8") as target:
    json.dump(state, target, indent=2)
    target.write("\n")
PY
  git -C "$work" add .specs/loop-state.json
  git -C "$work" commit -m 'test: corrupt batch metadata' >/dev/null
  if metadata_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L001 --scope m3-auth-access --resume --max-tasks 1 2>&1)"; then
    fail 'resume with mismatched stored metadata should be rejected'
  else
    metadata_status="$?"
  fi
  assert_equal '66' "$metadata_status" 'resume metadata mismatch should be rejected'
  [[ "$metadata_output" == *'metadata does not match'* ]] ||
    fail 'metadata mismatch should explain the resume validation failure'

  printf 'uncommitted change\n' > "$dirty_work/dirty.txt"
  if dirty_output="$(cd "$dirty_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L002 --scope dirty-check --max-tasks 1 2>&1)"; then
    fail 'dirty checkout should be rejected before batch branch creation'
  fi
  [[ "$dirty_output" == *'working tree is not clean'* ]] ||
    fail 'dirty checkout should explain the clean-tree requirement'
  if git -C "$dirty_work" show-ref --verify --quiet refs/heads/lote/L002-dirty-check; then
    fail 'dirty checkout must not create a batch branch'
  fi

  printf 'PASS: branch initialization\n'
}

run_push_case() {
  [[ -f "$RALPH_LOOP_SCRIPT" ]] || fail "missing loop script: $RALPH_LOOP_SCRIPT"
  [[ -f "$TASK_RUNNER_SCRIPT" ]] || fail "missing task runner: $TASK_RUNNER_SCRIPT"

  local remote
  local source
  local work
  local failure_work
  local pr_failure_work
  local post_task_failure_work
  local fresh_work
  local fake_bin
  local real_git
  local push_log
  local failure_push_log
  local post_task_push_log
  local gh_log
  local event_log
  local execution_pr_log
  local gh_pr_exists
  local gh_body
  local opencode_calls
  local failure_opencode_calls
  local branch_name='lote/L003-push-order'
  local failure_branch_name='lote/L004-push-failure'
  local success_output
  local failure_output
  local failure_status
  local recovery_output
  local recovery_status
  local remote_dev_sha
  local local_head
  local remote_head
  local last_push_sha
  local remote_branch_status
  local push_first
  local push_second
  local recovery_push_first
  local recovery_push_second
  local recovery_push_third
  local resume_output
  local pr_failure_output
  local pr_failure_status
  local pr_failure_calls
  local post_task_calls
  local extra_commit_status
  local post_task_failure_output
  local post_task_failure_status
  local post_task_recovery_output
  local fetch_failure_output
  local fetch_failure_status
  local before_fetch_opencode_calls

  TEST_ROOT="$(mktemp -d)"
  TEST_ROOTS+=("$TEST_ROOT")

  remote="$TEST_ROOT/remote.git"
  source="$TEST_ROOT/source"
  work="$TEST_ROOT/work"
  failure_work="$TEST_ROOT/failure-work"
  pr_failure_work="$TEST_ROOT/pr-failure-work"
  post_task_failure_work="$TEST_ROOT/post-task-failure-work"
  fresh_work="$TEST_ROOT/fresh-work"
  fake_bin="$TEST_ROOT/fake-bin"
  push_log="$TEST_ROOT/push.log"
  failure_push_log="$TEST_ROOT/failure-push.log"
  post_task_push_log="$TEST_ROOT/post-task-push.log"
  gh_log="$TEST_ROOT/gh.log"
  event_log="$TEST_ROOT/events.log"
  execution_pr_log="$TEST_ROOT/execution-pr.log"
  gh_pr_exists="$TEST_ROOT/gh-pr-exists"
  gh_body="$TEST_ROOT/gh-body.md"
  pr_failure_calls="$TEST_ROOT/pr-failure-opencode-calls.log"
  post_task_calls="$TEST_ROOT/post-task-opencode-calls.log"
  opencode_calls="$TEST_ROOT/opencode-calls.log"
  failure_opencode_calls="$TEST_ROOT/failure-opencode-calls.log"
  mkdir -p "$fake_bin"
  : > "$push_log"
  : > "$failure_push_log"
  : > "$post_task_push_log"
  : > "$gh_log"
  : > "$event_log"
  : > "$execution_pr_log"
  : > "$gh_body"
  : > "$pr_failure_calls"
  : > "$post_task_calls"
  rm -f "$gh_pr_exists"
  : > "$opencode_calls"
  : > "$failure_opencode_calls"

  git init --bare "$remote" >/dev/null
  git init -b main "$source" >/dev/null
  git -C "$source" config user.name 'Ralph Test'
  git -C "$source" config user.email 'ralph-test@example.invalid'
  printf 'Ralph push test\n' > "$source/README.md"
  mkdir -p "$source/scripts" "$source/.specs/features/emaus-mvp"
  cp "$RALPH_LOOP_SCRIPT" "$source/scripts/ralph-loop.sh"
  cp "$TASK_RUNNER_SCRIPT" "$source/scripts/run-emaus-task.sh"
  chmod +x "$source/scripts/ralph-loop.sh" "$source/scripts/run-emaus-task.sh"
  cat > "$source/.specs/loop-state.json" <<'EOF'
{
  "schemaVersion": 1,
  "feature": "emaus-mvp",
  "status": "ready",
  "currentTask": "T12",
  "completedTasks": ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11"],
  "completedMilestones": [],
  "lastCommit": "1111111111111111111111111111111111111111",
  "lastGate": {
    "command": "test gate",
    "result": "passed"
  },
  "updatedAt": "2026-07-21",
  "notes": "Preserve this sequencing data."
}
EOF
  printf '%s\n' '# Ralph push test tasks' \
    '### T12: First push task' \
    '### T13: Second push task' \
    '### T14: Resume push task' \
    '### T15: Commit integrity task' > "$source/.specs/features/emaus-mvp/tasks.md"
  git -C "$source" add README.md scripts .specs
  git -C "$source" commit -m 'test: seed main branch' >/dev/null
  git -C "$source" remote add origin "$remote"
  git -C "$source" push -u origin main >/dev/null
  git -C "$source" switch -c dev >/dev/null
  printf 'Ralph dev base\n' > "$source/DEV.md"
  git -C "$source" add DEV.md
  git -C "$source" commit -m 'test: seed dev branch' >/dev/null
  git -C "$source" push -u origin dev >/dev/null
  git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
  git clone "$remote" "$work" >/dev/null
  git clone "$remote" "$failure_work" >/dev/null
  git clone "$remote" "$pr_failure_work" >/dev/null
  git clone "$remote" "$post_task_failure_work" >/dev/null

  for repository in "$work" "$failure_work" "$pr_failure_work" "$post_task_failure_work"; do
    git -C "$repository" config user.name 'Ralph Test'
    git -C "$repository" config user.email 'ralph-test@example.invalid'
  done
  remote_dev_sha="$(git --git-dir="$remote" rev-parse refs/heads/dev)"

  cat > "$fake_bin-opencode" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

state='.specs/loop-state.json'
task="$(python3 - "$state" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(json.load(source)['currentTask'])
PY
)"
if [[ "${RALPH_TEST_REQUIRE_PR_FOR_EXECUTION:-false}" == 'true' &&
  ! -f "${RALPH_TEST_PR_EXISTS:?}" ]]; then
  printf 'executor must not run before PR setup\n' >&2
  exit 75
fi
next_task="$(python3 - "$task" <<'PY'
import re
import sys

number = int(re.fullmatch(r'T(\d+)', sys.argv[1]).group(1))
print(f'T{number + 1:02d}')
PY
)"

printf '%s\n' "$task" >> "${RALPH_TEST_OPENCODE_CALLS:?}"
if [[ -n "${RALPH_TEST_EXECUTION_PR_LOG:-}" ]]; then
  if [[ -f "${RALPH_TEST_PR_EXISTS:?}" ]]; then
    pr_exists=true
  else
    pr_exists=false
  fi
  printf '%s|%s\n' "$task" "$pr_exists" >> "$RALPH_TEST_EXECUTION_PR_LOG"
fi
printf 'task %s\n' "$task" > "task-${task}.txt"
python3 - "$state" "$task" "$next_task" <<'PY'
import datetime
import json
import sys

path, task, next_task = sys.argv[1:]
with open(path, encoding='utf-8') as source:
    state = json.load(source)
state['completedTasks'].append(task)
state['currentTask'] = next_task
state['status'] = 'ready'
state['lastCommit'] = f'executor-{task}'
state['lastGate'] = {'command': 'test gate', 'result': 'passed'}
state['updatedAt'] = datetime.date.today().isoformat()
with open(path, 'w', encoding='utf-8') as target:
    json.dump(state, target, indent=2)
    target.write('\n')
PY
git add task-${task}.txt .specs/loop-state.json
git commit -m "test: execute ${task}" >/dev/null
if [[ "${RALPH_TEST_EXTRA_COMMIT:-false}" == 'true' ]]; then
  printf 'unexpected extra commit\n' > "extra-${task}.txt"
  git add "extra-${task}.txt"
  git commit -m "test: unexpected extra commit for ${task}" >/dev/null
fi
EOF
  mv "$fake_bin-opencode" "$fake_bin/opencode"
  chmod +x "$fake_bin/opencode"

  real_git="$(command -v git)"
  export RALPH_TEST_REAL_GIT="$real_git"
  cat > "$fake_bin/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

real_git="${RALPH_TEST_REAL_GIT:?}"
if [[ "${1:-}" == 'push' ]]; then
  state='.specs/loop-state.json'
  head="$($real_git rev-parse HEAD)"
  status="$($real_git status --porcelain)"
  commit_message="$($real_git log -1 --format=%s)"
  current_task="$(python3 - "$state" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(json.load(source)['currentTask'])
PY
)"
  printf 'push=%s|head=%s|status=%s|commit=%s|current=%s\n' \
    "$*" "$head" "$status" "$commit_message" "$current_task" \
    >> "${RALPH_TEST_PUSH_LOG:?}"
  if [[ -n "${RALPH_TEST_EVENT_LOG:-}" ]]; then
    printf 'git-push|commit=%s|current=%s\n' "$commit_message" "$current_task" \
      >> "$RALPH_TEST_EVENT_LOG"
  fi
fi
exec "$real_git" "$@"
EOF
  chmod +x "$fake_bin/git"

  cat > "$fake_bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf 'gh=%s\n' "$*" >> "${RALPH_TEST_GH_LOG:?}"
if [[ -n "${RALPH_TEST_EVENT_LOG:-}" ]]; then
  printf 'gh|%s\n' "$*" >> "$RALPH_TEST_EVENT_LOG"
fi
if [[ "${1:-}" == 'auth' && "${2:-}" == 'status' ]]; then
  exit 0
fi
if [[ "${1:-}" != 'pr' ]]; then
  exit 64
fi
body_file=""
for ((index = 1; index <= $#; index++)); do
  if [[ "${!index}" == '--body-file' ]]; then
    next_index=$((index + 1))
    body_file="${!next_index}"
  fi
done
if [[ -n "$body_file" ]]; then
  cp "$body_file" "${RALPH_TEST_PR_BODY:?}"
fi
case "${2:-}" in
  list)
    if [[ "${RALPH_TEST_PR_LIST_FAIL_AFTER_TASK:-false}" == 'true' ]] &&
      python3 - .specs/loop-state.json <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    state = json.load(source)
raise SystemExit(0 if 'T12' in state.get('completedTasks', []) else 1)
PY
    then
      printf 'simulated post-task PR validation failure\n' >&2
      exit 79
    fi
    if [[ "${RALPH_TEST_PR_COUNT:-1}" == '2' ]]; then
      printf '[{"number":42,"url":"https://github.com/example/emaus/pull/42","isDraft":true},{"number":43,"url":"https://github.com/example/emaus/pull/43","isDraft":true}]\n'
    elif [[ -f "${RALPH_TEST_PR_EXISTS:?}" ]]; then
      printf '[{"number":42,"url":"https://github.com/example/emaus/pull/42","isDraft":%s}]\n' \
        "${RALPH_TEST_PR_DRAFT:-true}"
    else
      printf '[]\n'
    fi
    ;;
  create)
    if [[ "${RALPH_TEST_PR_CREATE_FAIL:-false}" == 'true' ]]; then
      printf 'simulated Draft PR creation failure\n' >&2
      exit 74
    fi
    touch "${RALPH_TEST_PR_EXISTS:?}"
    printf 'https://github.com/example/emaus/pull/42\n'
    ;;
  edit)
    ;;
  *)
    exit 64
    ;;
esac
EOF
  chmod +x "$fake_bin/gh"

  export RALPH_TEST_PUSH_LOG="$push_log"
  export RALPH_TEST_OPENCODE_CALLS="$opencode_calls"
  export RALPH_TEST_GH_LOG="$gh_log"
  export RALPH_TEST_EVENT_LOG="$event_log"
  export RALPH_TEST_EXECUTION_PR_LOG="$execution_pr_log"
  export RALPH_TEST_PR_EXISTS="$gh_pr_exists"
  export RALPH_TEST_PR_BODY="$gh_body"
  export RALPH_TEST_PR_CREATE_FAIL=false
  export RALPH_TEST_PR_LIST_FAIL_AFTER_TASK=false
  export RALPH_TEST_REQUIRE_PR_FOR_EXECUTION=false
  if ! success_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --max-tasks 2 2>&1)"; then
    fail "push-order case should complete successfully: $success_output"
  fi

  assert_equal '5' "$(wc -l < "$push_log" | tr -d ' ')" \
    'push-order case must publish initialization, task, and metadata commits'
  push_first="$(python3 - "$push_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    for line in source:
        if '|current=T13' in line:
            print(line.rstrip('\n'))
            break
PY
)"
  push_second="$(python3 - "$push_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    for line in source:
        if '|current=T14' in line:
            print(line.rstrip('\n'))
            break
PY
)"
  [[ "$push_first" == "push=push origin $branch_name|head="*"|status= M .specs/loop-state.json|commit=test: execute T12|current=T13" ]] ||
    fail "first task commit push must precede PR setup (got '$push_first')"
  [[ "$push_second" == "push=push origin $branch_name|head="*"|status= M .specs/loop-state.json|commit=test: execute T13|current=T14" ]] ||
    fail 'later task commit push must precede its metadata publication'
  [[ "$push_first" != *'--force'* && "$push_second" != *'--force'* ]] ||
    fail 'task pushes must never force-update the batch branch'
  assert_equal '2' "$(wc -l < "$opencode_calls" | tr -d ' ')" \
    'push-order case must execute both tasks'
  assert_equal '5' "$(git -C "$work" rev-list --count "$remote_dev_sha..HEAD")" \
    'each task iteration must create one task commit plus one governed metadata commit'
  assert_equal $'T12|false\nT13|true' "$(tr -d '\r' < "$execution_pr_log")" \
    'the first task must execute before PR creation and later tasks must reuse the PR'
  python3 - "$event_log" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    events = [line.rstrip("\n") for line in source]
task_push = next(index for index, event in enumerate(events) if
                 event.startswith("git-push|commit=test: execute T12|"))
pr_create = next(index for index, event in enumerate(events) if
                 event.startswith("gh|pr create --draft --base dev --head lote/L003-push-order --title [L003] push-order --body-file"))
if task_push >= pr_create:
    raise SystemExit("Draft PR must be created only after the first task commit push")
PY
  assert_equal $'T01\nT02\nT03\nT04\nT05\nT06\nT07\nT08\nT09\nT10\nT11\nT12\nT13' \
    "$(python3 - "$work/.specs/loop-state.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print('\n'.join(json.load(source)['completedTasks']))
PY
)" 'completedTasks must append only the executed sequential tasks'
  assert_equal 'T14' "$(state_value "$work/.specs/loop-state.json" currentTask)" \
    'currentTask must be the next sequential task'
  [[ -z "$(git -C "$work" status --porcelain)" ]] ||
    fail 'normal completion must leave metadata and the working tree clean'
  local_head="$(git -C "$work" rev-parse HEAD)"
  remote_head="$(git --git-dir="$remote" rev-parse "refs/heads/$branch_name")"
  assert_equal "$local_head" "$remote_head" \
    'successful pushes must leave the remote batch branch at the local commit'
  git -C "$work" merge-base --is-ancestor \
    "$(state_value "$work/.specs/loop-state.json" lastPush.sha)" "$remote_head" ||
    fail 'lastPush.sha must record a task commit published on the remote branch'
  assert_equal 'origin' "$(state_value "$work/.specs/loop-state.json" lastPush.remote)" \
    'lastPush must record origin'
  assert_equal "$branch_name" "$(state_value "$work/.specs/loop-state.json" lastPush.branch)" \
    'lastPush must record the batch branch'
  assert_equal 'passed' "$(state_value "$work/.specs/loop-state.json" lastPush.status)" \
    'lastPush must record a passed push'
  assert_equal '1' "$(python3 - "$gh_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(sum(1 for line in source if line.startswith('gh=pr create ')))
PY
)" 'first batch run must create exactly one Draft PR'
  assert_equal '1' "$(python3 - "$gh_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(sum(1 for line in source if line.startswith('gh=pr edit ')))
PY
  )" 'each published task must update the existing PR body'
  assert_equal '42' "$(state_value "$work/.specs/loop-state.json" pullRequest.number)" \
    'state must persist the PR number'
  assert_equal 'https://github.com/example/emaus/pull/42' \
    "$(state_value "$work/.specs/loop-state.json" pullRequest.url)" \
    'state must persist the PR URL'
  assert_equal 'dev' "$(state_value "$work/.specs/loop-state.json" pullRequest.base)" \
    'state must persist the PR base'
  assert_equal "$branch_name" "$(state_value "$work/.specs/loop-state.json" pullRequest.head)" \
    'state must persist the PR head'
  assert_equal 'True' "$(state_value "$work/.specs/loop-state.json" pullRequest.draft)" \
    'state must persist the Draft PR state'
  python3 - "$gh_body" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    body = source.read()
for expected in (
    'L003', 'push-order', 'T12..T13', 'Known Risks', 'QA Checklist',
    'Commit SHAs', 'Gate Results', 'Push Status'
):
    if expected not in body:
        raise SystemExit(f'PR body is missing {expected!r}')
if 'DATABASE_URL' in body or 'OPENAI_API_KEY' in body:
    raise SystemExit('PR body must not include environment values or secrets')
PY

  git clone "$remote" "$fresh_work" >/dev/null
  git -C "$fresh_work" config user.name 'Ralph Test'
  git -C "$fresh_work" config user.email 'ralph-test@example.invalid'
  git -C "$fresh_work" switch -c "$branch_name" "origin/$branch_name" >/dev/null
  assert_equal 'L003' "$(state_value "$fresh_work/.specs/loop-state.json" batch)" \
    'fresh clone must contain the committed batch metadata'
  assert_equal '42' "$(state_value "$fresh_work/.specs/loop-state.json" pullRequest.number)" \
    'fresh clone must contain the committed PR metadata'
  assert_equal 'passed' "$(state_value "$fresh_work/.specs/loop-state.json" lastPush.status)" \
    'fresh clone must contain the committed push metadata'

  export RALPH_TEST_REQUIRE_PR_FOR_EXECUTION=false
  if ! resume_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --resume --max-tasks 1 2>&1)"; then
    fail "resume PR case should complete successfully: $resume_output"
  fi
  assert_equal '7' "$(wc -l < "$push_log" | tr -d ' ')" \
    'resume must publish the next task and its governed metadata commit'
  assert_equal '3' "$(wc -l < "$opencode_calls" | tr -d ' ')" \
    'resume must execute the next task once'
  assert_equal '1' "$(python3 - "$gh_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(sum(1 for line in source if line.startswith('gh=pr create ')))
PY
  )" 'resume must not create a duplicate PR'
  assert_equal '2' "$(python3 - "$gh_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(sum(1 for line in source if line.startswith('gh=pr edit ')))
PY
  )" 'resume must retry and update the same PR body'

  rm -f "$gh_pr_exists"
  export RALPH_TEST_PR_LIST_FAIL_AFTER_TASK=true
  export RALPH_TEST_PUSH_LOG="$post_task_push_log"
  export RALPH_TEST_OPENCODE_CALLS="$post_task_calls"
  if post_task_failure_output="$(cd "$post_task_failure_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L006 --scope post-task-pr-failure --max-tasks 1 2>&1)"; then
    fail 'post-task PR validation failure must stop the loop'
  else
    post_task_failure_status="$?"
  fi
  assert_equal '69' "$post_task_failure_status" \
    'post-task PR validation failure must stop with the runner preflight status'
  [[ "$post_task_failure_output" == *'Unable to query open PRs'* ]] ||
    fail 'post-task PR validation failure should explain the PR query failure'
  [[ "$(git -C "$post_task_failure_work" status --porcelain)" == ' M .specs/loop-state.json' ]] ||
    fail "post-task PR validation failure should leave only runner metadata dirty (status: $(git -C "$post_task_failure_work" status --porcelain))"
  assert_equal 'T13' "$(state_value "$post_task_failure_work/.specs/loop-state.json" currentTask)" \
    'post-task failure must preserve the committed next task'
  export RALPH_TEST_PR_LIST_FAIL_AFTER_TASK=false
  if ! post_task_recovery_output="$(cd "$post_task_failure_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L006 --scope post-task-pr-failure --resume --max-tasks 1 2>&1)"; then
    fail "resume must recover post-task PR validation failure: $post_task_recovery_output"
  fi
  assert_equal $'T12\nT13' "$(tr -d '\r' < "$post_task_calls")" \
    "resume must not rerun the task whose commit preceded PR validation failure (output: $post_task_recovery_output, state: $(state_value "$post_task_failure_work/.specs/loop-state.json" currentTask))"
  [[ -z "$(git -C "$post_task_failure_work" status --porcelain)" ]] ||
    fail 'post-task PR recovery must leave the working tree clean'
  export RALPH_TEST_PUSH_LOG="$push_log"
  export RALPH_TEST_OPENCODE_CALLS="$opencode_calls"

  export RALPH_TEST_PR_DRAFT=false
  if ready_pr_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --resume --max-tasks 1 2>&1)"; then
    fail 'Ralph must stop when an existing PR is already ready'
  fi
  [[ "$ready_pr_output" == *'Draft'* ]] ||
    fail 'ready PR handling should explain the Draft-only requirement'
  export RALPH_TEST_PR_DRAFT=true

  export RALPH_TEST_PR_COUNT=2
  before_multiple_pushes="$(wc -l < "$push_log" | tr -d ' ')"
  before_multiple_opencode_calls="$(wc -l < "$opencode_calls" | tr -d ' ')"
  if multiple_pr_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --resume --max-tasks 1 2>&1)"; then
    fail 'multiple matching PRs must stop the loop'
  fi
  [[ "$multiple_pr_output" == *'Multiple open PRs'* ]] ||
    fail 'multiple matching PRs should explain the safe stop'
  assert_equal "$before_multiple_pushes" "$(wc -l < "$push_log" | tr -d ' ')" \
    'multiple matching PRs must not push another commit'
  assert_equal "$before_multiple_opencode_calls" "$(wc -l < "$opencode_calls" | tr -d ' ')" \
    'multiple matching PRs must not execute another task'
  export RALPH_TEST_PR_COUNT=1

  rm -f "$gh_pr_exists"
  before_zero_pushes="$(wc -l < "$push_log" | tr -d ' ')"
  before_zero_opencode_calls="$(wc -l < "$opencode_calls" | tr -d ' ')"
  if zero_pr_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --resume --max-tasks 1 2>&1)"; then
    fail 'zero matching PRs must stop the loop'
  fi
  [[ "$zero_pr_output" == *'No open Draft PR'* ]] ||
    fail 'zero matching PRs should explain the safe stop'
  assert_equal "$before_zero_pushes" "$(wc -l < "$push_log" | tr -d ' ')" \
    'zero matching PRs must not push another commit'
  assert_equal "$before_zero_opencode_calls" "$(wc -l < "$opencode_calls" | tr -d ' ')" \
    'zero matching PRs must not execute another task'
  touch "$gh_pr_exists"

  export RALPH_TEST_EXTRA_COMMIT=true
  if extra_commit_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --resume --max-tasks 1 2>&1)"; then
    fail 'Ralph must reject more than one new commit for a task iteration'
  else
    extra_commit_status="$?"
  fi
  assert_equal '68' "$extra_commit_status" \
    'multiple commits in one task iteration must be rejected'
  [[ "$extra_commit_output" == *'exactly one commit'* ]] ||
    fail 'multiple-commit rejection should explain the exact commit contract'
  export RALPH_TEST_EXTRA_COMMIT=false

  cat > "$fake_bin/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

real_git="${RALPH_TEST_REAL_GIT:?}"
if [[ "${1:-}" == 'push' ]]; then
  commit_message="$($real_git log -1 --format=%s)"
  if [[ "$commit_message" != 'chore: publish Ralph task metadata' ]]; then
    exec "$real_git" "$@"
  fi
  printf 'failed push=%s\n' "$*" >> "${RALPH_TEST_PUSH_LOG:?}"
  exit 73
fi
exec "$real_git" "$@"
EOF
  chmod +x "$fake_bin/git"
  export RALPH_TEST_PUSH_LOG="$failure_push_log"
  export RALPH_TEST_OPENCODE_CALLS="$failure_opencode_calls"
  if failure_output="$(cd "$failure_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L004 --scope push-failure --max-tasks 2 2>&1)"; then
    fail 'push failure case must stop non-zero'
  else
    failure_status="$?"
  fi
  assert_equal '73' "$failure_status" \
    'push failure must preserve the original git push status'
  [[ "$failure_output" == *'Metadata push failed'* ]] ||
    fail 'push failure should explain that resume preserves the local commit'
  assert_equal "$failure_branch_name" "$(git -C "$failure_work" branch --show-current)" \
    'push failure must keep the batch branch checked out'
  assert_equal 'chore: publish Ralph task metadata' "$(git -C "$failure_work" log -1 --format=%s)" \
    'push failure must preserve the published state transition commit'
  assert_equal 'T13' "$(state_value "$failure_work/.specs/loop-state.json" currentTask)" \
    'push failure must preserve the advanced local loop state'
  [[ -z "$(git -C "$failure_work" status --porcelain)" ]] ||
    fail 'push failure must leave the local published state clean for resume'
  assert_equal '1' "$(wc -l < "$failure_opencode_calls" | tr -d ' ')" \
    'push failure must not start the next task'
  remote_branch_status=0
  git --git-dir="$remote" show-ref --verify --quiet "refs/heads/$failure_branch_name" ||
    remote_branch_status="$?"
  assert_equal '0' "$remote_branch_status" \
    'failed task publication must preserve the already-published batch branch'

  cat > "$fake_bin/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

real_git="${RALPH_TEST_REAL_GIT:?}"
if [[ "${1:-}" == 'push' ]]; then
  state='.specs/loop-state.json'
  head="$($real_git rev-parse HEAD)"
  status="$($real_git status --porcelain)"
  commit_message="$($real_git log -1 --format=%s)"
  current_task="$(python3 - "$state" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(json.load(source)['currentTask'])
PY
)"
  printf 'push=%s|head=%s|status=%s|commit=%s|current=%s\n' \
    "$*" "$head" "$status" "$commit_message" "$current_task" \
    >> "${RALPH_TEST_PUSH_LOG:?}"
fi
exec "$real_git" "$@"
EOF
  chmod +x "$fake_bin/git"
  : > "$failure_push_log"
  export RALPH_TEST_PUSH_LOG="$failure_push_log"
  if ! recovery_output="$(cd "$failure_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L004 --scope push-failure --resume --max-tasks 1 2>&1)"; then
    fail "push recovery case should complete successfully: $recovery_output"
  fi
  assert_equal '3' "$(wc -l < "$failure_push_log" | tr -d ' ')" \
    'resume must publish the preserved state before starting the next task'
  recovery_push_first="$(python3 - "$failure_push_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    print(source.readline().rstrip('\n'))
PY
)"
  recovery_push_second="$(python3 - "$failure_push_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    lines = source.readlines()
print(lines[1].rstrip('\n'))
PY
)"
  recovery_push_third="$(python3 - "$failure_push_log" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    lines = source.readlines()
print(lines[2].rstrip('\n'))
PY
)"
  [[ "$recovery_push_first" == "push=push origin $failure_branch_name|head="*"|status=|commit=chore: publish Ralph task metadata|current=T13" ]] ||
    fail 'resume must publish the preserved state before the next task'
  [[ "$recovery_push_second" == "push=push origin $failure_branch_name|head="*"|status= M .specs/loop-state.json|commit=test: execute T13|current=T14" ]] ||
    fail 'resume must publish the next task commit before its state transition'
  [[ "$recovery_push_third" == "push=push origin $failure_branch_name|head="*"|status=|commit=chore: publish Ralph task metadata|current=T14" ]] ||
    fail 'resume must publish the next task state transition after its task commit'
  assert_equal $'T12\nT13' "$(tr -d '\r' < "$failure_opencode_calls")" \
    'resume must not rerun the task whose commit was preserved'
  last_push_sha="$(state_value "$failure_work/.specs/loop-state.json" lastPush.sha)"
  remote_head="$(git --git-dir="$remote" rev-parse "refs/heads/$failure_branch_name")"
  git -C "$failure_work" merge-base --is-ancestor "$last_push_sha" "$remote_head" ||
    fail 'recovery must persist a task commit published on the remote branch'

  rm -f "$gh_pr_exists"
  export RALPH_TEST_PR_CREATE_FAIL=true
  export RALPH_TEST_PUSH_LOG="$failure_push_log"
  export RALPH_TEST_OPENCODE_CALLS="$pr_failure_calls"
  if pr_failure_output="$(cd "$pr_failure_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L005 --scope pr-failure --max-tasks 1 2>&1)"; then
    fail 'Draft PR creation failure must stop the loop'
  else
    pr_failure_status="$?"
  fi
  assert_equal '74' "$pr_failure_status" \
    'Draft PR creation failure must preserve the gh status'
  [[ "$pr_failure_output" == *'Draft PR creation failed'* ]] ||
    fail 'Draft PR creation failure should explain that the pushed branch is preserved'
  if python3 - "$pr_failure_work/.specs/loop-state.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    state = json.load(source)
if 'lastPush' not in state:
    raise SystemExit(1)
PY
  then
    :
  else
    fail 'PR creation failure must retain the successful task push metadata'
  fi
  if python3 - "$pr_failure_work/.specs/loop-state.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    state = json.load(source)
if 'pullRequest' in state:
    raise SystemExit(1)
PY
  then
    :
  else
    fail 'PR creation failure must not persist incomplete PR metadata'
  fi
  assert_equal '1' "$(wc -l < "$pr_failure_calls" | tr -d ' ')" \
    'PR creation failure must happen after the first task executes and pushes'

  export RALPH_TEST_PR_CREATE_FAIL=false
  export RALPH_TEST_REQUIRE_PR_FOR_EXECUTION=true
  if ! pr_recovery_output="$(cd "$pr_failure_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L005 --scope pr-failure --resume --max-tasks 1 2>&1)"; then
    fail "resume must retry PR setup before executing another task: $pr_recovery_output"
  fi
  assert_equal $'T12\nT13' "$(tr -d '\r' < "$pr_failure_calls")" \
    'PR retry must happen before the next task is executed without rerunning the failed task'
  export RALPH_TEST_REQUIRE_PR_FOR_EXECUTION=false

  cat > "$fake_bin/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

real_git="${RALPH_TEST_REAL_GIT:?}"
if [[ "${1:-}" == 'fetch' && "${3:-}" == "${RALPH_TEST_FAIL_FETCH_BRANCH:-}" ]]; then
  printf 'simulated batch branch fetch failure\n' >&2
  exit 76
fi
exec "$real_git" "$@"
EOF
  chmod +x "$fake_bin/git"
  export RALPH_TEST_FAIL_FETCH_BRANCH="$branch_name"
  export RALPH_TEST_OPENCODE_CALLS="$opencode_calls"
  before_fetch_opencode_calls="$(wc -l < "$opencode_calls" | tr -d ' ')"
  if fetch_failure_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L003 --scope push-order --resume --max-tasks 1 2>&1)"; then
    fail 'batch branch fetch failure must stop before trusting the stale remote ref'
  else
    fetch_failure_status="$?"
  fi
  assert_equal '76' "$fetch_failure_status" \
    'batch branch fetch failure must preserve the fetch status'
  [[ "$fetch_failure_output" == *'Unable to fetch origin/'* ]] ||
    fail 'batch branch fetch failure should explain that the remote ref was not refreshed'
  assert_equal "$before_fetch_opencode_calls" "$(wc -l < "$opencode_calls" | tr -d ' ')" \
    'batch branch fetch failure must not execute another task'
  unset RALPH_TEST_FAIL_FETCH_BRANCH

  printf 'PASS: push and recovery\n'
}

run_qa_case() {
  [[ -f "$RALPH_QA_SCRIPT" ]] || fail "missing QA script: $RALPH_QA_SCRIPT"

  local remote
  local source
  local work
  local mutation_work
  local fake_bin
  local branch_name='lote/L010-qa-flow'
  local dev_sha
  local qa_commit
  local qa_head
  local output
  local status
  local help_output
  local help_status
  local early_failure_output
  local early_failure_status
  local dirty_output
  local wrong_branch_output
  local wrong_pr_output
  local gate_failure_output
  local gate_failure_status
  local database_url_failure_output
  local dirty_artifact_output
  local dirty_artifact_status
  local gate_log
  local browser_log
  local preexisting_app_pid
  local preexisting_ready
  local preexisting_listener_pids
  local preexisting_output
  local preexisting_status
  local remaining_listener_pids
  local toctou_output
  local gh_log
  local pr_body
  local next_env_body
  local app_port=$((39000 + $$ % 1000))

  TEST_ROOT="$(mktemp -d)"
  TEST_ROOTS+=("$TEST_ROOT")
  remote="$TEST_ROOT/remote.git"
  source="$TEST_ROOT/source"
  work="$TEST_ROOT/work"
  mutation_work="$TEST_ROOT/mutation-work"
  fake_bin="$TEST_ROOT/fake-bin"
  gate_log="$TEST_ROOT/gates.log"
  browser_log="$TEST_ROOT/browser.log"
  gh_log="$TEST_ROOT/gh.log"
  pr_body="$TEST_ROOT/pr-body.md"
  next_env_body='fixture next env'

  git init --bare "$remote" >/dev/null
  git init -b main "$source" >/dev/null
  git -C "$source" config user.name 'Ralph Test'
  git -C "$source" config user.email 'ralph-test@example.invalid'
  mkdir -p "$source/scripts" "$source/.specs/features/emaus-mvp"
  printf '%s\n' 'Ralph QA test' > "$source/README.md"
  cp "$RALPH_QA_SCRIPT" "$source/scripts/ralph-qa.sh"
  chmod +x "$source/scripts/ralph-qa.sh"

  if help_output="$(cd "$source" && ./scripts/ralph-qa.sh --help 2>&1)"; then
    help_status=0
  else
    help_status="$?"
  fi
  assert_equal '0' "$help_status" 'QA --help must exit successfully'
  [[ "$help_output" != *'command not found'* ]] ||
    fail "QA --help must not report a cleanup command error: $help_output"

  if early_failure_output="$(cd "$source" && ./scripts/ralph-qa.sh --batch 2>&1)"; then
    fail 'QA must reject an incomplete early preflight argument'
  else
    early_failure_status="$?"
  fi
  assert_equal '64' "$early_failure_status" 'incomplete early preflight argument must be rejected'
  [[ "$early_failure_output" == *'Missing value for --batch'* ]] ||
    fail 'early preflight failure should explain the missing batch value'
  [[ "$early_failure_output" != *'command not found'* ]] ||
    fail "early preflight failure must not report a cleanup command error: $early_failure_output"

  cat > "$source/.specs/loop-state.json" <<'EOF'
{
  "schemaVersion": 1,
  "feature": "emaus-mvp",
  "batch": null,
  "scope": null,
  "baseBranch": null,
  "runBranch": null,
  "baseSha": null,
  "status": "ready",
  "currentTask": "T02",
  "completedTasks": ["T01"],
  "completedMilestones": [],
  "lastCommit": "base-task",
  "lastGate": {"command": "test gate", "result": "passed"},
  "updatedAt": "2026-07-21"
}
EOF
  printf '%s\n' '# Ralph QA test tasks' '### T01: Base task' '### T02: Batch task' \
    '### T03: Skipped task' '### T04: Invalid current task' > \
    "$source/.specs/features/emaus-mvp/tasks.md"
  for task_number in $(seq 5 36); do
    printf '### T%02d: Validation fixture task\n' "$task_number" \
      >> "$source/.specs/features/emaus-mvp/tasks.md"
  done
  printf '%s\n' 'fixture next env' > "$source/next-env.d.ts"
  git -C "$source" add README.md next-env.d.ts scripts .specs
  git -C "$source" commit -m 'test: seed QA main branch' >/dev/null
  git -C "$source" remote add origin "$remote"
  git -C "$source" push -u origin main >/dev/null
  git -C "$source" switch -c dev >/dev/null
  printf '%s\n' 'QA dev base' > "$source/DEV.md"
  git -C "$source" add DEV.md
  git -C "$source" commit -m 'test: seed QA dev branch' >/dev/null
  git -C "$source" push -u origin dev >/dev/null
  git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
  dev_sha="$(git --git-dir="$remote" rev-parse refs/heads/dev)"
  git clone "$remote" "$work" >/dev/null
  git -C "$work" config user.name 'Ralph Test'
  git -C "$work" config user.email 'ralph-test@example.invalid'
  git -C "$work" branch dev origin/dev
  git -C "$work" switch -c "$branch_name" "origin/dev" >/dev/null
  printf '%s\n' 'batch change' > "$work/batch.txt"
  python3 - "$work/.specs/loop-state.json" "$branch_name" "$dev_sha" <<'PY'
import json
import sys

path, branch, base_sha = sys.argv[1:]
with open(path, encoding='utf-8') as source:
    state = json.load(source)
state.update({
    'batch': 'L010',
    'scope': 'qa-flow',
    'baseBranch': 'dev',
    'runBranch': branch,
    'baseSha': base_sha,
    'currentTask': 'T03',
    'completedTasks': ['T01', 'T02'],
    'lastCommit': 'executor-T02',
    'lastGate': {'command': 'npm run test', 'result': 'passed'},
    'pullRequest': {
        'number': 42,
        'url': 'https://github.com/example/emaus/pull/42',
        'base': 'dev',
        'head': branch,
        'draft': True,
    },
})
with open(path, 'w', encoding='utf-8') as target:
    json.dump(state, target, indent=2)
    target.write('\n')
PY
  git -C "$work" add batch.txt .specs/loop-state.json
  git -C "$work" commit -m 'feat: execute T02 for QA fixture' >/dev/null
  qa_commit="$(git -C "$work" rev-parse HEAD)"
  python3 - "$work/.specs/loop-state.json" "$qa_commit" <<'PY'
import json
import sys

path, sha = sys.argv[1:]
with open(path, encoding='utf-8') as source:
    state = json.load(source)
state['lastPush'] = {
    'sha': sha,
    'remote': 'origin',
    'branch': state['runBranch'],
    'status': 'passed',
}
with open(path, 'w', encoding='utf-8') as target:
    json.dump(state, target, indent=2)
    target.write('\n')
PY
  git -C "$work" add .specs/loop-state.json
  git -C "$work" commit -m 'test: publish QA metadata' >/dev/null
  qa_head="$(git -C "$work" rev-parse HEAD)"
  git -C "$work" push -u origin "$branch_name" >/dev/null
  git -C "$work" branch -f dev main

  mkdir -p "$fake_bin"
  cat > "$fake_bin/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\n' "${1:-}" "${2:-}" >> "${RALPH_TEST_GATE_LOG:?}"
if [[ "${RALPH_TEST_GATE_FAILURE:-}" == "${2:-}" ]]; then
  printf 'simulated gate failure: %s\n' "${2:-}" >&2
  exit 77
fi
if [[ "${2:-}" == 'build' ]]; then
  printf '%s\n' 'next generated env' > next-env.d.ts
  if [[ "${RALPH_TEST_GATE_DIRTY:-false}" == 'true' ]]; then
    printf '%s\n' 'unexpected generated artifact' > qa-generated.txt
  fi
fi
exit 0
EOF
  chmod +x "$fake_bin/npm"
cat > "$fake_bin/start-app" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec python3 -m http.server "${RALPH_TEST_APP_PORT:?}" >/dev/null 2>&1
EOF
  chmod +x "$fake_bin/start-app"
  cat > "$fake_bin/browser-qa" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s|%s|%s\n' "${RALPH_APP_URL:?}" "${RALPH_BROWSER_VIEWPORTS:?}" "${RALPH_BROWSER_QA_CHECKLIST:?}" >> "${RALPH_TEST_BROWSER_LOG:?}"
python3 - "${RALPH_BROWSER_QA_CHECKLIST:?}" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    checklist = source.read()
for expected in ('desktop', 'mobile', 'console', 'network', 'acceptance criteria'):
    if expected not in checklist.lower():
        raise SystemExit(f'missing browser checklist item: {expected}')
PY
curl --fail --silent "${RALPH_APP_URL:?}" >/dev/null
if [[ "${RALPH_TEST_MUTATE_REMOTE:-false}" == 'true' ]]; then
  printf 'concurrent remote mutation\n' > "${RALPH_TEST_MUTATION_REPO:?}/concurrent-mutation.txt"
  git -C "${RALPH_TEST_MUTATION_REPO:?}" add concurrent-mutation.txt
  git -C "${RALPH_TEST_MUTATION_REPO:?}" commit -m 'test: concurrent remote mutation' >/dev/null
  git -C "${RALPH_TEST_MUTATION_REPO:?}" push origin "HEAD:${RALPH_QA_DIFF_HEAD:?}" >/dev/null
fi
if [[ "${RALPH_TEST_BROWSER_FAILURE:-false}" == 'true' ]]; then
  printf 'simulated browser QA failure\n' >&2
  exit 78
fi
EOF
  chmod +x "$fake_bin/browser-qa"
  cat > "$fake_bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'gh=%s\n' "$*" >> "${RALPH_TEST_GH_LOG:?}"
if [[ "${1:-}" == 'auth' && "${2:-}" == 'status' ]]; then
  exit 0
fi
if [[ "${1:-}" != 'pr' ]]; then
  exit 64
fi
body_file=''
for ((index = 1; index <= $#; index++)); do
  if [[ "${!index}" == '--body-file' ]]; then
    next_index=$((index + 1))
    body_file="${!next_index}"
  fi
done
if [[ -n "$body_file" ]]; then
  cp "$body_file" "${RALPH_TEST_PR_BODY:?}"
  if [[ "${2:-}" == 'edit' ]]; then
    python3 - "$body_file" "${RALPH_TEST_GH_LOG:?}" <<'PY'
import sys

body_path, log_path = sys.argv[1:]
with open(body_path, encoding="utf-8") as source:
    body = source.read()
status = next(
    line.split(": ", 1)[1]
    for line in body.splitlines()
    if line.startswith("- Independent QA:")
)
with open(log_path, "a", encoding="utf-8") as target:
    target.write(f"body-qa={status}\n")
PY
  fi
fi
case "${2:-}" in
  list)
    printf '[{"number":42,"url":"https://github.com/example/emaus/pull/42","isDraft":%s}]\n' \
      "${RALPH_TEST_PR_DRAFT:-true}"
    ;;
  view)
    if [[ "${RALPH_TEST_WRONG_PR:-false}" == 'true' ]]; then
      printf '{"number":42,"url":"https://github.com/example/emaus/pull/42","isDraft":true,"baseRefName":"main","headRefName":"wrong-head","body":""}\n'
    else
      printf '{"number":42,"url":"https://github.com/example/emaus/pull/42","isDraft":%s,"baseRefName":"dev","headRefName":"%s","body":""}\n' \
        "${RALPH_TEST_PR_DRAFT:-true}" "${RALPH_TEST_PR_HEAD:?}"
    fi
    ;;
  edit)
    ;;
  ready)
    touch "${RALPH_TEST_PR_READY:?}"
    ;;
  *)
    exit 64
    ;;
esac
EOF
  chmod +x "$fake_bin/gh"

  : > "$gate_log"
  : > "$browser_log"
  : > "$gh_log"
  rm -f "$pr_body" "$TEST_ROOT/pr-ready"
  export RALPH_TEST_GATE_LOG="$gate_log"
  export RALPH_TEST_BROWSER_LOG="$browser_log"
  export RALPH_TEST_GH_LOG="$gh_log"
  export RALPH_TEST_PR_BODY="$pr_body"
  export RALPH_TEST_PR_READY="$TEST_ROOT/pr-ready"
  export RALPH_TEST_PR_HEAD="$branch_name"
  export RALPH_TEST_APP_PORT="$app_port"
  export RALPH_START_COMMAND="$fake_bin/start-app"
  export RALPH_BROWSER_QA_COMMAND="$fake_bin/browser-qa"
  export RALPH_APP_URL="http://127.0.0.1:$app_port"
  export RALPH_BROWSER_VIEWPORTS='desktop,mobile'
  export RALPH_TEST_PR_DRAFT=true
  export RALPH_TEST_WRONG_PR=false
  export RALPH_TEST_BROWSER_FAILURE=false
  export RALPH_TEST_MUTATE_REMOTE=false
  export RALPH_TEST_GATE_DIRTY=false
  export DATABASE_URL='postgresql://qa:qa@localhost:5433/qa'

  python3 - "$ROOT_DIR/docs/operations/opencode-ralph-loop.md" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    documentation = source.read()

if "primeiro commit/push válido de uma task" not in documentation:
    raise SystemExit("Ralph docs must place Draft PR setup after the first valid task commit/push")
if "Antes da primeira task e antes de cada task seguinte" in documentation:
    raise SystemExit("Ralph docs must not describe Draft PR setup before the first task")

with open("docs/operations/ralph-branch-pr-flow.md", encoding="utf-8") as source:
    branch_documentation = source.read()
if "After the first successful task commit and push" not in branch_documentation:
    raise SystemExit("branch PR docs must place Draft PR setup after the first task commit and push")
if "Before the first task, publish the initialized state and open exactly one Draft PR" in branch_documentation:
    raise SystemExit("branch PR docs must not describe Draft PR setup before the first task")
PY

  if database_url_failure_output="$(cd "$work" && env -u DATABASE_URL PATH="$fake_bin:$PATH" \
    ./scripts/ralph-qa.sh --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must reject an unset DATABASE_URL before running project gates'
  fi
  [[ "$database_url_failure_output" == *'DATABASE_URL is required'* ]] ||
    fail 'missing DATABASE_URL failure should identify the required environment variable'

  run_qa_metadata_rejection_case 'sequence-gap' 'sequence-gap' "$remote" \
    "$branch_name" "$fake_bin" "$TEST_ROOT"
  for invalid_status in blocked verification_required unknown invalid; do
    run_qa_metadata_rejection_case "$invalid_status" "$invalid_status" "$remote" \
      "$branch_name" "$fake_bin" "$TEST_ROOT"
  done
  run_qa_metadata_rejection_case 'ready-wrong-current' 'ready-wrong-current' "$remote" \
    "$branch_name" "$fake_bin" "$TEST_ROOT"
  run_qa_metadata_rejection_case 'complete-incomplete' 'complete-incomplete' "$remote" \
    "$branch_name" "$fake_bin" "$TEST_ROOT"
  git -C "$work" fetch origin "$branch_name" >/dev/null
  git -C "$work" reset --hard "origin/$branch_name" >/dev/null
  qa_head="$(git -C "$work" rev-parse HEAD)"

  export RALPH_TEST_GATE_FAILURE='typecheck'
  if gate_failure_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must stop on the first failing gate'
  else
    gate_failure_status="$?"
  fi
  assert_equal '77' "$gate_failure_status" 'QA must preserve the first gate failure status'
  assert_equal $'run db:validate\nrun typecheck' "$(tr -d '\r' < "$gate_log")" \
    'QA must stop before later gates and browser checks after the first failure'
  [[ "$gate_failure_output" == *'npm run typecheck'* ]] ||
    fail 'QA failure must print the exact failed command'
  [[ ! -e "$TEST_ROOT/pr-ready" ]] || fail 'failed QA must not mark the PR ready'
  export RALPH_TEST_GATE_FAILURE=''

  export RALPH_TEST_GATE_DIRTY=true
  if dirty_artifact_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must reject non-generated dirty changes after restoring next-env.d.ts'
  else
    dirty_artifact_status="$?"
  fi
  assert_equal '65' "$dirty_artifact_status" \
    'QA must preserve the clean-tree failure for non-generated build artifacts'
  [[ "$dirty_artifact_output" == *'working tree is not clean'* ]] ||
    fail 'non-generated build artifact failure should explain the dirty tree'
  assert_equal "$next_env_body" "$(python3 - "$work/next-env.d.ts" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    print(source.read().rstrip("\n"))
PY
)" 'QA must restore the tracked next-env.d.ts after a build'
  rm -f "$work/qa-generated.txt"
  export RALPH_TEST_GATE_DIRTY=false

  python3 -m http.server "$app_port" --bind 127.0.0.1 >/dev/null 2>&1 &
  preexisting_app_pid=$!
  preexisting_ready=false
  for _ in {1..10}; do
    if curl --fail --silent "http://127.0.0.1:$app_port" >/dev/null 2>&1; then
      preexisting_ready=true
      break
    fi
    sleep 1
  done
  [[ "$preexisting_ready" == true ]] || fail 'QA preexisting-server fixture did not become ready'
  preexisting_listener_pids="$(lsof -nP -a -iTCP:"$app_port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if preexisting_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail "QA must reject a healthy preexisting server instead of accepting its curl response (pid: $preexisting_app_pid, listeners: $preexisting_listener_pids, output: $preexisting_output)"
  else
    preexisting_status="$?"
  fi
  kill "$preexisting_app_pid" >/dev/null 2>&1 || true
  wait "$preexisting_app_pid" >/dev/null 2>&1 || true
  assert_equal '70' "$preexisting_status" \
    "preexisting server rejection must report application readiness failure (pid: $preexisting_app_pid, listeners: $preexisting_listener_pids, output: $preexisting_output)"
  [[ "$preexisting_output" == *'already in use'* || "$preexisting_output" == *'did not become ready'* || "$preexisting_output" == *'exited before becoming ready'* ]] ||
    fail 'preexisting server rejection should identify spawned-process readiness failure'

  printf 'dirty\n' > "$work/dirty.txt"
  if dirty_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must reject a dirty checkout'
  fi
  [[ "$dirty_output" == *'working tree is not clean'* ]] ||
    fail 'dirty QA rejection must explain the clean-tree requirement'
  rm "$work/dirty.txt"

  git -C "$work" switch dev >/dev/null
  if wrong_branch_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must reject the wrong checked-out branch'
  fi
  [[ "$wrong_branch_output" == *'checked-out branch'* ]] ||
    fail 'wrong-branch QA rejection must explain the branch mismatch'
  git -C "$work" switch "$branch_name" >/dev/null

  export RALPH_TEST_WRONG_PR=true
  if wrong_pr_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must reject a PR with the wrong base or head'
  fi
  [[ "$wrong_pr_output" == *'base/head'* ]] ||
    fail 'wrong PR rejection must explain the base/head mismatch'
  export RALPH_TEST_WRONG_PR=false

  export RALPH_TEST_PR_DRAFT=false
  if ready_pr_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must stop when the existing PR is already ready'
  fi
  [[ "$ready_pr_output" == *'Draft'* ]] ||
    fail 'QA ready-PR rejection should explain the Draft-only requirement'
  export RALPH_TEST_PR_DRAFT=true

  export RALPH_TEST_BROWSER_FAILURE=true
  if browser_failure_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'browser QA failure must stop before PR readiness'
  fi
  [[ "$browser_failure_output" == *'Browser QA hook failed'* ]] ||
    fail 'browser QA failure should explain the failed hook'
  [[ ! -e "$TEST_ROOT/pr-ready" ]] || fail 'browser QA failure must not mark the PR ready'
  export RALPH_TEST_BROWSER_FAILURE=false

  : > "$gate_log"
  : > "$browser_log"
  rm -f "$pr_body" "$TEST_ROOT/pr-ready"
  if ! output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail "successful QA fixture should pass: $output"
  fi
  [[ "$output" == *'QA passed'* ]] || fail 'successful QA should print a pass summary'
  assert_equal '7' "$(wc -l < "$gate_log" | tr -d ' ')" \
    'successful QA must run every configured gate'
  assert_equal '1' "$(wc -l < "$browser_log" | tr -d ' ')" \
    'successful QA must invoke the browser hook once'
  [[ -e "$TEST_ROOT/pr-ready" ]] || fail 'successful QA must mark the PR ready'
  [[ -z "$(git -C "$work" status --porcelain)" ]] ||
    fail 'QA must not modify the application checkout'
  remaining_listener_pids="$(lsof -nP -a -iTCP:"$app_port" -sTCP:LISTEN -t 2>/dev/null || true)"
  [[ -z "$remaining_listener_pids" ]] ||
    fail "QA must clean up the spawned application listener (remaining: $remaining_listener_pids)"
  assert_equal "$next_env_body" "$(python3 - "$work/next-env.d.ts" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    print(source.read().rstrip("\n"))
PY
)" 'successful QA must restore the tracked next-env.d.ts after build'
  python3 - "$pr_body" "$qa_commit" <<'PY'
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    body = source.read()
expected_sha = sys.argv[2]
lower_body = body.lower()
for expected in (
    'L010', 'qa-flow', 'T02', 'desktop', 'mobile', 'console', 'network',
    'Commit SHAs', 'Gate Results', 'Push Status', expected_sha
):
    if expected.lower() not in lower_body:
        raise SystemExit(f'PR body is missing {expected!r}')
if body.count('- [x]') < 6:
    raise SystemExit('PR body does not mark the QA checklist complete')
PY
  python3 - "$gh_log" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    events = [line.rstrip("\n") for line in source]
pending = [index for index, event in enumerate(events) if event == "body-qa=pending final readiness revalidation"]
passed = [index for index, event in enumerate(events) if event == "body-qa=passed"]
ready = [index for index, event in enumerate(events) if event.startswith("gh=pr ready ")]
if not pending or not passed or not ready:
    raise SystemExit("QA PR log is missing pending body, passed body, or ready actions")
if pending[-1] >= passed[-1] or passed[-1] >= ready[-1] or ready[-1] != len(events) - 1:
    raise SystemExit("QA must revalidate before the passing body and make gh pr ready the final action")
PY
  assert_equal '0' "$(grep -c 'gh=pr merge' "$gh_log" || true)" \
    'QA must never merge the PR'
  assert_equal "$qa_head" "$(git -C "$work" rev-parse HEAD)" \
    'QA must not create application commits'

  git clone "$remote" "$mutation_work" >/dev/null
  git -C "$mutation_work" config user.name 'Ralph Test'
  git -C "$mutation_work" config user.email 'ralph-test@example.invalid'
  git -C "$mutation_work" switch -c mutation "origin/$branch_name" >/dev/null
  export RALPH_TEST_MUTATION_REPO="$mutation_work"
  export RALPH_TEST_MUTATE_REMOTE=true
  rm -f "$TEST_ROOT/pr-ready"
  if toctou_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must stop when the published batch head changes after browser validation'
  fi
  [[ "$toctou_output" == *'origin/lote/'* || "$toctou_output" == *'published'* ]] ||
    fail 'readiness TOCTOU rejection should identify the changed published state'
  [[ ! -e "$TEST_ROOT/pr-ready" ]] ||
    fail 'readiness TOCTOU rejection must leave the PR Draft'
  export RALPH_TEST_MUTATE_REMOTE=false

  git -C "$source" fetch origin "$branch_name" >/dev/null
  git -C "$source" switch -c qa-unpublished "origin/$branch_name" >/dev/null
  printf '%s\n' 'unpublished remote change' > "$source/unpublished.txt"
  git -C "$source" add unpublished.txt
  git -C "$source" commit -m 'test: advance remote batch branch' >/dev/null
  git -C "$source" push origin "HEAD:$branch_name" >/dev/null
  if unpublished_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    fail 'QA must reject a local head that is not published to origin'
  fi
  [[ "$unpublished_output" == *'origin'* ]] ||
    fail 'unpublished QA rejection should identify the origin head mismatch'

  local t36_work="$TEST_ROOT/t36-work"
  git clone "$remote" "$t36_work" >/dev/null
  git -C "$t36_work" config user.name 'Ralph Test'
  git -C "$t36_work" config user.email 'ralph-test@example.invalid'
  git -C "$t36_work" switch -c "$branch_name" "origin/$branch_name" >/dev/null
  python3 - "$t36_work/.specs/loop-state.json" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as source:
    state = json.load(source)
state["completedTasks"] = [f"T{number:02d}" for number in range(1, 37)]
state["currentTask"] = None
state["status"] = "verification_required"
with open(path, "w", encoding="utf-8") as target:
    json.dump(state, target, indent=2)
    target.write("\n")
PY
  git -C "$t36_work" add .specs/loop-state.json
  git -C "$t36_work" commit -m 'test: complete T36 verification state' >/dev/null
  git -C "$t36_work" push origin "$branch_name" >/dev/null
  rm -f "$TEST_ROOT/pr-ready"
  export RALPH_TEST_PR_DRAFT=true
  if t36_output="$(cd "$t36_work" && PATH="$fake_bin:$PATH" ./scripts/ralph-qa.sh \
    --batch L010 --scope qa-flow 2>&1)"; then
    :
  else
    fail "QA must accept verification_required after T36 completion: $t36_output"
  fi
  [[ "$t36_output" == *'QA passed'* ]] ||
    fail 'T36 verification_required QA should complete the normal readiness flow'
  python3 - "$pr_body" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    body = source.read()
if "T02..T36" not in body:
    raise SystemExit("T36 QA body must include the complete batch task range")
PY

  printf 'PASS: independent QA\n'
}

usage() {
  printf 'Usage: %s setup\n' "$0"
  printf '       %s branch-init\n' "$0"
  printf '       %s push\n' "$0"
  printf '       %s pull-request\n' "$0"
  printf '       %s qa\n' "$0"
  printf '       %s all\n' "$0"
}

case "${1:-}" in
  setup)
    run_setup_case
    run_existing_remote_dev_case
    ;;
  branch-init)
    run_branch_init_case
    ;;
  push)
    run_push_case
    ;;
  pull-request)
    run_push_case
    ;;
  qa)
    run_qa_case
    ;;
  all)
    run_setup_case
    run_existing_remote_dev_case
    run_branch_init_case
    run_push_case
    run_qa_case
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
