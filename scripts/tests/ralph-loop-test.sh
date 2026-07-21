#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SETUP_SCRIPT="$ROOT_DIR/scripts/setup-ralph-branches.sh"
RALPH_LOOP_SCRIPT="$ROOT_DIR/scripts/ralph-loop.sh"
TASK_RUNNER_SCRIPT="$ROOT_DIR/scripts/run-emaus-task.sh"
TEST_ROOT=""
TEST_ROOTS=()
TEST_ENV_ROOT=""

cleanup_test_roots() {
  local test_root

  if [[ -n "$TEST_ENV_ROOT" ]]; then
    rm -rf "$TEST_ENV_ROOT"
  fi

  for test_root in "${TEST_ROOTS[@]}"; do
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

value = state[sys.argv[2]]
if isinstance(value, (dict, list)):
    print(json.dumps(value, sort_keys=True))
else:
    print(value)
PY
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
  remote_dev_sha="$(git --git-dir="$remote" rev-parse refs/heads/dev)"

  if initial_output="$(cd "$work" && PATH="$fake_bin:$PATH" ./scripts/ralph-loop.sh \
    --batch L001 --scope 'M3 Auth/Access' --max-tasks 1 2>&1)"; then
    fail 'new batch initialization should stop when the fake executor creates no commit'
  else
    initial_status="$?"
  fi
  assert_equal '65' "$initial_status" \
    'initialization case should preserve the existing clean-tree stop'
  assert_equal "$branch_name" "$(git -C "$work" branch --show-current)" \
    'new batch should check out the normalized branch'
  created_sha="$(git -C "$work" rev-parse HEAD)"
  assert_equal "$remote_dev_sha" "$created_sha" \
    'new batch should start at the exact origin/dev tip'
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

  git -C "$work" add .specs/loop-state.json
  git -C "$work" commit -m 'test: persist initialized batch metadata' >/dev/null
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
  assert_equal '68' "$resume_status" 'valid resume should reach task execution'
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

usage() {
  printf 'Usage: %s setup\n' "$0"
  printf '       %s branch-init\n' "$0"
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
  all)
    run_setup_case
    run_existing_remote_dev_case
    run_branch_init_case
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
