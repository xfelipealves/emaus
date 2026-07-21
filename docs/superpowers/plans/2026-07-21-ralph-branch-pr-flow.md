# Ralph Loop Branch and PR Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Ralph execution from direct branch commits to isolated, scope-named batch branches based on `dev`, with per-commit pushes, an early Draft PR to `dev`, and an independent QA gate before the PR becomes ready.

**Architecture:** Keep `main` as the stable root and `dev` as the persistent integration branch. `scripts/ralph-loop.sh` owns batch initialization, task sequencing, commit verification, pushes, and Draft PR lifecycle; a separate QA script validates the complete `dev...batch` range without merging. Loop state remains the task sequencing authority and stores branch/push/PR metadata for safe resume.

**Tech Stack:** Bash, Git, GitHub CLI (`gh`), Python standard library for JSON state updates, OpenCode, npm scripts, Prisma/PostgreSQL, Vitest, Playwright.

---

## File Map

- Modify: `scripts/ralph-loop.sh` to accept batch metadata, create/check branches, push after each validated commit, and manage the Draft PR.
- Modify: `scripts/run-emaus-task.sh` to make the task commit contract compatible with batch branches and avoid claiming a push it does not perform.
- Create: `scripts/ralph-qa.sh` to validate the complete batch diff, run gates, inspect PR metadata, and mark the Draft PR ready only on success.
- Create: `scripts/tests/ralph-loop-test.sh` as a dependency-free shell harness for branch, push, resume, and PR failure scenarios using fake executables.
- Modify: `.specs/loop-state.json` to add batch, branch, push, and pull request metadata while preserving current task sequencing fields.
- Modify: `docs/operations/opencode-ralph-loop.md` with the new commands, lifecycle, recovery rules, and QA checklist.
- Create: `docs/operations/ralph-branch-pr-flow.md` with the operator runbook for `dev`, batch branches, PRs, and manual merges.
- Modify: `README.md` to link the branch/PR runbook.

### Task 1: Prepare GitHub CLI and persistent `dev`

**Files:**
- Create: `scripts/setup-ralph-branches.sh`
- Test: `scripts/tests/ralph-loop-test.sh`
- Modify: `docs/operations/ralph-branch-pr-flow.md`

- [ ] **Step 1: Verify GitHub CLI availability without exposing credentials**

Run:

```bash
if ! command -v gh >/dev/null 2>&1; then
  brew install gh
fi
gh --version
gh auth status
```

Expected: `gh` is installed and `gh auth status` identifies an authenticated
account. If authentication is missing, stop with `gh auth login`; never put a
token in a file or command argument.

- [ ] **Step 2: Add an idempotent branch setup script**

Implement `scripts/setup-ralph-branches.sh` with these exact behaviors:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git fetch origin main dev 2>/dev/null || git fetch origin main
git switch main
git pull --ff-only origin main

if git ls-remote --exit-code --heads origin dev >/dev/null 2>&1; then
  git show-ref --verify --quiet refs/heads/dev || git branch dev origin/dev
else
  git branch dev main
  git push -u origin dev
fi

printf 'dev branch ready at %s\n' "$(git rev-parse dev)"
```

The script must refuse to run with uncommitted changes and must never reset or
force-update `main` or `dev`.

- [ ] **Step 3: Add branch setup tests**

Extend the shell harness with a temporary bare remote and verify:

```bash
TEST_ROOT="$(mktemp -d)"
git init --bare "$TEST_ROOT/remote.git"
git clone "$TEST_ROOT/remote.git" "$TEST_ROOT/work"
```

Assert that running the setup script creates `origin/main` and `origin/dev`,
that running it a second time is idempotent, and that a dirty checkout exits
non-zero without changing either branch.

- [ ] **Step 4: Run setup validation**

Run:

```bash
bash -n scripts/setup-ralph-branches.sh
scripts/tests/ralph-loop-test.sh setup
```

Expected: syntax check and all setup cases pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-ralph-branches.sh scripts/tests/ralph-loop-test.sh docs/operations/ralph-branch-pr-flow.md
git commit -m "chore: prepare dev branch for Ralph batches"
```

### Task 2: Add batch branch metadata and initialization

**Files:**
- Modify: `scripts/ralph-loop.sh`
- Modify: `.specs/loop-state.json`
- Test: `scripts/tests/ralph-loop-test.sh`

- [ ] **Step 1: Add explicit batch arguments**

Add these options to `scripts/ralph-loop.sh`:

