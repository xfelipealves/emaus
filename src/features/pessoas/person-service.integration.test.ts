import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createPerson } from "./person-service";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

describe("Person service", () => {
  const personIds: string[] = [];
  const accountIds: string[] = [];

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: accountIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("requires a role authorized to manage people", async () => {
    await expect(
      createPerson(
        { id: "unauthorized-account", role: "LEADER" },
        { fullName: "Pessoa não criada" },
      ),
    ).rejects.toThrow("não tem permissão");
  });

  it("persists the person, timeline event and audit event in one transaction", async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: "Autor T16" } });
    personIds.push(actorPerson.id);
    const actor = await prisma.account.create({
      data: {
        personId: actorPerson.id,
        username: "autor-t16",
        email: "autor-t16@example.test",
        passwordHash: "test-hash",
        role: "SECRETARY",
      },
    });
    accountIds.push(actor.id);

    const person = await createPerson(
      { id: actor.id, role: "SECRETARY" },
      { fullName: "  Pessoa criada T16  " },
    );
    personIds.push(person.id);

    const timeline = await prisma.timelineEvent.findFirstOrThrow({
      where: { personId: person.id },
    });
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { targetType: "Person", targetId: person.id },
    });

    expect(person.fullName).toBe("Pessoa criada T16");
    expect(person.status).toBe("VISITOR");
    expect(timeline.category).toBe("REGISTRATION");
    expect(timeline.title).toBe("Pessoa cadastrada");
    expect(timeline.description).toBe("Pessoa criada T16");
    expect(audit.actorId).toBe(actor.id);
    expect(audit.action).toBe("CREATE");
    expect(audit.before).toBeNull();
    expect(audit.after).toEqual({
      id: person.id,
      fullName: "Pessoa criada T16",
      status: "VISITOR",
      phone: null,
      birthDate: null,
      profilePhotoUrl: null,
    });
  });

  it("rolls back the person and emitted events when the transaction fails", async () => {
    const failedId = "rollback-person-t16";

    await expect(
      withTransaction(async (transaction) => {
        await transaction.person.create({ data: { id: failedId, fullName: "Rollback T16" } });
        await recordTimelineEvent(transaction, {
          personId: failedId,
          category: "REGISTRATION",
          title: "Pessoa cadastrada",
          occurredAt: new Date("2026-08-08T12:00:00.000Z"),
        });
        await recordAuditEvent(transaction, {
          actorId: "missing-actor",
          targetType: "Person",
          targetId: failedId,
          action: "CREATE",
        });
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(
      prisma.person.findUnique({ where: { id: failedId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.timelineEvent.findFirst({ where: { personId: failedId } }),
    ).resolves.toBeNull();
  });
});
