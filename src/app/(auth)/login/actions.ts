"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/features/auth/password";
import { createSession } from "@/features/auth/session-service";
import { createSessionCookie } from "@/lib/session";
import { validateLoginInput } from "@/lib/validations/auth";
import { prisma } from "@/lib/prisma";

export type LoginActionState = {
  error?: string;
};

export type PasswordRecoveryActionState = {
  message?: string;
};

const invalidCredentialsMessage = "Nome de usuário ou senha inválidos.";
const passwordRecoveryMessage = "Se você não consegue acessar sua conta, peça a um administrador para redefinir sua senha.";

export async function requestPasswordRecoveryAction(
  _previousState: PasswordRecoveryActionState,
  _formData: FormData,
): Promise<PasswordRecoveryActionState> {
  void _previousState;
  void _formData;
  return { message: passwordRecoveryMessage };
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const input = {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const validation = validateLoginInput(input);

  if (!validation.success) {
    return { error: invalidCredentialsMessage };
  }

  const account = await prisma.account.findUnique({
    where: { username: validation.data.username.trim() },
  });

  let passwordMatches = false;
  if (account?.status === "ACTIVE") {
    try {
      passwordMatches = await verifyPassword(account.passwordHash, validation.data.password);
    } catch {
      passwordMatches = false;
    }
  }

  if (!account || account.status !== "ACTIVE" || !passwordMatches) {
    return { error: invalidCredentialsMessage };
  }

  const session = await createSession(account.id);
  const cookieStore = await cookies();
  const cookie = createSessionCookie(session.token, session.expiresAt);
  cookieStore.set(cookie.name, cookie.value, cookie.options);

  redirect("/");
}
