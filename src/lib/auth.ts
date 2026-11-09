import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const auth = betterAuth({
  appName: "Emaús",
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    // Contas são criadas por administradores em Configurações → Usuários.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "secretary" },
      active: { type: "boolean", input: false, defaultValue: true },
      personId: { type: "string", input: false, required: false },
    },
  },
  databaseHooks: {
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
