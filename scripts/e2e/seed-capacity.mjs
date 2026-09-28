import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const personCount = 500;
const accountCount = 20;
const password = "emaus-synthetic-capacity-test";
const prisma = new PrismaClient();

try {
  const existingPeople = await prisma.person.count();
  const existingAccounts = await prisma.account.count();
  if (existingPeople !== 0 || existingAccounts !== 0) {
    throw new Error("Capacity data requires an empty disposable database.");
  }

  const people = Array.from({ length: personCount }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return {
      id: `capacity-person-${number}`,
      fullName: `Pessoa Sintética ${number}`,
      status: "MEMBER",
      phone: `(00) 00000-${number}`,
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
    };
  });
  const passwordHash = await argon2.hash(password);

  await prisma.person.createMany({ data: people });
  await prisma.account.createMany({
    data: Array.from({ length: accountCount }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      const personNumber = String(index + 1).padStart(3, "0");
      return {
        personId: `capacity-person-${personNumber}`,
        username: `capacity-user-${number}`,
        email: `capacity-user-${number}@example.test`,
        passwordHash,
        role: "SECRETARY",
        status: "ACTIVE",
      };
    }),
  });

  const [preparedPeople, preparedAccounts] = await Promise.all([
    prisma.person.count(),
    prisma.account.count(),
  ]);
  if (preparedPeople !== personCount || preparedAccounts !== accountCount) {
    throw new Error("Capacity dataset counts do not match the requested profile.");
  }

  console.log(`Prepared ${preparedPeople} synthetic people and ${preparedAccounts} synthetic accounts.`);
} finally {
  await prisma.$disconnect();
}
