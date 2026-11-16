import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { demoAllowsAuthPath, DEMO_MANAGEMENT_MESSAGE, isDemoMode } from "@/lib/demo";
import { consumeRateLimit } from "@/server/rate-limit-store";

export const auth = betterAuth({
  appName: "Emaús",
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (demoAllowsAuthPath(ctx.path ?? "")) return;
      // Só as contas compartilhadas da igreja de demonstração ficam travadas; as demais seguem normais.
      const session = await getSessionFromCtx(ctx).catch(() => null);
      const church = session && (await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id),
        columns: {},
        with: { church: { columns: { demo: true } } },
      }))?.church;
      // Sem sessão (ex.: redefinição por token) só barra quando este deploy hospeda a demonstração.
      if (session ? church?.demo : isDemoMode()) {
        throw new APIError("FORBIDDEN", { message: DEMO_MANAGEMENT_MESSAGE });
      }
    }),
  },
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // Contas são criadas por administradores em Configurações → Usuários.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  // App restrito à liderança: poucas tentativas de login por IP.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: { "/sign-in/username": { window: 300, max: 8 } },
    // No banco, não na memória: na Vercel cada instância teria a sua contagem, zerada a cada cold start.
    customStorage: {
      consume: async (key, rule) => {
        const r = await consumeRateLimit(`auth:${key}`, rule.max, rule.window * 1000);
        return { allowed: r.allowed, retryAfter: r.allowed ? null : Math.ceil(r.retryAfterMs / 1000) };
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Sem cache em cookie: "encerrar sessões" e desativar conta valem na hora.
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "secretary" },
      active: { type: "boolean", input: false, defaultValue: true },
      mustChangePassword: { type: "boolean", input: false, defaultValue: false },
      personId: { type: "string", input: false, required: false },
      churchId: { type: "string", input: false, required: false },
      platformAdmin: { type: "boolean", input: false, defaultValue: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const account = await db.query.user.findFirst({
            where: eq(schema.user.id, session.userId),
            columns: { active: true, platformAdmin: true },
            with: { church: { columns: { active: true } } },
          });
          if (!account?.active) {
            throw new APIError("FORBIDDEN", {
              message: "Esta conta está desativada.",
            });
          }
          if (!account.church?.active && !account.platformAdmin) {
            throw new APIError("FORBIDDEN", {
              message: "O acesso desta igreja está suspenso. Fale com o suporte do Emaús.",
            });
          }
        },
      },
    },
  },
  plugins: [username(), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
