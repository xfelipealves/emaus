/** Server-side opt-in for the public, synthetic-data demonstration. */
export function isDemoMode() {
  return process.env.EMAUS_DEMO_MODE === "true";
}

export const DEMO_MANAGEMENT_MESSAGE = "Contas e configuração de IA ficam protegidas na demonstração pública.";

/** Demo visitors may sign in/out and read sessions, but cannot modify shared accounts. */
export function demoAllowsAuthPath(path: string) {
  return !isDemoMode() || new Set([
    "/sign-in/username", "/sign-in/email", "/sign-out", "/get-session", "/list-sessions",
  ]).has(path);
}
