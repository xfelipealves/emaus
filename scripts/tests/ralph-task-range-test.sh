#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/scripts" "$TEST_ROOT/.specs/features/emaus-mvp" "$TEST_ROOT/bin"
cp "$ROOT_DIR/scripts/ralph-loop.sh" "$TEST_ROOT/scripts/ralph-loop.sh"
cp "$ROOT_DIR/scripts/run-emaus-task.sh" "$TEST_ROOT/scripts/run-emaus-task.sh"
chmod +x "$TEST_ROOT/scripts/ralph-loop.sh" "$TEST_ROOT/scripts/run-emaus-task.sh"

cat > "$TEST_ROOT/.specs/loop-state.json" <<'EOF'
{
  "schemaVersion": 1,
  "feature": "emaus-mvp",
  "status": "ready",
  "currentTask": "T46",
  "completedTasks": []
}
EOF

cat > "$TEST_ROOT/.specs/features/emaus-mvp/tasks.md" <<'EOF'
# Range fixture

### T46: Last validation fix

### T47: Final validation fix
EOF

cat > "$TEST_ROOT/bin/opencode" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TEST_ROOT/bin/opencode"

git -C "$TEST_ROOT" init -q -b main
git -C "$TEST_ROOT" config user.name 'Ralph Range Test'
git -C "$TEST_ROOT" config user.email 'ralph-range-test@example.invalid'
git -C "$TEST_ROOT" add .
git -C "$TEST_ROOT" commit -qm 'test: seed task range fixture'

dry_run_output="$(cd "$TEST_ROOT" && ./scripts/ralph-loop.sh --dry-run --max-tasks 2)"
grep -q 'Would execute T46 (expected next: T47).' <<<"$dry_run_output"
grep -q 'Would execute T47 (expected next: verification_required).' <<<"$dry_run_output"

PATH="$TEST_ROOT/bin:$PATH" "$TEST_ROOT/scripts/run-emaus-task.sh" T47
if PATH="$TEST_ROOT/bin:$PATH" "$TEST_ROOT/scripts/run-emaus-task.sh" T48 >/dev/null 2>&1; then
  echo 'T48 must be rejected when it is not defined in tasks.md' >&2
  exit 1
fi

echo 'PASS: Ralph task range supports the terminal task defined in tasks.md'
