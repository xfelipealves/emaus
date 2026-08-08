import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { getPersonTimeline, type TimelineFilter } from "./timeline-query";

describe("person timeline query", () => {
  const suffix = Date.now().toString();
  let accountId: string;
  let personId: string;
  let otherPersonId: string;
  let ministryId: string;

  beforeAll(async () => {
    const account = await prisma.account.create({
      data: {
        username: `t30-${suffix}`,
        email: `t30-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
        person: { create: { fullName: `Ator T30 ${suffix}` } },
      },
    });
    accountId = account.id;
    const person = await prisma.person.create({ data: { fullName: `Pessoa Timeline T30 ${suffix}` } });
    personId = person.id;
    const otherPerson = await prisma.person.create({ data: { fullName: `Outra Pessoa T30 ${suffix}` } });
    otherPersonId = otherPerson.id;
    const ministry = await prisma.ministry.create({ data: { name: `Ministério T30 ${suffix}` } });
    ministryId = ministry.id;

    await prisma.timelineEvent.createMany({
      data: [
        { personId, category: "STATUS", title: "Status alterado", occurredAt: new Date("2026-08-08T10:00:00.000Z") },
        { personId, category: "MINISTRY", title: "Vínculo iniciado", occurredAt: new Date("2026-08-08T11:00:00.000Z") },
        { personId, category: "ATTENDANCE", title: "Presença atualizada", occurredAt: new Date("2026-08-08T12:00:00.000Z") },
        { personId, category: "NOTE", title: "Nota adicionada", occurredAt: new Date("2026-08-08T13:00:00.000Z") },
        { personId, category: "CORRECTION", title: "Presença corrigida", occurredAt: new Date("2026-08-08T14:00:00.000Z") },
        { personId: otherPersonId, category: "STATUS", title: "Evento de outra pessoa", occurredAt: new Date("2026-08-08T15:00:00.000Z") },
      ],
    });
  });

  afterAll(async () => {
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: [personId, otherPersonId] } } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.person.deleteMany({ where: { id: { in: [personId, otherPersonId] } } });
  });

  it("returns only the person's events, newest first", async () => {
    const events = await getPersonTimeline({ id: accountId, role: "ADMINISTRATOR" }, personId);

    expect(events.map((event) => event.title)).toEqual([
      "Presença corrigida",
      "Nota adicionada",
      "Presença atualizada",
      "Vínculo iniciado",
      "Status alterado",
    ]);
    expect(events.every((event) => event.personId === personId)).toBe(true);
  });

  it.each([
    ["status", "STATUS"],
    ["ministries", "MINISTRY"],
    ["attendance", "ATTENDANCE"],
    ["notes", "NOTE"],
    ["corrections", "CORRECTION"],
  ] as const)("filters %s events by category", async (filter: TimelineFilter, category) => {
    const events = await getPersonTimeline({ id: accountId, role: "ADMINISTRATOR" }, personId, filter);

    expect(events).toHaveLength(1);
    expect(events[0].category).toBe(category);
    expect(events[0].personId).toBe(personId);
  });

  it("does not change persisted events when a filter is applied", async () => {
    const filtered = await getPersonTimeline({ id: accountId, role: "ADMINISTRATOR" }, personId, "notes");
    const all = await getPersonTimeline({ id: accountId, role: "ADMINISTRATOR" }, personId);

    expect(filtered).toHaveLength(1);
    expect(all).toHaveLength(5);
    await expect(prisma.timelineEvent.count({ where: { personId } })).resolves.toBe(5);
  });

  it("denies a leader without access to the person's ministry", async () => {
    const leader = await prisma.account.create({
      data: {
        username: `t30-leader-${suffix}`,
        email: `t30-leader-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "LEADER",
        person: { create: { fullName: `Líder T30 ${suffix}` } },
      },
    });

    await expect(getPersonTimeline({ id: leader.id, role: "LEADER" }, personId)).resolves.toEqual([]);
    await prisma.account.delete({ where: { id: leader.id } });
  });
});
