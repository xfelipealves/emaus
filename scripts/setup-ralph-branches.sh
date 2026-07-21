#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Refusing to continue: working tree is not clean." >&2
    git status --short >&2
    exit 65
  fi
}

require_clean_tree

git fetch origin main
if git ls-remote --exit-code --heads origin dev >/dev/null 2>&1; then
  git fetch origin dev
  remote_dev_exists=true
else
  remote_dev_status=$?
  if [[ "$remote_dev_status" -eq 2 ]]; then
    remote_dev_exists=false
  else
    printf 'Refusing to continue: unable to query origin/dev (git ls-remote exited %d).\n' \
      "$remote_dev_status" >&2
    exit "$remote_dev_status"
  fi
fi

local_dev_exists=false
if git show-ref --verify --quiet refs/heads/dev; then
  local_dev_exists=true
fi

if [[ "$local_dev_exists" == true ]]; then
  if [[ "$remote_dev_exists" != true ]]; then
    echo "Refusing to continue: existing local dev branch requires origin/dev." >&2
    exit 66
  fi

  local_dev_sha="$(git rev-parse refs/heads/dev)"
  remote_dev_sha="$(git rev-parse refs/remotes/origin/dev)"
  if [[ "$local_dev_sha" != "$remote_dev_sha" ]]; then
    printf 'Refusing to continue: local dev does not match origin/dev (local %s, remote %s).\n' \
      "$local_dev_sha" "$remote_dev_sha" >&2
    exit 66
  fi

  if ! local_dev_upstream="$(git rev-parse --abbrev-ref dev@{upstream} 2>/dev/null)"; then
    echo "Refusing to continue: local dev must track origin/dev, but it has no upstream." >&2
    exit 66
  fi
  if [[ "$local_dev_upstream" != "origin/dev" ]]; then
    printf 'Refusing to continue: local dev must track origin/dev, but tracks %s.\n' \
      "$local_dev_upstream" >&2
    exit 66
  fi
fi

git switch main
git pull --ff-only origin main

if [[ "$remote_dev_exists" == true ]]; then
  if [[ "$local_dev_exists" != true ]]; then
    git branch --track dev origin/dev
  fi
else
  git branch dev main
  if git push -u origin dev; then
    :
  else
    push_status="$?"
    git branch -D dev >/dev/null 2>&1 || true
    exit "$push_status"
  fi
fi

printf 'dev branch ready at %s\n' "$(git rev-parse refs/heads/dev)"
