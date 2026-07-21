# Ralph Loop Branch and PR Flow

## Status

Approved design for implementation review.

## Context

The current Ralph Loop executes the task in `.specs/loop-state.json`, validates
the task gate, requires a clean tree, and expects a new commit. It currently
runs on the checked-out branch and does not own branch creation, remote pushes,
pull requests, or independent end-of-batch QA.

The desired workflow isolates automated work from the stable branches while
preserving every task commit and making the complete batch reviewable in one
pull request.

## Goals

- Keep `main` as the stable project root.
- Maintain a persistent `dev` integration branch created from `main`.
- Execute each Ralph batch on a new scope-named branch based on `origin/dev`.
- Push the batch branch after every valid task commit.
- Open one Draft PR from the batch branch to `dev` after the first valid commit.
- Keep all subsequent batch commits attached to that PR.
- Perform independent validation of the whole `dev...batch` diff before marking
  the PR ready.
- Keep merges to `dev` and promotion from `dev` to `main` manual.

## Non-Goals

- Automatically merging pull requests.
- Automatically promoting `dev` to `main`.
- Rewriting history or force-pushing batch branches.
- Automatically deleting batch branches after a merge.
- Provisioning GitHub credentials or bypassing `gh` authentication.

## Branch Topology

```text
main
  └── dev
        └── lote/L001-m3-auth-access
```

`dev` is created once from the current `main` and published to `origin`.
Every batch starts from the latest `origin/dev`, never from a stale local
branch. The default batch branch format is:

```text
lote/BATCH_ID-SCOPE_SLUG
```

Example:

```text
lote/L001-m3-auth-access
```

The batch ID is explicit and unique for each run. The scope slug identifies the
milestone or feature group and is normalized to safe lowercase Git branch
characters.

## Batch Lifecycle

The runner accepts explicit batch metadata, for example:

```bash
./scripts/ralph-loop.sh \
  --batch L001 \
  --scope m3-auth-access \
  --max-tasks 10
```

### Initialization

1. Verify the working tree is clean.
2. Verify `main` and `dev` references are available and fetch remote refs.
3. Create `dev` from `main` when requested and push it to `origin`.
4. Create `lote/L001-m3-auth-access` from `origin/dev`.
5. Push the batch branch with upstream tracking before task execution when
   possible. If the hosting provider rejects an empty branch, defer the first
   branch push until the first task commit.
6. Persist batch, scope, base branch, run branch, and base SHA in loop state.

### Per-Task Iteration

For every task, the runner keeps the existing protections:

1. Read only `currentTask` from loop state.
2. Invoke OpenCode with the approved task sources.
3. Require the task gate to pass.
4. Require a new commit and a clean tree.
5. Require the state to advance to the expected next task.
6. Push the batch branch immediately after the validated commit.
7. Record the pushed commit SHA and push result.

The first successful task commit triggers creation of a Draft PR. A PR cannot
be meaningfully opened before the branch differs from `dev`; the design avoids
an artificial empty commit. If a PR already exists, the runner reuses it.

### Batch Completion

After `--max-tasks` successful iterations:

1. Confirm all expected task commits are present on the batch branch.
2. Confirm the branch is clean and fully pushed.
3. Ensure the Draft PR targets `dev`.
4. Update the PR body with the task range, commits, gates, risks, and QA plan.
5. Leave the PR in Draft until independent validation completes.

The runner never merges the PR or deletes the branch.

## Loop State

`.specs/loop-state.json` keeps the task state and adds batch integration
metadata:

```json
{
  "batch": "L001",
  "scope": "m3-auth-access",
  "baseBranch": "dev",
  "baseSha": "1111111111111111111111111111111111111111",
  "runBranch": "lote/L001-m3-auth-access",
  "lastCommit": "2222222222222222222222222222222222222222",
  "lastPush": {
    "sha": "2222222222222222222222222222222222222222",
    "remote": "origin",
    "branch": "lote/L001-m3-auth-access",
    "status": "passed"
  },
  "pullRequest": {
    "number": 123,
    "url": "https://github.com/xfelipealves/emaus/pull/123",
    "base": "dev",
    "head": "lote/L001-m3-auth-access",
    "draft": true
  }
}
```

The task status remains authoritative for sequencing. Batch and PR metadata
must not allow the runner to skip a task or mark a task complete without its
gate and commit.

## Failure and Resume Rules

- Gate failure: stop without advancing loop state or creating a task commit.
- Missing task commit: stop.
- Dirty tree after the executor: stop and require human inspection.
- Push failure: stop with the local commit preserved; retry on the same batch
  branch.
- PR creation failure: stop after the branch is safely pushed; retry PR setup on
  the same batch.
- Existing batch branch or mismatched batch metadata: stop instead of silently
  reusing another run.
- Existing PR for the same head/base pair: reuse it rather than opening a
  duplicate.
- `dev` changes during a batch: report divergence and require an explicit
  rebase or restart decision; never rebase automatically.

## GitHub CLI

The setup checks for `gh` and installs it with Homebrew when absent:

```bash
brew install gh
```

Authentication is verified with `gh auth status`. The workflow never creates,
prints, or stores credentials. If authentication is missing, the runner stops
with the exact manual login instruction and does not claim that the PR was
created.

PR operations use `gh pr create --draft`, `gh pr view`, `gh pr edit`, and
`gh pr ready`. The PR base is always `dev`; the head is the batch branch.

## Independent QA Gate

After the batch is complete, validation covers the full `dev...HEAD` range,
not only the last task:

- Verify branch, PR base/head, task list, loop state, and commit ancestry.
- Run the configured database, typecheck, lint, build, unit, integration, and
  E2E gates with the required local environment.
- Start the application from the batch branch and run browser QA on desktop
  and mobile-sized viewports.
- Check console errors, failed network requests, loading/error/empty states,
  keyboard accessibility for affected flows, and the task acceptance criteria.
- Inspect the complete PR diff for scope drift, secrets, generated artifacts,
  and missing tests.
- Keep the PR Draft when any check fails; mark it ready only after all checks
  pass.

The QA process may report findings or create follow-up fix tasks, but it does
not merge the PR automatically.

## Acceptance Criteria

- Running a new batch from `dev` creates the expected scope-named branch.
- Each approved task creates exactly its governed task commit and pushes it to
  the batch branch before the next task starts.
- A Draft PR to `dev` exists after the first successful task commit.
- Later task commits appear in the same PR without creating duplicates.
- A failed push or PR operation stops safely and allows resume from the same
  branch.
- Independent QA validates the complete batch diff and leaves the PR Draft on
  failure.
- `dev` and `main` are never merged automatically.
