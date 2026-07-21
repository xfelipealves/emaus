import { AccountRole, AccountStatus, PrismaClient } from "@prisma/client";

const developmentAdmin = {
  fullName: "Administrador Emaús",
  username: "admin",
  email: "admin@emaus.local",
  passwordHash:
    "$argon2id$v=19$m=65536,t=3,p=4$ZGV2ZWxvcG1lbnQtc2VlZA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

export async function seed(database: PrismaClient): Promise<void> {
  const person =
    (await database.person.findFirst({ where: { fullName: developmentAdmin.fullName } })) ??
    (await database.person.create({ data: { fullName: developmentAdmin.fullName } }));

  await database.account.upsert({
    where: { username: developmentAdmin.username },
    create: {
      personId: person.id,
      username: developmentAdmin.username,
      email: developmentAdmin.email,
      passwordHash: developmentAdmin.passwordHash,
      role: AccountRole.ADMIN,
      status: AccountStatus.ACTIVE,
    },
    update: {
      personId: person.id,
      email: developmentAdmin.email,
      passwordHash: developmentAdmin.passwordHash,
      role: AccountRole.ADMIN,
      status: AccountStatus.ACTIVE,
    },
  });
}

if (process.argv[1]?.endsWith("prisma/seed.ts")) {
  const database = new PrismaClient();

  seed(database)
    .finally(() => database.$disconnect())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
