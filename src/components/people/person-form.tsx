"use client";

import { useState } from "react";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { HouseholdRole, PersonStatus } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { HOUSEHOLD_ROLE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { createPersonAction, updatePersonAction } from "@/app/(app)/pessoas/actions";

export type PersonFormValues = {
  id?: string;
  fullName?: string;
  preferredName?: string | null;
  status?: PersonStatus;
  gender?: "female" | "male" | null;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null;
  address?: string | null;
  householdId?: string | null;
  householdRole?: HouseholdRole | null;
  firstVisitDate?: string | null;
  memberSince?: string | null;
  howFound?: string | null;
};

export function PersonForm({
  initial = {},
  households,
  onDone,
}: {
  initial?: PersonFormValues;
  households: { id: string; name: string }[];
  onDone?: (id: string) => void;
}) {
  const editing = !!initial.id;
  const [status, setStatus] = useState<PersonStatus>(initial.status ?? "visitor");
  const [householdId, setHouseholdId] = useState(initial.householdId ?? "");
  const create = useAction(createPersonAction, { onSuccess: (d) => onDone?.(d.id) });
  const update = useAction((form: FormData) => updatePersonAction(initial.id!, form), {
    onSuccess: () => onDone?.(initial.id!),
  });
  const { pending, fieldErrors: e } = editing ? update : create;

  return (
    <form
      className="grid gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = new FormData(ev.currentTarget);
        if (editing) update.run(form);
        else create.run(form);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
        <FormField label="Nome completo" htmlFor="fullName" error={e.fullName}>
          <Input id="fullName" name="fullName" defaultValue={initial.fullName} required autoFocus={!editing} autoComplete="off" />
        </FormField>
        <FormField label="Como gosta de ser chamado" htmlFor="preferredName" error={e.preferredName}>
          <Input id="preferredName" name="preferredName" defaultValue={initial.preferredName ?? ""} placeholder="Opcional" />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" value={status} onChange={(ev) => setStatus(ev.target.value as PersonStatus)}>
            {(["visitor", "member", "inactive"] as const).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Nascimento" htmlFor="birthDate" error={e.birthDate}>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={initial.birthDate ?? ""} />
        </FormField>
        <FormField label="Sexo" htmlFor="gender">
          <NativeSelect id="gender" name="gender" defaultValue={initial.gender ?? ""}>
            <option value="">—</option>
            <option value="female">Feminino</option>
            <option value="male">Masculino</option>
          </NativeSelect>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Celular / WhatsApp" htmlFor="phone" error={e.phone} hint="Usado no check-in por QR Code">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial.phone ?? ""} placeholder="(11) 99999-0000" />
        </FormField>
        <FormField label="E-mail" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" defaultValue={initial.email ?? ""} />
        </FormField>
      </div>

      <FormField label="Endereço" htmlFor="address" error={e.address}>
        <Input id="address" name="address" defaultValue={initial.address ?? ""} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Família" htmlFor="householdId">
          <NativeSelect id="householdId" name="householdId" value={householdId} onChange={(ev) => setHouseholdId(ev.target.value)}>
            <option value="">Sem família vinculada</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </NativeSelect>
        </FormField>
        {householdId && (
          <FormField label="Papel na família" htmlFor="householdRole">
            <NativeSelect id="householdRole" name="householdRole" defaultValue={initial.householdRole ?? "other"}>
              {(["head", "spouse", "child", "other"] as const).map((r) => (
                <option key={r} value={r}>{HOUSEHOLD_ROLE_LABEL[r]}</option>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Primeira visita" htmlFor="firstVisitDate" error={e.firstVisitDate}>
          <Input id="firstVisitDate" name="firstVisitDate" type="date" defaultValue={initial.firstVisitDate ?? ""} />
        </FormField>
        {status !== "visitor" && (
          <FormField label="Membro desde" htmlFor="memberSince" error={e.memberSince}>
            <Input id="memberSince" name="memberSince" type="date" defaultValue={initial.memberSince ?? ""} />
          </FormField>
        )}
      </div>

      {status === "visitor" && (
        <FormField label="Como conheceu a igreja" htmlFor="howFound">
          <Textarea id="howFound" name="howFound" rows={2} defaultValue={initial.howFound ?? ""} placeholder="Convite de amigo, redes sociais…" />
        </FormField>
      )}

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 bg-gradient-to-t from-popover via-popover to-transparent px-1 pt-4 pb-1">
        <Button type="submit" size="lg" disabled={pending} className="min-w-32">
          {pending ? <Spinner /> : editing ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
