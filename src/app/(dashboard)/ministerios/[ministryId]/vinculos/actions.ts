"use server";

import type { MinistryMembershipRole } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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
  return { id: account.id, role: account.role } as const;
}

function parseRequiredDate(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) ?? "");
  if (!value) throw new Error(`Informe ${label}.`);
  return parseDateInput(value);
}

function parseRole(formData: FormData): MinistryMembershipRole {
  const role = String(formData.get("role") ?? "");
  if (role !== "MEMBER" && role !== "LEADER") {
    throw new Error("Cargo deve ser membro ou líder.");
  }
  return role;
}

function revalidateMembershipPaths(ministryId: string, personId: string) {
  revalidatePath(`/ministerios/${ministryId}`);
  revalidatePath(`/ministerios/${ministryId}/vinculos`);
  revalidatePath(`/pessoas/${personId}`);
  revalidatePath(`/pessoas/${personId}/timeline`);
}

export async function createMembershipAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const ministryId = String(formData.get("ministryId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requireAdministrator();
    await createMembership(actor, {
      ministryId,
      personId,
      role: parseRole(formData),
      startDate: parseRequiredDate(formData, "startDate", "a data de entrada"),
    });
    revalidateMembershipPaths(ministryId, personId);
    return { success: "Vínculo criado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o vínculo." };
  }
}

export async function updateMembershipRoleAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const ministryId = String(formData.get("ministryId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requireAdministrator();
    await updateMembershipRole(actor, membershipId, {
      role: parseRole(formData),
      effectiveDate: parseRequiredDate(formData, "effectiveDate", "a data efetiva do cargo"),
    });
    revalidateMembershipPaths(ministryId, personId);
    return { success: "Cargo atualizado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar o cargo." };
  }
}

export async function endMembershipAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const ministryId = String(formData.get("ministryId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requireAdministrator();
    await endMembership(actor, membershipId, {
      endDate: parseRequiredDate(formData, "endDate", "a data de saída"),
    });
    revalidateMembershipPaths(ministryId, personId);
    return { success: "Vínculo encerrado. O histórico foi preservado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível encerrar o vínculo." };
  }
}
