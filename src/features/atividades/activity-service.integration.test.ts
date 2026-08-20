import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  createActivity,
  createSubtask,
  deleteActivity,
  deleteSubtask,
  getActivityActor,
  listActivities,
  updateActivity,
  updateSubtask,
} from "./activity-service";

describe("shared activity service", () => {
  const suffix = Date.now().toString();
  let administratorId: string;
  let secretaryId: string;
  let inactiveId: string;

  beforeAll(async () => {
    const administrator = await prisma.account.create({
      data: {
        username: `activities-admin-${suffix}`,
        email: `activities-admin-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
        person: { create: { fullName: `Activities admin ${suffix}` } },
      },
    });
    const secretary = await prisma.account.create({
      data: {
        username: `activities-secretary-${suffix}`,
        email: `activities-secretary-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "SECRETARY",
        person: { create: { fullName: `Activities secretary ${suffix}` } },
      },
    });
    const inactive = await prisma.account.create({
      data: {
        username: `activities-inactive-${suffix}`,
        email: `activities-inactive-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "LEADER",
        status: "INACTIVE",
        person: { create: { fullName: `Activities inactive ${suffix}` } },
      },
    });

    administratorId = administrator.id;
    secretaryId = secretary.id;
    inactiveId = inactive.id;
  });

  afterAll(async () => {
    await prisma.activity.deleteMany({
      where: { title: { contains: suffix } },
    });
    await prisma.account.deleteMany({
      where: { id: { in: [administratorId, secretaryId, inactiveId] } },
    });
    await prisma.person.deleteMany({
      where: { fullName: { contains: suffix } },
    });
  });

  it("shares activities across active users and filters tomorrow separately", async () => {
    const tomorrow = await createActivity(
      { id: administratorId },
      { title: `Revisar tomorrow ${suffix}`, bucket: "TOMORROW" },
    );
    await createActivity(
      { id: secretaryId },
      { title: `Planejar backlog ${suffix}`, bucket: "BACKLOG" },
    );

    const visibleToSecretary = await listActivities({ id: secretaryId });
    const tomorrowOnly = await listActivities({ id: secretaryId }, "TOMORROW");

    expect(visibleToSecretary.map((activity) => activity.id)).toEqual(
      expect.arrayContaining([tomorrow.id]),
    );
    expect(tomorrowOnly).toHaveLength(1);
    expect(tomorrowOnly[0]).toMatchObject({ id: tomorrow.id, bucket: "TOMORROW" });
  });

  it("updates an activity bucket and rejects empty titles", async () => {
    const activity = await createActivity(
      { id: administratorId },
      { title: `Mover atividade ${suffix}`, bucket: "BACKLOG" },
    );

    const updated = await updateActivity(
      { id: secretaryId },
      activity.id,
      { title: `Atividade estacionada ${suffix}`, bucket: "PARKED" },
    );

    expect(updated).toMatchObject({ title: `Atividade estacionada ${suffix}`, bucket: "PARKED" });
    await expect(
      createActivity({ id: administratorId }, { title: "  ", bucket: "BACKLOG" }),
    ).rejects.toThrow("Título da atividade é obrigatório.");
  });

  it("rejects inactive accounts before reading or changing shared activities", async () => {
    await expect(getActivityActor(inactiveId)).resolves.toBeNull();
    await expect(listActivities({ id: inactiveId })).rejects.toThrow("Sessão inválida.");
    await expect(
      createActivity({ id: inactiveId }, { title: `Bloqueada ${suffix}`, bucket: "BACKLOG" }),
    ).rejects.toThrow("Sessão inválida.");
  });

  it("rejects invalid buckets and missing activity references", async () => {
    await expect(listActivities({ id: administratorId }, "INVALID" as never)).rejects.toThrow("Área da atividade inválida.");
    await expect(
      updateActivity(
        { id: administratorId },
        "missing-activity",
        { title: `Não encontrada ${suffix}`, bucket: "BACKLOG" },
      ),
    ).rejects.toThrow("Atividade não encontrada.");
    await expect(
      createSubtask({ id: administratorId }, { activityId: "missing-activity", title: `Subtask ${suffix}` }),
    ).rejects.toThrow("Atividade não encontrada.");
  });

  it("supports subtask create, update, completion and delete without deleting the parent", async () => {
    const activity = await createActivity(
      { id: administratorId },
      { title: `Atividade com subtasks ${suffix}`, bucket: "BACKLOG" },
    );
    const subtask = await createSubtask(
      { id: secretaryId },
      { activityId: activity.id, title: `Subtask original ${suffix}` },
    );

    const updated = await updateSubtask(
      { id: administratorId },
      subtask.id,
      { title: `Subtask concluída ${suffix}`, completed: true },
    );
    expect(updated).toMatchObject({ title: `Subtask concluída ${suffix}`, completed: true, activityId: activity.id });

    await deleteSubtask({ id: secretaryId }, subtask.id);
    const remaining = await prisma.activity.findUnique({ where: { id: activity.id }, include: { subtasks: true } });
    expect(remaining).toMatchObject({ id: activity.id, title: `Atividade com subtasks ${suffix}` });
    expect(remaining?.subtasks).toHaveLength(0);
    await expect(
      createSubtask({ id: administratorId }, { activityId: activity.id, title: "  " }),
    ).rejects.toThrow("Título da subtask é obrigatório.");
  });

  it("deletes an activity together with all subtasks and leaves audit evidence", async () => {
    const activity = await createActivity(
      { id: administratorId },
      { title: `Excluir atividade ${suffix}`, bucket: "PARKED" },
    );
    await createSubtask({ id: secretaryId }, { activityId: activity.id, title: `Subtask a remover ${suffix}` });

    await deleteActivity({ id: secretaryId }, activity.id);

    await expect(prisma.activity.findUnique({ where: { id: activity.id } })).resolves.toBeNull();
    await expect(prisma.activitySubtask.count({ where: { activityId: activity.id } })).resolves.toBe(0);
    await expect(
      prisma.auditEvent.findFirst({ where: { targetType: "Activity", targetId: activity.id, action: "DELETE" } }),
    ).resolves.toMatchObject({ actorId: secretaryId, targetType: "Activity", targetId: activity.id, action: "DELETE" });
  });
});
