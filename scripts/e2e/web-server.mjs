import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { assertDisposableDatabaseUrl } from "./database-safety.mjs";

assertDisposableDatabaseUrl(process.env.DATABASE_URL);

const portValue = process.env.PLAYWRIGHT_PORT ?? "3100";
if (!/^\d+$/.test(portValue) || Number(portValue) < 1024 || Number(portValue) > 65535) {
  throw new Error("PLAYWRIGHT_PORT must be an available unprivileged TCP port.");
}

const serverMode = process.env.PLAYWRIGHT_SERVER_MODE ?? "development";
if (serverMode !== "development" && serverMode !== "production") {
  throw new Error("PLAYWRIGHT_SERVER_MODE must be development or production.");
}

const next = resolve(process.cwd(), "node_modules/.bin/next");
const args = serverMode === "production"
  ? ["start", "--hostname", "127.0.0.1", "--port", portValue]
  : ["dev", "--hostname", "127.0.0.1", "--port", portValue];
const server = spawn(next, args, { stdio: "inherit", env: process.env });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.once("error", (error) => {
  console.error(`Unable to start the Playwright web server: ${error.message}`);
  process.exitCode = 1;
});
server.once("close", (code, signal) => {
  process.exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : code ?? 1;
});
