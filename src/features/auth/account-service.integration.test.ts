import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createAccount, deactivateAccount } from "./account-service";

describe("account administration", () => {
  const actor = { role: "ADMINISTRATOR" as const };
  const secretary = { role: "SECRETARY" as const };
  const suffix = Date.now().toString();
  const personIds: string[] = [];
  const accountIds: string[] = [];

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("creates an account only for an existing person and persists its role", async () => {
    const person = await prisma.person.create({ data: { fullName: `Conta T15 ${suffix}` } });
    personIds.push(person.id);

    const account = await createAccount(actor, {
      personId: person.id,
      username: `conta-t15-${suffix}`,
      email: `conta-t15-${suffix}@example.test`,
      password: "senha-segura-t15",
      role: "LEADER",
    });
    accountIds.push(account.id);

    expect(account.personId).toBe(person.id);
    expect(account.role).toBe("LEADER");
    expect(account.status).toBe("ACTIVE");
    expect(account.passwordHash).not.toBe("senha-segura-t15");
  });

  it("rejects a person that does not exist", async () => {
    await expect(
      createAccount(actor, {
        personId: "missing-person-t15",
        username: `missing-t15-${suffix}`,
        email: `missing-t15-${suffix}@example.test`,
        password: "senha-segura-t15",
        role: "SECRETARY",
      }),
    ).rejects.toThrow("Pessoa não encontrada.");
  });

  it("denies account administration to non-administrators", async () => {
    await expect(
      createAccount(secretary, {
        personId: "missing-person-t15",
        username: `denied-t15-${suffix}`,
        email: `denied-t15-${suffix}@example.test`,
        password: "senha-segura-t15",
        role: "SECRETARY",
      }),
    ).rejects.toThrow("Apenas administradores podem gerenciar contas.");
  });

  it("deactivates an account without deleting its person or account history", async () => {
    const person = await prisma.person.create({ data: { fullName: `Desativação T15 ${suffix}` } });
    personIds.push(person.id);
    const account = await createAccount(actor, {
      personId: person.id,
      username: `deactivate-t15-${suffix}`,
      email: `deactivate-t15-${suffix}@example.test`,
      password: "senha-segura-t15",
      role: "SECRETARY",
    });
    accountIds.push(account.id);

    const deactivated = await deactivateAccount(actor, account.id);
    const persisted = await prisma.account.findUnique({ where: { id: account.id } });
    const persistedPerson = await prisma.person.findUnique({ where: { id: person.id } });

    expect(deactivated.status).toBe("INACTIVE");
    expect(persisted?.id).toBe(account.id);
    expect(persistedPerson?.id).toBe(person.id);
  });
});
