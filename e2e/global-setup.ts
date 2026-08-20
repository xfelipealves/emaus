import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export default function globalSetup() {
  execFileSync(resolve(process.cwd(), "node_modules/.bin/prisma"), ["migrate", "reset", "--force"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}
