import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";

export const getSettings = cache(async () => {
  const row = await db.query.churchSettings.findFirst({
    where: eq(schema.churchSettings.id, 1),
  });
  if (row) return row;
  const [created] = await db
    .insert(schema.churchSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  return (
    created ??
    (await db.query.churchSettings.findFirst({
      where: eq(schema.churchSettings.id, 1),
    }))!
  );
});
