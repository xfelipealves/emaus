import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import { ActionError } from "./session";

/** Configurações da igreja (nome, fuso, IA…). Uma linha de `church` por tenant. */
export const getSettings = cache(async (churchId: string) => {
  const row = await db.query.church.findFirst({ where: eq(schema.church.id, churchId) });
  if (!row) throw new ActionError("Igreja não encontrada.");
  return row;
});

/** Configuração da plataforma (linha única), criada na primeira leitura. */
export const getPlatformSettings = cache(async () => {
  const row = await db.query.platformSettings.findFirst({ where: eq(schema.platformSettings.id, 1) });
  if (row) return row;
  await db.insert(schema.platformSettings).values({ id: 1 }).onConflictDoNothing();
  return (await db.query.platformSettings.findFirst({ where: eq(schema.platformSettings.id, 1) }))!;
});
