import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createAccount, deactivateAccount, resetAccountPassword } from "./account-service";
import { verifyPassword } from "./password";

describe("account administration", () => {
  const suffix = Date.now().toString();
  const personIds: string[] = [];
  const accountIds: string[] = [];
  let adminId: string;

  const actor = () => ({ id: adminId, role: "ADMINISTRATOR" as const });
  const secretary = { id: "non-admin-account-service", role: "SECRETARY" as const };

  beforeAll(async () => {
    const admin = await prisma.account.create({
      data: {
        username: `account-admin-${suffix}`,
        email: `account-admin-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
        person: { create: { fullName: `Administrador de contas ${suffix}` } },
      },
    });
    adminId = admin.id;
    personIds.push(admin.personId);
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ targetId: { in: accountIds } }, { actorId: adminId }] },
    });
    await prisma.account.deleteMany({ where: { id: { in: [...accountIds, adminId] } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("creates an account only for an existing person and persists its role", async () => {
    const person = await prisma.person.create({ data: { fullName: `Conta T15 ${suffix}` } });
    personIds.push(person.id);

    const account = await createAccount(actor(), {
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

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { targetType: "Account", targetId: account.id, action: "CREATE" },
    });
    expect(audit).toMatchObject({ actorId: adminId, before: null, after: { role: "LEADER", status: "ACTIVE" } });
    expect(JSON.stringify(audit)).not.toContain("senha-segura-t15");
    expect(JSON.stringify(audit)).not.toContain("passwordHash");
  });

  it("rejects a person that does not exist", async () => {
    await expect(
      createAccount(actor(), {
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
    const account = await createAccount(actor(), {
      personId: existingPerson.id,
      username,
      email,
      password: "senha-segura-t15",
      role: "SECRETARY",
    });
    accountIds.push(account.id);

    await expect(createAccount(actor(), {
      personId: usernameDuplicatePerson.id,
      username,
      email: `outro-${suffix}@example.test`,
      password: "senha-segura-t15",
      role: "SECRETARY",
    })).rejects.toThrow("Nome de usuário, e-mail ou Pessoa já está em uso.");
    await expect(createAccount(actor(), {
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
    const account = await createAccount(actor(), {
      personId: person.id,
      username: `deactivate-t15-${suffix}`,
      email: `deactivate-t15-${suffix}@example.test`,
      password: "senha-segura-t15",
      role: "SECRETARY",
    });
    accountIds.push(account.id);

    const deactivated = await deactivateAccount(actor(), account.id);
    const persisted = await prisma.account.findUnique({ where: { id: account.id } });
    const persistedPerson = await prisma.person.findUnique({ where: { id: person.id } });

    expect(deactivated.status).toBe("INACTIVE");
    expect(persisted?.id).toBe(account.id);
    expect(persistedPerson?.id).toBe(person.id);
    await expect(prisma.session.count({ where: { accountId: account.id } })).resolves.toBe(0);
    await expect(prisma.auditEvent.findFirst({
      where: { targetType: "Account", targetId: account.id, action: "DEACTIVATE" },
    })).resolves.toMatchObject({
      actorId: adminId,
      before: { status: "ACTIVE" },
      after: { status: "INACTIVE" },
    });
  });

  it("lets an administrator reset a password and audits without storing either password", async () => {
    const person = await prisma.person.create({ data: { fullName: `Redefinição T15 ${suffix}` } });
    personIds.push(person.id);
    const account = await createAccount(actor(), {
      personId: person.id,
      username: `reset-t15-${suffix}`,
      email: `reset-t15-${suffix}@example.test`,
      password: "senha-inicial-t15",
      role: "SECRETARY",
    });
    accountIds.push(account.id);

    await resetAccountPassword(actor(), account.id, "senha-redefinida-t15");

    const persisted = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { targetType: "Account", targetId: account.id, action: "PASSWORD_RESET" },
    });
    await expect(verifyPassword(persisted.passwordHash, "senha-redefinida-t15")).resolves.toBe(true);
    expect(audit.actorId).toBe(adminId);
    expect(JSON.stringify(audit)).not.toContain("senha-inicial-t15");
    expect(JSON.stringify(audit)).not.toContain("senha-redefinida-t15");
    expect(JSON.stringify(audit)).not.toContain("passwordHash");
  });

  it("denies non-administrators from deactivating or resetting another account", async () => {
    const person = await prisma.person.create({ data: { fullName: `Acesso conta T15 ${suffix}` } });
    personIds.push(person.id);
    const account = await createAccount(actor(), {
      personId: person.id,
      username: `authorize-t15-${suffix}`,
      email: `authorize-t15-${suffix}@example.test`,
      password: "senha-segura-t15",
      role: "SECRETARY",
    });
    accountIds.push(account.id);

    await expect(deactivateAccount(secretary, account.id)).rejects.toThrow("Apenas administradores podem gerenciar contas.");
    await expect(resetAccountPassword(secretary, account.id, "outra-senha-t15")).rejects.toThrow("Apenas administradores podem gerenciar contas.");
    await expect(prisma.account.findUniqueOrThrow({ where: { id: account.id } })).resolves.toMatchObject({ status: "ACTIVE" });
  });
});
