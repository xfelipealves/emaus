# Ralph Branch and PR Flow

This runbook describes the safe operating model for Ralph batches. `main` is
the stable project root, `dev` is the persistent integration branch, and each
automated batch runs on its own scope-named branch.

The approved design is recorded in
`docs/superpowers/specs/2026-07-21-ralph-loop-branch-pr-design.md`. The setup
script prepares only the persistent `dev`; `ralph-loop.sh` is the authoritative
owner of batch branch creation and PR lifecycle.

## Branch Topology

```text
main
  `-- dev
        `-- lote/L001-m3-auth-access
```

Rules:

- `main` remains stable and is never reset or force-pushed by Ralph.
- `dev` persists across batches and is created once from `main`.
- A batch branch starts from the latest `origin/dev`, not from stale local work.
- Batch branches use `lote/BATCH_ID-SCOPE_SLUG`, for example
  `lote/L001-m3-auth-access`.
- Merges into `dev` and promotion from `dev` to `main` are manual operations.

## Prepare Persistent `dev`

Run this from a clean checkout on the Ralph branch or another operator branch:

```bash
git status --short --branch
./scripts/setup-ralph-branches.sh
```

The script:

1. Refuses to run when Git reports any uncommitted tracked or untracked change.
2. Fetches `origin/main` and, when present, `origin/dev`.
3. Switches to local `main` and runs `git pull --ff-only origin main`.
4. Creates local `dev` from `origin/dev` when the remote branch already exists.
5. Otherwise creates `dev` from the updated local `main` and publishes it with
   normal upstream tracking.

The command is safe to rerun. An existing remote `dev` is not overwritten; a
missing local tracking branch is created from `origin/dev`. If local `dev`
exists while `origin/dev` does not, the script stops rather than guessing
which history should be published.

The script never uses `git reset`, `git push --force`, or an automatic rebase.
If `main` has diverged, the fast-forward-only pull stops and requires human
inspection.

## Recover A Local `dev`

When local `dev` is stale, diverged, or has no `origin/dev` upstream, stop the
setup or batch flow. Do not reset, force-update, delete, publish, or silently
replace the branch. First inspect the clone and remote state:

```bash
git status --short --branch
git remote -v
git branch -vv
git show-ref --heads --remotes
git log --graph --decorate --oneline --all --max-count=30
git fetch --prune origin
git show-ref --verify refs/heads/dev
git show-ref --verify refs/remotes/origin/dev
git ls-remote --heads origin dev
```

The inspection distinguishes a stale local tracking ref, local commits that
are not on the remote, a missing remote branch, and a clone whose `origin` is
wrong or unavailable. Keep any local-only commits and uncommitted work
preserved while deciding what to do; do not assume that local `dev` is
disposable.

After a human reviews the refs and chooses a recovery path, use one of these
deliberate options:

1. Preserve the local work in a named rescue branch or patch, then explicitly
   reconcile the histories and restore `dev` to the reviewed `origin/dev`.
2. If the clone is not trustworthy or local work is not needed, clone the
   reviewed `origin` into a new directory and rerun setup there. Leave the old
   clone untouched until the recovery is verified.
3. If the remote truly lacks `dev`, ask the maintainer whether to create it
   from reviewed `main`, publish a reviewed local history, or keep investigating.

Record the chosen path before applying commands such as branch replacement or
remote publication. The setup script is intentionally not a recovery tool: it
must stop on these conditions rather than guessing which history should win.

## Start A Batch

Once `origin/dev` exists, identify a unique batch ID and a normalized scope.
Do not create the batch branch manually: the runner creates it from the exact
`origin/dev` tip. Use `--resume` only when that same batch branch already
exists and its loop metadata must be recovered.

```bash
./scripts/ralph-loop.sh \
  --batch L001 \
  --scope m3-auth-access \
  --max-tasks 10
```

The runner performs the branch equality check immediately after creation, before
any task runs or commits. To resume that batch, check out the recorded branch
and use the same metadata with `--resume`:

```bash
./scripts/ralph-loop.sh \
  --batch L001 \
  --scope m3-auth-access \
  --max-tasks 10 \
  --resume
```

The equality check is required immediately after creating the branch, before any
task runs or commits. Persist the captured `BASE_SHA` as `baseSha` in
`.specs/loop-state.json` together with the batch, scope, `baseBranch`, and
`runBranch` metadata. `baseSha` is the immutable origin used for the batch; do
not replace it with a later `origin/dev` value.

