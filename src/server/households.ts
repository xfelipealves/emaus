import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HOUSEHOLD_ROLES } from "@/db/schema";
import { recordTimeline } from "./history";
import { ActionError, assertCanSeePerson, type CurrentUser, visiblePersonIds } from "./session";

export const householdInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da família").max(80),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function listHouseholds(user: CurrentUser) {
  const visible = await visiblePersonIds(user);
  const houses = await db.query.household.findMany({
    orderBy: asc(sql`lower(${schema.household.name})`),
    with: {
      members: {
        columns: { id: true, fullName: true, preferredName: true, status: true, householdRole: true, birthDate: true },
      },
    },
  });
  return visible
    ? houses.filter((h) => h.members.some((m) => visible.has(m.id)))
    : houses;
}

export async function getHousehold(user: CurrentUser, id: string) {
  const house = await db.query.household.findFirst({
    where: eq(schema.household.id, id),
    with: { members: true },
  });
  if (!house) return null;
  const visible = await visiblePersonIds(user);
  if (visible && !house.members.some((m) => visible.has(m.id))) return null;
  return house;
}

export async function createHousehold(raw: unknown) {
  const input = householdInput.parse(raw);
  const [created] = await db
    .insert(schema.household)
    .values({ name: input.name, address: input.address ?? null, phone: input.phone ?? null })
    .returning();
  return created;
}

export async function updateHousehold(id: string, raw: unknown) {
  const input = householdInput.parse(raw);
  await db
    .update(schema.household)
    .set({ name: input.name, address: input.address ?? null, phone: input.phone ?? null })
    .where(eq(schema.household.id, id));
}

export async function deleteHousehold(id: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.person)
      .set({ householdId: null, householdRole: null })
      .where(eq(schema.person.householdId, id));
    await tx.delete(schema.household).where(eq(schema.household.id, id));
  });
}

export async function setHouseholdMember(
  user: CurrentUser,
  householdId: string,
  personId: string,
  role: (typeof HOUSEHOLD_ROLES)[number] | null,
) {
  await assertCanSeePerson(user, personId);
  const house = await db.query.household.findFirst({ where: eq(schema.household.id, householdId) });
  if (!house) throw new ActionError("Família não encontrada.");
  await db.transaction(async (tx) => {
    if (role === null) {
      await tx
        .update(schema.person)
        .set({ householdId: null, householdRole: null })
        .where(eq(schema.person.id, personId));
      await recordTimeline(tx, {
        personId,
        actorId: user.id,
        kind: "household",
        title: `Saiu da família ${house.name}`,
      });
      return;
    }
    const current = await tx.query.person.findFirst({ where: eq(schema.person.id, personId) });
    await tx
      .update(schema.person)
      .set({ householdId, householdRole: role })
      .where(eq(schema.person.id, personId));
    if (current?.householdId !== householdId) {
      await recordTimeline(tx, {
        personId,
        actorId: user.id,
        kind: "household",
        title: `Entrou na família ${house.name}`,
      });
    }
  });
}
