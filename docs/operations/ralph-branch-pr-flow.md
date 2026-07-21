# Ralph Branch and PR Flow

This runbook describes the safe operating model for Ralph batches. `main` is
the stable project root, `dev` is the persistent integration branch, and each
automated batch runs on its own scope-named branch.

The approved design is recorded in
`docs/superpowers/specs/2026-07-21-ralph-loop-branch-pr-design.md`. The setup
script in this task prepares only `main` and `dev`; batch and PR automation is
added in later tasks.

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

## Start A Batch

Once `origin/dev` exists, identify a unique batch ID and a normalized scope:

```bash
git fetch origin dev
BASE_SHA="$(git rev-parse origin/dev)"
git switch -c lote/L001-m3-auth-access origin/dev
CREATED_SHA="$(git rev-parse HEAD)"
if [[ "$CREATED_SHA" != "$BASE_SHA" ]]; then
  printf 'Batch branch was not created at origin/dev (%s != %s).\n' \
    "$CREATED_SHA" "$BASE_SHA" >&2
  exit 1
fi
```

The planned runner invocation is:

```bash
./scripts/ralph-loop.sh \
  --batch L001 \
  --scope m3-auth-access \
  --max-tasks 10
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
3. Require exactly one new task commit and a clean tree.
4. Confirm loop state advanced to the expected next task.
5. Push the validated commit to the batch branch before starting the next task.

After the first pushed task commit, open one Draft PR from the batch branch to
`dev`:

```bash
gh pr create --draft --base dev --head lote/L001-m3-auth-access --title "[L001] m3-auth-access" --body-file /path/to/batch-pr-body.md
```

Later task commits stay in the same PR. Query and reuse an existing PR for the
same head and base; do not create duplicates. The PR body should retain the
task range, commit and gate results, known risks, and the independent QA plan.

If a push fails, stop with the local commit preserved and retry on the same
batch branch. If PR creation fails, stop after the branch is pushed and retry
PR setup without creating an empty commit. If `dev` changes during a batch,
report the divergence and wait for an explicit rebase or restart decision.

## Independent QA

Validate the complete batch range, not only the last task:

```bash
git diff --stat origin/dev...HEAD
git log --oneline origin/dev..HEAD
```

Check branch and PR metadata, loop state, commit ancestry, configured project
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
- Diverged `main`: stop; resolve the branch history manually before rerunning.
- Missing `origin/dev`: run the setup script from clean local `main`.
- Failed batch push: preserve the local commit and retry the same branch.
- Failed PR creation: retry with the same head/base pair after authentication
  and repository access are fixed.
- Diverged `dev` during a batch: stop and choose an explicit rebase or restart.
