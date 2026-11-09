import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertDisposableDatabaseUrl } from "./database-safety.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const options = process.argv.slice(2);
const capacityMode = options[0] === "--capacity";
const restoreSmokeMode = options[0] === "--restore-smoke";
if (capacityMode || restoreSmokeMode) options.shift();

let containerName;
let nextDistDirectory;
let nextTsconfigPath;
let activeChild;
let interrupted = false;
const forwardedEnvironment = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "TZ", "CI", "TERM", "PLAYWRIGHT_PORT", "DEBUG"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);

function signalChild(signal) {
  interrupted = true;
  activeChild?.kill(signal);
}

process.on("SIGINT", () => signalChild("SIGINT"));
process.on("SIGTERM", () => signalChild("SIGTERM"));

function start(file, args, { env = forwardedEnvironment, cwd = repositoryRoot, capture = false } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(file, args, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    activeChild = child;
    const stdout = [];

    if (capture) child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.once("error", (error) => {
      activeChild = undefined;
      rejectPromise(error);
    });
    child.once("close", (code, signal) => {
      activeChild = undefined;
      if (code === 0) {
        resolvePromise(capture ? Buffer.concat(stdout).toString("utf8").trim() : "");
        return;
      }
      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      rejectPromise(new Error(`${file} ${detail}`));
    });
  });
}

async function run(file, args, { label, env = forwardedEnvironment } = {}) {
  if (label) console.log(`[E2E] ${label}`);
  try {
    await start(file, args, { env });
  } catch (error) {
    if (!interrupted) console.error(`[E2E] ${error.message}`);
    throw error;
  }
}

