import "./load-env";
import { mkdirSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

async function main() {
  mkdirSync("data", { recursive: true });
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
