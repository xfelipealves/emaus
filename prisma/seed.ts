import { PrismaClient } from "@prisma/client";

export const seedPrisma = new PrismaClient();

// Replaced by the Argon2 service in T11; this seed never stores the development password.
export const DEVELOPMENT_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$ZW1hdXMtZGV2LXNlZWQ$ZGV2ZWxvcG1lbnQtaGFzaA";

export async function seed() {
  return seedPrisma.account.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@emaus.local",
      passwordHash: DEVELOPMENT_PASSWORD_HASH,
      role: "ADMINISTRATOR",
      person: {
        create: {
          fullName: "Administrador de Desenvolvimento",
          status: "MEMBER",
          phone: "(00) 00000-0000",
          birthDate: new Date("1990-01-01T00:00:00.000Z"),
        },
      },
    },
    update: {
      email: "admin@emaus.local",
      passwordHash: DEVELOPMENT_PASSWORD_HASH,
      role: "ADMINISTRATOR",
      status: "ACTIVE",
      person: {
        update: {
          fullName: "Administrador de Desenvolvimento",
          status: "MEMBER",
          phone: "(00) 00000-0000",
          birthDate: new Date("1990-01-01T00:00:00.000Z"),
        },
      },
    },
    include: { person: true },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then((account) => {
      console.log(`Seeded development administrator: ${account.username}`);
    })
    .finally(() => seedPrisma.$disconnect());
}
