import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabaseUrl } from "./database-safety.mjs";

const sourceUrl = assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const containerName = process.env.E2E_CONTAINER_NAME;
const databaseName = process.env.E2E_DATABASE_NAME;
const databaseUser = process.env.E2E_DATABASE_USER;
if (!containerName || !databaseName || databaseUser !== databaseName) {
  throw new Error("Restore smoke test requires the runner-owned PostgreSQL container.");
}
const token = databaseName.match(/^emaus_e2e_([a-f0-9]{12})$/)?.[1];
if (!token || !new RegExp(`^emaus-e2e-\\d+-emaus_e2e_${token}$`).test(containerName)) {
  throw new Error("Restore smoke test refuses a container unrelated to its generated disposable database.");
}
const targetName = `${databaseName}_restore`;

function docker(args, input) {
  const result = spawnSync("docker", ["exec", ...(input ? ["--interactive"] : []), containerName, ...args], {
    input,
    maxBuffer: 16 * 1024 * 1024,
    stdio: input ? ["pipe", "pipe", "inherit"] : ["ignore", "pipe", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`docker exec ${args[0]} failed with code ${result.status}`);
  return result.stdout;
}

const source = new PrismaClient();
let restored;
try {
  const inspection = spawnSync("docker", ["inspect", "--format", '{{ index .Config.Labels "org.emaus.e2e" }}', containerName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (inspection.error) throw inspection.error;
  if (inspection.status !== 0 || inspection.stdout.trim() !== "temporary") {
    throw new Error("Restore smoke test refuses a PostgreSQL container without the temporary E2E label.");
  }
  await source.person.create({
    data: {
      id: "restore-smoke-synthetic-person",
      fullName: "Pessoa sintética de restauração",
      status: "MEMBER",
    },
  });

  const dump = docker([
    "pg_dump",
    "--format=custom",
    "--username",
    databaseUser,
    "--dbname",
    databaseName,
  ]);
  docker(["createdb", "--username", databaseUser, targetName]);
  docker([
    "pg_restore",
    "--no-owner",
    "--no-acl",
    "--username",
    databaseUser,
    "--dbname",
    targetName,
  ], dump);

  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${targetName}`;
  restored = new PrismaClient({ datasources: { db: { url: targetUrl.toString() } } });
  const [count, marker] = await Promise.all([
    restored.person.count(),
    restored.person.findUnique({ where: { id: "restore-smoke-synthetic-person" } }),
  ]);
  if (count !== 1 || marker?.fullName !== "Pessoa sintética de restauração") {
    throw new Error("Synthetic restore verification did not find the expected row.");
  }
  console.log("RESTORE_SMOKE_RESULT synthetic PostgreSQL dump restored and marker verified in a separate temporary database.");
} finally {
  await restored?.$disconnect();
  await source.$disconnect();
}
