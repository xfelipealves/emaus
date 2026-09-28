"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MinistryMembershipRole } from "@prisma/client";
import { getSession } from "@/features/auth/session-service";
import { createMembership, endMembership, updateMembershipRole } from "@/features/ministerios/membership-service";
import { parseDateInput } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type MembershipActionState = { error?: string; success?: string };

async function requireAdministrator() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem gerenciar vínculos ministeriais.");
  }
  return account;
}

function requiredValue(formData: FormData, field: string, message: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new Error(message);
  return value;
}

function requiredDate(formData: FormData, field: string, message: string) {
  return parseDateInput(requiredValue(formData, field, message));
}

function requiredRole(formData: FormData): MinistryMembershipRole {
  const role = String(formData.get("role") ?? "");
  if (role !== "MEMBER" && role !== "LEADER") {
    throw new Error("Selecione um cargo ministerial válido.");
  }
  return role;
}

function refreshMembershipPaths(ministryId: string, personId: string) {
  revalidatePath(`/ministerios/${ministryId}/vinculos`);
  revalidatePath(`/ministerios/${ministryId}`);
  revalidatePath("/ministerios");
  revalidatePath(`/pessoas/${personId}`);
  revalidatePath(`/pessoas/${personId}/timeline`);
  revalidatePath("/encontros");
}

export async function createMembershipAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  try {
    const actor = await requireAdministrator();
    const ministryId = requiredValue(formData, "ministryId", "Ministério não informado.");
    const personId = requiredValue(formData, "personId", "Selecione uma Pessoa.");
    const membership = await createMembership(
      { id: actor.id, role: actor.role },
      {
        ministryId,
        personId,
        role: requiredRole(formData),
        startDate: requiredDate(formData, "startDate", "Informe a data de entrada."),
      },
    );
    refreshMembershipPaths(membership.ministryId, membership.personId);
    return { success: "Vínculo criado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o vínculo." };
  }
}

export async function updateMembershipRoleAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  try {
    const actor = await requireAdministrator();
    const membershipId = requiredValue(formData, "membershipId", "Vínculo não informado.");
    const membership = await updateMembershipRole(
      { id: actor.id, role: actor.role },
      membershipId,
      {
        role: requiredRole(formData),
        effectiveDate: requiredDate(formData, "effectiveDate", "Informe a data efetiva do cargo."),
      },
    );
    refreshMembershipPaths(membership.ministryId, membership.personId);
    return { success: "Cargo atualizado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar o cargo." };
  }
}

export async function endMembershipAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  let membership: Awaited<ReturnType<typeof endMembership>>;
  try {
    const actor = await requireAdministrator();
    const membershipId = requiredValue(formData, "membershipId", "Vínculo não informado.");
    membership = await endMembership(
      { id: actor.id, role: actor.role },
      membershipId,
      { endDate: requiredDate(formData, "endDate", "Informe a data de saída.") },
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível encerrar o vínculo." };
  }

  refreshMembershipPaths(membership.ministryId, membership.personId);
  redirect(`/ministerios/${membership.ministryId}/vinculos?ended=${encodeURIComponent(membership.id)}`);
}
