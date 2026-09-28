import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { assertDedicatedE2EDatabase } from "../src/lib/e2e-database-target";

export default function globalSetup() {
  const databaseName = assertDedicatedE2EDatabase(process.env.DATABASE_URL);
  console.log(`[e2e] Resetting disposable database ${databaseName}.`);

  execFileSync(resolve(process.cwd(), "node_modules/.bin/prisma"), ["migrate", "reset", "--force"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "inherit",
  });
}
