import type { PersonStatus } from "@prisma/client";
import { createPerson, type PersonActor } from "./person-service";

export type PersonRegistrationInput = {
  type: "visitor" | "member";
  fullName: string;
  phone?: string;
  birthDate?: Date;
};

export async function registerPerson(actor: PersonActor, input: PersonRegistrationInput) {
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new Error("Nome completo é obrigatório.");
  }

  const phone = input.phone?.trim() || undefined;
  if (input.type === "member" && !phone) {
    throw new Error("Telefone é obrigatório para membros.");
  }

  if (input.type === "member" && !input.birthDate) {
    throw new Error("Data de nascimento é obrigatória para membros.");
  }

  const status: PersonStatus = input.type === "member" ? "MEMBER" : "VISITOR";
  return createPerson(actor, {
    fullName,
    status,
    phone,
    birthDate: input.birthDate,
  });
}
