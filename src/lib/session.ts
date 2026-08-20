import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "emaus_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function createSessionCookie(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: sessionCookieOptions(expiresAt),
  };
}

export function expiredSessionCookieOptions() {
  return {
    ...sessionCookieOptions(new Date(0)),
    maxAge: 0,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    options: expiredSessionCookieOptions(),
  };
}
