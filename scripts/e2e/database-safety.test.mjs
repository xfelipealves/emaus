import assert from "node:assert/strict";
import test from "node:test";
import { assertDisposableDatabaseUrl } from "./database-safety.mjs";

test("accepts only the generated loopback database shape", () => {
  const value =
    "postgresql://emaus_e2e_a1b2c3d4e5f6:0123456789abcdef0123456789abcdef0123456789abcdef@127.0.0.1:49152/emaus_e2e_a1b2c3d4e5f6";

  assert.equal(assertDisposableDatabaseUrl(value).hostname, "127.0.0.1");
});

test("rejects missing, shared-local, and remote database URLs", () => {
  const unsafeValues = [
    undefined,
    "postgresql://emaus:password@127.0.0.1:5432/emaus",
    "postgresql://emaus:password@localhost:5433/emaus",
    "postgresql://emaus:password@db.example.test:5432/emaus_e2e_a1b2c3d4e5f6",
    "postgresql://emaus_e2e_a1b2c3d4e5f6:password@127.0.0.1:49152/emaus_e2e_a1b2c3d4e5f6",
  ];

  for (const value of unsafeValues) {
    assert.throws(() => assertDisposableDatabaseUrl(value), /E2E refuses|E2E requires/);
  }
});
