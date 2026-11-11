import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { demoAllowsAuthPath, DEMO_MANAGEMENT_MESSAGE } from "@/lib/demo";

export const auth = betterAuth({
  appName: "Emaús",
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!demoAllowsAuthPath(ctx.path ?? "")) {
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
    },
  },
  databaseHooks: {
    // App restrito à liderança: poucas tentativas de login por IP.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: { "/sign-in/username": { window: 300, max: 8 } },
  },
  session: {
      create: {
        before: async (session) => {
          const account = await db.query.user.findFirst({
            where: eq(schema.user.id, session.userId),
            columns: { active: true },
          });
          if (!account?.active) {
            throw new APIError("FORBIDDEN", {
              message: "Esta conta está desativada.",
            });
          }
        },
      },
    },
  },
  plugins: [username(), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
