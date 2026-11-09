import assert from "node:assert/strict";
import test from "node:test";
import { assertDisposableDatabaseUrl } from "./database-safety.mjs";

const databaseName = "emaus_e2e_a1b2c3d4e5f6";
const password = "0123456789abcdef0123456789abcdef0123456789abcdef";

function makeUrl({
  protocol = "postgresql:",
  username = databaseName,
  password: suppliedPassword = password,
  hostname = "127.0.0.1",
  port = "49152",
  pathname = `/${databaseName}`,
  search = "",
  hash = "",
} = {}) {
  const url = new URL(`${protocol}//127.0.0.1/`);
  url.username = username;
  url.password = suppliedPassword;
  url.hostname = hostname;
  url.port = port;
  url.pathname = pathname;
  url.search = search;
  url.hash = hash;
  return url.toString();
}

test("accepts the runner's generated loopback database shape", () => {
  const value = makeUrl();

  assert.equal(assertDisposableDatabaseUrl(value).hostname, "127.0.0.1");
  assert.equal(assertDisposableDatabaseUrl(value).pathname, `/${databaseName}`);
});

test("rejects missing, shared-local, remote, and malformed disposable URLs", () => {
  const unsafeValues = [
    ["missing URL", undefined],
    ["shared development database", "postgresql://emaus:password@127.0.0.1:5432/emaus"],
    ["localhost alias", makeUrl({ hostname: "localhost" })],
    ["IPv6 loopback", makeUrl({ hostname: "[::1]" })],
    ["remote host", makeUrl({ hostname: "db.example.test" })],
    ["default PostgreSQL port", makeUrl({ port: "5432" })],
    ["non-runner database name", makeUrl({ pathname: "/emaus" })],
    ["mismatched database user", makeUrl({ username: "another_user" })],
    ["non-random password", makeUrl({ password: "password" })],
    ["query parameters", makeUrl({ search: "?sslmode=require" })],
    ["URL fragment", makeUrl({ hash: "#database" })],
    ["other protocol", makeUrl({ protocol: "postgres:" })],
  ];

  for (const [description, value] of unsafeValues) {
    assert.throws(() => assertDisposableDatabaseUrl(value), /E2E refuses|E2E requires/, description);
  }
});
