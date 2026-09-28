import { expect, test } from "@playwright/test";
import { hashPassword, verifyPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";
import { DEMO_PASSWORD } from "./demo-fixtures";

test.describe.configure({ mode: "serial" });

let administratorId: string;

test.beforeAll(async () => {
  const administrator = await prisma.account.upsert({
    where: { username: "t13-admin" },
    create: {
      username: "t13-admin",
      email: "t13-admin@example.test",
      passwordHash: await hashPassword("senha-t13-valida"),
      role: "ADMINISTRATOR",
      person: { create: { fullName: "Administrador E2E T13" } },
    },
    update: {
      passwordHash: await hashPassword("senha-t13-valida"),
      status: "ACTIVE",
    },
  });
  administratorId = administrator.id;
});

test.afterAll(async () => {
  const qaAccounts = await prisma.account.findMany({
    where: { username: { startsWith: "t15-" } },
    select: { id: true },
  });
  await prisma.auditEvent.deleteMany({
    where: { OR: [{ actorId: administratorId }, { targetId: { in: qaAccounts.map(({ id }) => id) } }] },
  });
  await prisma.account.deleteMany({ where: { username: { startsWith: "t15-" } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: "Pessoa T15" } } });
  await prisma.account.deleteMany({ where: { username: "t13-admin" } });
  await prisma.person.deleteMany({ where: { fullName: "Administrador E2E T13" } });
  await prisma.$disconnect();
});

test("administrator creates and deactivates an account without deleting its person", async ({ page }) => {
  const person = await prisma.person.create({ data: { fullName: "Pessoa T15 E2E" } });

  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t13-admin");
  await page.getByLabel("Senha").fill("senha-t13-valida");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/configuracoes/usuarios");

  await page.getByLabel("Pessoa").selectOption(person.id);
  await page.getByLabel("Nome de usuário").fill("t15-e2e-user");
  await page.getByLabel("E-mail").fill("t15-e2e@example.test");
  await page.getByLabel("Senha").fill("senha-t15-e2e");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByRole("status")).toHaveText("Conta criada com sucesso.");
  await expect(page.getByText("@t15-e2e-user")).toBeVisible();
  const createdAccount = await prisma.account.findUniqueOrThrow({ where: { username: "t15-e2e-user" } });
  await expect(prisma.auditEvent.findFirst({
    where: { targetType: "Account", targetId: createdAccount.id, action: "CREATE" },
  })).resolves.toMatchObject({ actorId: administratorId, after: { status: "ACTIVE", role: "SECRETARY" } });

  const resetPassword = "senha-t15-redefinida";
  await page.getByLabel("Nova senha").fill(resetPassword);
  await page.getByRole("button", { name: "Redefinir senha" }).click();
  await expect(page.getByRole("status")).toHaveText("Senha redefinida com sucesso.");
  const resetAccount = await prisma.account.findUniqueOrThrow({ where: { id: createdAccount.id } });
  await expect(verifyPassword(resetAccount.passwordHash, resetPassword)).resolves.toBe(true);
  await expect(prisma.auditEvent.findFirst({
    where: { targetType: "Account", targetId: createdAccount.id, action: "PASSWORD_RESET" },
  })).resolves.toMatchObject({ actorId: administratorId });

  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t15-e2e-user");
  await page.getByLabel("Senha").fill("senha-t15-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Nome de usuário ou senha inválidos.")).toBeVisible();

  await page.getByLabel("Senha").fill(resetPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t13-admin");
  await page.getByLabel("Senha").fill("senha-t13-valida");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/configuracoes/usuarios");

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByText("@t15-e2e-user").locator("../..").getByRole("button", { name: "Desativar" }).click();
  await expect(page.getByText("Desativada")).toBeVisible();
  await expect.poll(async () => prisma.account.findUnique({ where: { username: "t15-e2e-user" }, select: { status: true } })).toEqual({ status: "INACTIVE" });
  expect(await prisma.person.findUnique({ where: { id: person.id } })).not.toBeNull();
  await expect(prisma.auditEvent.findFirst({
    where: { targetType: "Account", targetId: createdAccount.id, action: "DEACTIVATE" },
  })).resolves.toMatchObject({ actorId: administratorId, before: { status: "ACTIVE" }, after: { status: "INACTIVE" } });

  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t15-e2e-user");
  await page.getByLabel("Senha").fill(resetPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Nome de usuário ou senha inválidos.")).toBeVisible();
});

test("administrator settings navigation does not return 404 or redirect to ministries", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t13-admin");
  await page.getByLabel("Senha").fill("senha-t13-valida");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  const response = await page.goto("/configuracoes");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/configuracoes\/usuarios$/);
  await expect(page.getByRole("heading", { name: "Usuários e acessos" })).toBeVisible();
});

test("password recovery displays the same generic response for known and unknown emails", async ({ page }) => {
  await page.goto("/login/recuperar");
  await expect(page.getByRole("heading", { name: "Recuperação de senha" })).toBeVisible();

  await page.getByLabel("E-mail da conta").fill("t13-admin@example.test");
  await page.getByRole("button", { name: "Solicitar recuperação" }).click();
  const knownEmailResponse = await page.getByRole("status").innerText();

  await page.getByLabel("E-mail da conta").fill("endereco-inexistente@example.test");
  await page.getByRole("button", { name: "Solicitar recuperação" }).click();
  const unknownEmailResponse = await page.getByRole("status").innerText();

  expect(unknownEmailResponse).toBe(knownEmailResponse);
  expect(knownEmailResponse).toContain("peça a um administrador");
});

test("valid credentials reach the protected dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("demo-admin");
  await page.getByLabel("Senha").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "A comunidade em um só lugar." })).toBeVisible();
});

test("invalid credentials show generic feedback and stay on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t13-admin");
  await page.getByLabel("Senha").fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Nome de usuário ou senha inválidos.")).toBeVisible();
});