function capture(file, args, { env = forwardedEnvironment } = {}) {
  const result = spawnSync(file, args, {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file} exited with code ${result.status}`);
  return result.stdout.trim();
}

function createDatabaseUrl(databaseName, password, port) {
  const databaseUrl = new URL("postgresql://127.0.0.1/");
  databaseUrl.username = databaseName;
  databaseUrl.password = password;
  databaseUrl.port = String(port);
  databaseUrl.pathname = `/${databaseName}`;
  return databaseUrl.toString();
}

async function waitForPostgres(name, databaseName) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (interrupted) throw new Error("E2E run interrupted while starting PostgreSQL.");
    const check = spawnSync(
      "docker",
      ["exec", name, "pg_isready", "--username", databaseName, "--dbname", databaseName],
      { cwd: repositoryRoot, env: forwardedEnvironment, encoding: "utf8", stdio: ["ignore", "ignore", "ignore"] },
    );
    if (check.status === 0) return;
    await delay(500);
  }
  throw new Error("Temporary PostgreSQL did not become ready; no project database command was run.");
}

async function cleanup() {
  if (containerName) {
    const result = spawnSync("docker", ["rm", "--force", containerName], {
      cwd: repositoryRoot,
      env: forwardedEnvironment,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
    if (result.error || result.status !== 0) {
      console.error("[E2E] Could not remove the temporary PostgreSQL container automatically.");
    } else {
      console.log("[E2E] Temporary PostgreSQL container removed.");
    }
  }

  if (nextDistDirectory) {
    try {
      await rm(resolve(repositoryRoot, nextDistDirectory), { recursive: true, force: true });
    } catch {
      console.error("[E2E] Could not remove the isolated Next.js build directory automatically.");
    }
  }

  if (nextTsconfigPath) {
    try {
      await rm(resolve(repositoryRoot, nextTsconfigPath), { force: true });
    } catch {
      console.error("[E2E] Could not remove the temporary TypeScript config automatically.");
    }
  }
}

async function main() {
  await run(process.execPath, ["--test", "scripts/e2e/database-safety.test.mjs"], {
    label: "checking destructive database guards",
  });

  try {
    capture("docker", ["info", "--format", "{{.ServerVersion}}"]);
  } catch {
    throw new Error("Docker Engine is required; E2E stopped before any project database command.");
  }

  const token = randomBytes(6).toString("hex");
  const databaseName = `emaus_e2e_${token}`;
  nextDistDirectory = `.next-e2e-${process.pid}-${token}`;
  nextTsconfigPath = `.tsconfig-e2e-${process.pid}-${token}.json`;
  await writeFile(
    resolve(repositoryRoot, nextTsconfigPath),
    await readFile(resolve(repositoryRoot, "tsconfig.json")),
  );
  const password = randomBytes(24).toString("hex");
  containerName = `emaus-e2e-${process.pid}-${databaseName}`;
  const postgresEnvironment = {
    ...forwardedEnvironment,
    POSTGRES_DB: databaseName,
    POSTGRES_USER: databaseName,
    POSTGRES_PASSWORD: password,
  };

  await run(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--label",
      "org.emaus.e2e=temporary",
      "--publish",
      "127.0.0.1::5432",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
      "--env",
      "POSTGRES_DB",
      "--env",
      "POSTGRES_USER",
      "--env",
      "POSTGRES_PASSWORD",
      "postgres:16-alpine",
    ],
    { env: postgresEnvironment, label: "starting an isolated, memory-backed PostgreSQL container" },
  );

  await waitForPostgres(containerName, databaseName);
  const published = capture("docker", ["port", containerName, "5432/tcp"]);
  const match = published.match(/^127\.0\.0\.1:(\d+)$/m);
  if (!match) throw new Error("Docker did not publish PostgreSQL on an IPv4 loopback port.");

  const databaseUrl = createDatabaseUrl(databaseName, password, Number(match[1]));
  assertDisposableDatabaseUrl(databaseUrl);
  const environment = {
    ...forwardedEnvironment,
    DATABASE_URL: databaseUrl,
    E2E_CONTAINER_NAME: containerName,
    E2E_DATABASE_NAME: databaseName,
    E2E_DATABASE_USER: databaseName,
    NEXT_DIST_DIR: nextDistDirectory,
    NEXT_TSCONFIG_PATH: nextTsconfigPath,
  };

  // Keep reset behind the URL guard and pass only the runner-created endpoint.
  assertDisposableDatabaseUrl(environment.DATABASE_URL);
  const resetArgs = ["migrate", "reset", "--force"];
  if (capacityMode || restoreSmokeMode) resetArgs.push("--skip-seed");
  await run(resolve(repositoryRoot, "node_modules/.bin/prisma"), resetArgs, {
    env: environment,
    label: "applying migrations to the disposable database",
  });

  if (capacityMode) {
    await run(process.execPath, ["scripts/e2e/seed-capacity.mjs"], {
      env: environment,
      label: "creating 500 synthetic people and 20 synthetic accounts",
    });
    const generatedEnvironmentFile = resolve(repositoryRoot, "next-env.d.ts");
    let originalEnvironmentFile;
    try {
      originalEnvironmentFile = await readFile(generatedEnvironmentFile);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await run("npm", ["run", "build"], {
        env: environment,
        label: "building the production app for the capacity run",
      });
    } finally {
      if (originalEnvironmentFile) await writeFile(generatedEnvironmentFile, originalEnvironmentFile);
    }
  } else if (restoreSmokeMode) {
    await run(process.execPath, ["scripts/e2e/restore-smoke.mjs"], {
      env: environment,
      label: "restoring a synthetic PostgreSQL dump into a second disposable database",
    });
  }

  const playwrightArgs = capacityMode
    ? ["test", "e2e/capacity.spec.ts", "--project=chromium", ...options]
    : restoreSmokeMode
      ? []
      : ["test", "--grep-invert", "@capacity", ...options];
  if (!restoreSmokeMode) {
    const testEnvironment = capacityMode
      ? { ...environment, PLAYWRIGHT_SERVER_MODE: "production" }
      : environment;
    await run(resolve(repositoryRoot, "node_modules/.bin/playwright"), playwrightArgs, {
      env: testEnvironment,
      label: capacityMode ? "running the 20-session capacity scenario" : "running Playwright E2E tests",
    });
  }
}

try {
  await main();
} catch (error) {
  process.exitCode = interrupted ? 130 : 1;
  if (!interrupted) console.error(`[E2E] ${error.message}`);
} finally {
  await cleanup();
}
