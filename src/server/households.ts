import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HOUSEHOLD_ROLES } from "@/db/schema";
import { recordTimeline } from "./history";
import { ActionError, assertCanSeePerson, type CurrentUser, inChurch, visiblePersonIds } from "./session";

export const householdInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da família").max(80),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function listHouseholds(user: CurrentUser) {
  const visible = await visiblePersonIds(user);
  const houses = await db.query.household.findMany({
    where: inChurch(user, schema.household),
    orderBy: asc(sql`lower(${schema.household.name})`),
    with: {
      members: {
        columns: { id: true, fullName: true, preferredName: true, status: true, householdRole: true, birthDate: true },
      },
    },
  });
  if (!visible) return houses;
  // Líder vê a família, mas só os membros que estão no escopo dele.
  return houses
    .map((h) => ({ ...h, members: h.members.filter((m) => visible.has(m.id)) }))
    .filter((h) => h.members.length > 0);
}

export async function getHousehold(user: CurrentUser, id: string) {
  const house = await db.query.household.findFirst({
    where: and(eq(schema.household.id, id), inChurch(user, schema.household)),
    with: { members: true },
  });
  if (!house) return null;
  const visible = await visiblePersonIds(user);
  if (!visible) return house;
  const members = house.members.filter((m) => visible.has(m.id));
  return members.length ? { ...house, members } : null;
}

export async function createHousehold(user: CurrentUser, raw: unknown) {
  const input = householdInput.parse(raw);
  const [created] = await db
    .insert(schema.household)
    .values({ churchId: user.churchId, name: input.name, address: input.address ?? null, phone: input.phone ?? null })
    .returning();
  return created;
}

export async function updateHousehold(user: CurrentUser, id: string, raw: unknown) {
  const input = householdInput.parse(raw);
  await db
    .update(schema.household)
    .set({ name: input.name, address: input.address ?? null, phone: input.phone ?? null })
    .where(and(eq(schema.household.id, id), inChurch(user, schema.household)));
}

export async function deleteHousehold(user: CurrentUser, id: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.person)
      .set({ householdId: null, householdRole: null })
      .where(and(eq(schema.person.householdId, id), inChurch(user, schema.person)));
    await tx.delete(schema.household).where(and(eq(schema.household.id, id), inChurch(user, schema.household)));
  });
}

export async function setHouseholdMember(
  user: CurrentUser,
  householdId: string,
  personId: string,
  role: (typeof HOUSEHOLD_ROLES)[number] | null,
) {
  await assertCanSeePerson(user, personId);
  // Líder só mexe em famílias que já enxerga: um id de fora não vira porta de acesso.
  const house = user.ministryIds
    ? await getHousehold(user, householdId)
    : await db.query.household.findFirst({ where: and(eq(schema.household.id, householdId), inChurch(user, schema.household)) });
  if (!house) throw new ActionError("Família não encontrada.");
  await db.transaction(async (tx) => {
    if (role === null) {
      await tx
        .update(schema.person)
        .set({ householdId: null, householdRole: null })
        .where(eq(schema.person.id, personId));
      await recordTimeline(tx, {
        churchId: user.churchId,
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
        churchId: user.churchId,
        personId,
        actorId: user.id,
        kind: "household",
        title: `Entrou na família ${house.name}`,
      });
    }
  });
}
