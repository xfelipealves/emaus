"use client";

import { LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZONES } from "@/app/(app)/configuracoes/church-form";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { authClient } from "@/lib/auth-client";
import { createChurchAction, saveChurchBudgetAction, savePlatformBudgetAction, setChurchActiveAction } from "./actions";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut data-icon="inline-start" /> Sair
    </Button>
  );
}

export function NewChurchButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useAction(createChurchAction, {
    onSuccess: ({ id }) => {
      setOpen(false);
      router.push(`/plataforma/igrejas/${id}`);
    },
  });
  const e = create.fieldErrors;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" /> Nova igreja
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova igreja</DialogTitle>
          </DialogHeader>
          <form
            id="new-church"
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              create.run(new FormData(ev.currentTarget));
            }}
          >
            <FormField label="Nome da igreja" htmlFor="c-name" error={e.name}>
              <Input id="c-name" name="name" required />
            </FormField>
            <FormField label="Fuso horário" htmlFor="c-tz" error={e.timezone}>
              <NativeSelect id="c-tz" name="timezone" defaultValue="America/Sao_Paulo">
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z.replace("America/", "").replace("_", " ")}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <p className="pt-2 text-sm font-medium">Primeiro administrador</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nome" htmlFor="c-admin" error={e.adminName}>
                <Input id="c-admin" name="adminName" required />
              </FormField>
              <FormField label="Usuário" htmlFor="c-user" error={e.adminUsername ?? e.username}>
                <Input id="c-user" name="adminUsername" autoCapitalize="none" required />
              </FormField>
            </div>
            <FormField label="E-mail" htmlFor="c-mail" error={e.adminEmail ?? e.email}>
              <Input id="c-mail" name="adminEmail" type="email" required />
            </FormField>
            <FormField label="Senha provisória" htmlFor="c-pass" error={e.password} hint="A pessoa troca no primeiro acesso.">
              <Input id="c-pass" name="password" type="text" minLength={8} required />
            </FormField>
          </form>
          <DialogFooter>
            <Button type="submit" form="new-church" disabled={create.pending}>
              {create.pending ? <Spinner /> : "Criar igreja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Teto em US$ por dia; vazio = sem teto. */
function BudgetInput({ name, label, value, error }: { name: string; label: string; value: number | null; error?: string }) {
  return (
    <FormField label={label} htmlFor={`b-${name}`} error={error} hint="Em US$ por dia. Vazio = sem teto.">
      <Input id={`b-${name}`} name={name} inputMode="decimal" defaultValue={value ?? ""} placeholder="sem teto" className="w-36" />
    </FormField>
  );
}

export function ChurchBudgetForm({ churchId, church, user }: { churchId: string; church: number | null; user: number | null }) {
  const save = useAction(saveChurchBudgetAction.bind(null, churchId));
  return (
    <form
      className="flex flex-wrap items-end gap-4 px-5 pb-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        save.run(new FormData(ev.currentTarget));
      }}
    >
      <BudgetInput name="aiDailyBudgetUsd" label="Igreja toda" value={church} error={save.fieldErrors.aiDailyBudgetUsd} />
      <BudgetInput name="aiUserDailyBudgetUsd" label="Por pessoa" value={user} error={save.fieldErrors.aiUserDailyBudgetUsd} />
      <Button type="submit" variant="outline" disabled={save.pending}>
        {save.pending ? <Spinner /> : "Salvar limites"}
      </Button>
    </form>
  );
}

export function PlatformBudgetForm({ value }: { value: number | null }) {
  const save = useAction(savePlatformBudgetAction);
  return (
    <form
      className="flex flex-wrap items-end gap-4 px-5 pb-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        save.run(new FormData(ev.currentTarget));
      }}
    >
      <BudgetInput name="aiDailyBudgetUsd" label="Todas as igrejas" value={value} error={save.fieldErrors.aiDailyBudgetUsd} />
      <Button type="submit" variant="outline" disabled={save.pending}>
        {save.pending ? <Spinner /> : "Salvar"}
      </Button>
    </form>
  );
}

export function ChurchActiveButton({ churchId, active }: { churchId: string; active: boolean }) {
  const toggle = useAction(setChurchActiveAction);
  return (
    <Button
      variant={active ? "destructive" : "default"}
      disabled={toggle.pending}
      onClick={() => {
        if (active && !confirm("Suspender o acesso desta igreja? Todas as sessões abertas caem na hora.")) return;
        toggle.run(churchId, !active);
      }}
    >
      {toggle.pending ? <Spinner /> : active ? "Suspender acesso" : "Reativar acesso"}
    </Button>
  );
}
