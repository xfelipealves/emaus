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

  it("rejects duplicate usernames and emails without persisting another account", async () => {
    const [existingPerson, usernameDuplicatePerson, emailDuplicatePerson] = await Promise.all([
      prisma.person.create({ data: { fullName: `Conta única T15 ${suffix}` } }),
      prisma.person.create({ data: { fullName: `Username duplicado T15 ${suffix}` } }),
      prisma.person.create({ data: { fullName: `E-mail duplicado T15 ${suffix}` } }),
    ]);
    personIds.push(existingPerson.id, usernameDuplicatePerson.id, emailDuplicatePerson.id);
    const username = `conta-unica-t15-${suffix}`;
    const email = `conta-unica-t15-${suffix}@example.test`;
    const account = await createAccount(actor, {
      personId: existingPerson.id,
      username,
      email,
      password: "senha-segura-t15",
      role: "SECRETARY",
    });
    accountIds.push(account.id);

    await expect(createAccount(actor, {
      personId: usernameDuplicatePerson.id,
      username,
      email: `outro-${suffix}@example.test`,
      password: "senha-segura-t15",
      role: "SECRETARY",
    })).rejects.toThrow("Nome de usuário, e-mail ou Pessoa já está em uso.");
    await expect(createAccount(actor, {
      personId: emailDuplicatePerson.id,
      username: `outro-username-${suffix}`,
      email: email.toUpperCase(),
      password: "senha-segura-t15",
      role: "SECRETARY",
    })).rejects.toThrow("Nome de usuário, e-mail ou Pessoa já está em uso.");

    await expect(prisma.account.count({ where: { personId: { in: [usernameDuplicatePerson.id, emailDuplicatePerson.id] } } })).resolves.toBe(0);
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
