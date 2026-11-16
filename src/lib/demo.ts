/**
 * This deployment hosts the public, synthetic-data demonstration: the login page shows the demo
 * credentials and `db:seed` marks its church as demo. Restrictions apply per church (`church.demo`).
 */
export function isDemoMode() {
  return process.env.EMAUS_DEMO_MODE === "true";
}

export const DEMO_MANAGEMENT_MESSAGE = "Contas e configuração de IA ficam protegidas na demonstração pública.";

/** Demo visitors may sign in/out and read sessions, but cannot modify shared accounts. */
export function demoAllowsAuthPath(path: string) {
  return new Set([
    "/sign-in/username", "/sign-in/email", "/sign-out", "/get-session", "/list-sessions",
  ]).has(path);
}
