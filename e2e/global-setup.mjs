import { assertDisposableDatabaseUrl } from "../scripts/e2e/database-safety.mjs";

export default function globalSetup() {
  assertDisposableDatabaseUrl(process.env.DATABASE_URL);
}
