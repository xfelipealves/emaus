#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SETUP_SCRIPT="$ROOT_DIR/scripts/setup-ralph-branches.sh"
TEST_ROOT=""

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
  trap 'rm -rf "${TEST_ROOT:-}"' EXIT

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

  TEST_ROOT="$(mktemp -d)"
  trap 'rm -rf "${TEST_ROOT:-}"' EXIT

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

  printf 'PASS: existing remote dev\n'
}

usage() {
  printf 'Usage: %s setup\n' "$0"
  printf '       %s all\n' "$0"
}

case "${1:-}" in
  setup)
    run_setup_case
    run_existing_remote_dev_case
    ;;
  all)
    run_setup_case
    run_existing_remote_dev_case
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