```text
--batch L001         Required for non-dry batch execution.
--scope m3-auth-access
                     Required scope slug; the value is an example.
--base-branch dev   Base branch, default: dev.
--resume             Reuse the branch and PR recorded in loop state.
```

Reject missing metadata, invalid IDs, unsafe scope characters, and an existing
batch branch unless `--resume` is supplied.

- [ ] **Step 2: Add deterministic branch naming**

Normalize the scope by lowercasing and converting any run of characters outside
`a-z0-9` into a single `-`. Build the branch name as:

```bash
RUN_BRANCH="lote/${BATCH_ID}-${SCOPE_SLUG}"
```

For `L001` and `m3-auth-access`, the exact result is
`lote/L001-m3-auth-access`.

- [ ] **Step 3: Add safe initialization from `origin/dev`**

Before the first task, fetch `origin/dev`, verify the tree is clean, verify the
batch branch does not already exist, create the branch at `origin/dev`, and
check it out. Store the base SHA and branch metadata in `.specs/loop-state.json`.

The state update must preserve `status`, `currentTask`, `completedTasks`,
`lastCommit`, and gate data.

- [ ] **Step 4: Test initialization and collision handling**

Add harness cases that verify:

- `lote/L001-m3-auth-access` is created from `origin/dev`.
- A second non-resume run with the same batch exits non-zero.
- `--resume` requires the checked-out branch and stored metadata to match.
- A dirty tree stops before branch creation.

- [ ] **Step 5: Run tests and commit**

```bash
bash -n scripts/ralph-loop.sh
scripts/tests/ralph-loop-test.sh branch-init
git add scripts/ralph-loop.sh .specs/loop-state.json scripts/tests/ralph-loop-test.sh
git commit -m "feat: add Ralph batch branch initialization"
```

### Task 3: Push after every validated task commit

**Files:**
- Modify: `scripts/ralph-loop.sh`
- Modify: `scripts/run-emaus-task.sh`
- Test: `scripts/tests/ralph-loop-test.sh`

- [ ] **Step 1: Keep the executor commit-only**

Update the executor prompt to state that the executor creates the task commit
but does not push or open a PR. The runner owns remote operations after it has
verified the commit, clean tree, and state transition.

- [ ] **Step 2: Add post-commit push**

Immediately after the existing checks in `ralph-loop.sh`, run:

```bash
git push -u origin "$RUN_BRANCH"
```

Use `-u` only on the first push; subsequent iterations use
`git push origin "$RUN_BRANCH"`. Persist:

```json
"lastPush": {
  "sha": "2222222222222222222222222222222222222222",
  "remote": "origin",
  "branch": "lote/L001-m3-auth-access",
  "status": "passed"
}
```

The implementation must not force-push. A failed push exits non-zero after
preserving the local task commit and state for `--resume`.

- [ ] **Step 3: Test push ordering and failure recovery**

Use a fake `git` wrapper in the harness to record calls and verify push occurs
only after the task commit and state checks. Simulate a failed push and assert
that the local commit remains, the branch remains checked out, and no next task
starts.

- [ ] **Step 4: Run tests and commit**

```bash
bash -n scripts/ralph-loop.sh scripts/run-emaus-task.sh
scripts/tests/ralph-loop-test.sh push
git add scripts/ralph-loop.sh scripts/run-emaus-task.sh scripts/tests/ralph-loop-test.sh
git commit -m "feat: push Ralph task commits per iteration"
```

### Task 4: Open and maintain one Draft PR per batch

**Files:**
- Modify: `scripts/ralph-loop.sh`
- Test: `scripts/tests/ralph-loop-test.sh`
- Modify: `docs/operations/opencode-ralph-loop.md`

- [ ] **Step 1: Add `gh` preflight**

Before execution, check:

```bash
command -v gh >/dev/null 2>&1 || {
  echo "GitHub CLI is required. Install with: brew install gh" >&2
  exit 69
}
gh auth status
```

Do not run `gh auth login` automatically. Authentication failure must stop the
run before any task is started.

- [ ] **Step 2: Open the Draft PR after the first pushed task**

After the first successful push, query for an existing PR with:

```bash
gh pr list --head "$RUN_BRANCH" --base "$BASE_BRANCH" --state open --json number,url,isDraft
```

If none exists, create one:

```bash
gh pr create \
  --draft \
  --base "$BASE_BRANCH" \
  --head "$RUN_BRANCH" \
  --title "[$BATCH_ID] $SCOPE_SLUG" \
  --body-file "$PR_BODY_FILE"
```

Persist the PR number, URL, base, head, and draft state. On later iterations,
update the same PR body; never create a second PR for the same head/base pair.

