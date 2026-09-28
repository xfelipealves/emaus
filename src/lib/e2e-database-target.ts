const E2E_DATABASE_NAME = /^emaus_e2e_[a-z0-9_]+$/i;

/** Refuse destructive Playwright setup unless the process explicitly targets a disposable E2E database. */
export function assertDedicatedE2EDatabase(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error(
      "Playwright database reset refused: set DATABASE_URL explicitly to an emaus_e2e_* database.",
    );
  }

  let databaseName: string;
  try {
    const parsedUrl = new URL(databaseUrl);
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Playwright database reset refused: DATABASE_URL is not a valid URL.");
  }

  if (!E2E_DATABASE_NAME.test(databaseName)) {
    throw new Error(
      "Playwright database reset refused: DATABASE_URL must target a database named emaus_e2e_*.",
    );
  }

  return databaseName;
}
