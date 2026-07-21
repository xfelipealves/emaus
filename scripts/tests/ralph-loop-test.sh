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
  local dirty_output

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

  printf 'uncommitted change\n' > "$work/dirty.txt"
  if dirty_output="$(cd "$work" && ./scripts/setup-ralph-branches.sh 2>&1)"; then
    fail 'setup must reject a dirty checkout'
  fi
  [[ "$dirty_output" == *'working tree is not clean'* ]] ||
    fail 'dirty checkout failure should explain the clean-tree requirement'

  printf 'PASS: setup\n'
}

usage() {
  printf 'Usage: %s setup\n' "$0"
  printf '       %s all\n' "$0"
}

case "${1:-}" in
  setup)
    run_setup_case
    ;;
  all)
    run_setup_case
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
