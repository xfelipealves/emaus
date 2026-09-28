const DATABASE_NAME_PATTERN = /^emaus_e2e_[a-f0-9]{12}$/;
const PASSWORD_PATTERN = /^[a-f0-9]{48}$/;

export function assertDisposableDatabaseUrl(value) {
  if (!value) {
    throw new Error("E2E requires a runner-managed disposable DATABASE_URL.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error("E2E DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const databaseName = databaseUrl.pathname.replace(/^\//, "");
  const port = Number(databaseUrl.port);
  const isDisposable =
    databaseUrl.protocol === "postgresql:" &&
    databaseUrl.hostname === "127.0.0.1" &&
    Number.isInteger(port) &&
    port > 1024 &&
    port !== 5432 &&
    !databaseUrl.search &&
    !databaseUrl.hash &&
    DATABASE_NAME_PATTERN.test(databaseName) &&
    databaseUrl.username === databaseName &&
    PASSWORD_PATTERN.test(databaseUrl.password);

  if (!isDisposable) {
    throw new Error(
      "E2E refuses DATABASE_URL unless it targets the runner's uniquely named, loopback-only temporary PostgreSQL database.",
    );
  }

  return databaseUrl;
}
