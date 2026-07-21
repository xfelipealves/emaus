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

git switch main
git pull --ff-only origin main

if [[ "$remote_dev_exists" == true ]]; then
  if ! git show-ref --verify --quiet refs/heads/dev; then
    git branch --track dev origin/dev
  fi
else
  if git show-ref --verify --quiet refs/heads/dev; then
    echo "Refusing to publish an existing local dev branch without origin/dev." >&2
    exit 66
  fi
  git branch dev main
  git push -u origin dev
fi

printf 'dev branch ready at %s\n' "$(git rev-parse refs/heads/dev)"