- [ ] **Step 3: Add PR body generation**

Generate a temporary body containing the batch ID, scope, base/head branches,
completed task range, latest gate result, push status, known risks, and the QA
checklist. Do not include secrets or full environment values.

- [ ] **Step 4: Test PR lifecycle**

Use a fake `gh` executable to verify exactly one `gh pr create --draft` call
after the first push, reuse on resume, and stop safely when creation fails.

- [ ] **Step 5: Run tests and commit**

```bash
scripts/tests/ralph-loop-test.sh pull-request
git add scripts/ralph-loop.sh scripts/tests/ralph-loop-test.sh docs/operations/opencode-ralph-loop.md
git commit -m "feat: open Draft PR for Ralph batch"
```

### Task 5: Add independent end-to-end QA and PR readiness

**Files:**
- Create: `scripts/ralph-qa.sh`
- Test: `scripts/tests/ralph-loop-test.sh`
- Modify: `docs/operations/opencode-ralph-loop.md`
- Modify: `README.md`

- [ ] **Step 1: Add QA preflight and full-range diff checks**

`ralph-qa.sh` must require `--batch`, `--scope`, and the recorded PR. It must
verify the checked-out branch, compare `dev...HEAD`, confirm loop state and task
range, and reject a dirty tree or a PR with the wrong base/head.

- [ ] **Step 2: Run the configured automated gates**

Run the project’s real gates with the caller’s environment:

```bash
npm run db:validate
npm run typecheck
npm run lint
npm run build
npm run test
npm run test:integration
npm run test:e2e
```

The script must preserve the first failing command and leave the PR Draft.

- [ ] **Step 3: Add browser QA hooks**

Start the application from the batch branch, run the browser QA workflow for
desktop and mobile viewport checks, and capture failures without modifying
application code. Verify console errors, failed requests, key navigation, and
the acceptance criteria represented by the completed tasks.

- [ ] **Step 4: Mark the PR ready only after all checks pass**

When every check passes, update the PR checklist and run:

```bash
gh pr ready "$PR_NUMBER"
```

Never merge the PR. If any check fails, retain Draft status and print the exact
failure and rerun command.

- [ ] **Step 5: Add QA tests and commit**

```bash
bash -n scripts/ralph-qa.sh
scripts/tests/ralph-loop-test.sh qa
git add scripts/ralph-qa.sh scripts/tests/ralph-loop-test.sh docs/operations/opencode-ralph-loop.md README.md
git commit -m "feat: add independent Ralph batch QA"
```

### Task 6: Create `dev` and perform operational dry-run

**Files:**
- Modify: `.specs/loop-state.json` only if the setup records branch metadata.

- [ ] **Step 1: Install or verify `gh`**

```bash
if ! command -v gh >/dev/null 2>&1; then brew install gh; fi
gh --version
gh auth status
```

- [ ] **Step 2: Create and publish `dev`**

```bash
./scripts/setup-ralph-branches.sh
git ls-remote --heads origin dev
```

Expected: `origin/dev` exists at the same commit as the current `main` unless
the user has deliberately advanced it.

- [ ] **Step 3: Exercise the batch command without OpenCode**

```bash
./scripts/ralph-loop.sh --dry-run --batch L001 --scope m3-auth-access --max-tasks 1
```

Expected: the planned task is printed without creating a branch, commit, push,
or PR.

- [ ] **Step 4: Run all local tests and inspect the final diff**

```bash
bash -n scripts/*.sh
scripts/tests/ralph-loop-test.sh all
git diff --check
git status --short --branch
```

- [ ] **Step 5: Commit operational documentation**

```bash
git add scripts/setup-ralph-branches.sh scripts/ralph-loop.sh scripts/run-emaus-task.sh scripts/ralph-qa.sh scripts/tests/ralph-loop-test.sh .specs/loop-state.json docs/operations README.md
git commit -m "docs: finalize Ralph batch operations"
```

## Self-Review

- The design requirement for persistent `dev` is covered by Tasks 1 and 6.
- Scope-named batch branches and collision-safe resume are covered by Task 2.
- Per-commit pushes and push failure recovery are covered by Task 3.
- Early Draft PR creation and PR reuse are covered by Task 4.
- Full-range automated and browser QA with Draft preservation is covered by
  Task 5.
- Manual merge boundaries for `dev` and `main` are preserved in every task.
- Every task names concrete files, commands, expected results, and dependencies.
- State field names are consistent across the design and all tasks:
  `batch`, `scope`, `baseBranch`, `baseSha`, `runBranch`, `lastPush`, and
  `pullRequest`.