Before execution, and again on every resume, validate the persisted base and
the clean tree:

```bash
BASE_SHA="$(python3 -c 'import json; print(json.load(open(".specs/loop-state.json"))["baseSha"])')"
test "$(git rev-parse origin/dev)" = "$BASE_SHA"
git merge-base --is-ancestor "$BASE_SHA" HEAD
git status --short --branch
```

The first check detects a changed `dev`; the ancestry check confirms the batch
tip still descends from its recorded base. Stop instead of continuing when
either validation fails.

Do not reuse an existing batch branch for a different batch ID or scope. A
resume must use the same branch and recorded metadata.

## Per-Task And PR Lifecycle

For each approved task, Ralph must preserve the existing task protections:

1. Read only the current task from loop state.
2. Run the executor and its task gate.
3. Require the executor to leave a clean tree.
4. Confirm exactly one new task commit and that `completedTasks` appended only
   the current task while `currentTask` became the next sequential task.
5. Push the validated commit to the batch branch before starting the next task.

Before the first task, publish the initialized state and open exactly one Draft
PR from the batch branch to `dev`:

```bash
gh pr create --draft --base dev --head lote/L001-m3-auth-access --title "[L001] m3-auth-access" --body-file /path/to/batch-pr-body.md
```

Later task commits stay in the same PR. Query and reuse the single existing PR
for the same head and base; zero or multiple matching PRs are safe stops and do
not permit another task or task push. An existing ready PR is also a safe stop:
Ralph never edits around the Draft-until-QA rule. The PR body must retain the
task range, full commit SHAs, individual gate results, push status, known risks,
and the independent QA checklist.

If a push fails, stop with the local state transition preserved and retry on the
same batch branch. If PR creation fails before the first task, stop without
executing or pushing a task and retry PR setup without creating an empty commit.
Batch, PR, and push metadata are committed in runner-owned state transitions; no
`skip-worktree` overlay is required. If `dev` changes during a batch,
report the divergence and wait for an explicit rebase or restart decision.

## Independent QA

Validate the complete batch range, not only the last task:

```bash
git fetch origin lote/L001-m3-auth-access
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/lote/L001-m3-auth-access)"
git fetch origin dev
git diff --stat origin/dev...HEAD
git log --oneline origin/dev..HEAD
```

Check branch and PR metadata, loop state, recorded `lastPush.sha` in the
published remote history, and the published remote head before validating the
complete range. Check commit
ancestry, configured project
gates, browser behavior on desktop and mobile-sized viewports, console and
network errors, keyboard access for affected flows, secrets, generated files,
and scope drift. Keep the PR Draft when any check fails. Mark it ready only
after all checks pass:

```bash
gh pr ready <PR_NUMBER>
```

Making a PR ready does not merge it.

## Manual Merge Into `dev`

After review and independent QA, a maintainer manually merges the Draft PR
after changing it to Ready. Ralph does not merge or delete batch branches.

Recommended operator sequence:

1. Confirm the PR base is `dev` and the head is the expected batch branch.
2. Confirm all required checks and human review are complete.
3. Merge the PR using the repository's protected-branch policy.
4. Locally refresh the integration branch without rewriting history:

```bash
git switch dev
git pull --ff-only origin dev
```

5. Keep or delete the merged batch branch manually according to repository
   retention policy. Never force-push it.

## Manual Promotion From `dev` To `main`

Promotion is a separate human-reviewed change. Open the repository's normal PR
from `dev` to `main`, complete its checks, and merge it manually. Afterward,
refresh local `main` with fast-forward-only behavior:

```bash
git switch main
git pull --ff-only origin main
```

Do not merge `dev` into `main` from an automated Ralph process. Do not reset,
rebase, or force-push either stable branch to resolve divergence. Stop and ask
for an explicit maintainer decision instead.

## Recovery Checklist

- Dirty checkout: inspect changes, commit or discard them deliberately, then
  rerun the setup command.
- Stale or diverged local `dev`: stop, inspect refs and local-only work, then
  use a human-approved repair or reclone path; never silently overwrite it.
- Missing `dev` upstream: stop, confirm whether `origin/dev` exists, and get a
  maintainer decision before creating or publishing any branch.
- Diverged `main`: stop; resolve the branch history manually before rerunning.
- Failed batch push: preserve the local commit and retry the same branch.
- Failed PR creation: retry with the same head/base pair after authentication
  and repository access are fixed.
- Diverged `dev` during a batch: stop and choose an explicit rebase or restart.
