"use client";

import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { saveSettingsAction } from "./actions";

const ZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Bahia", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon"];

export function ChurchForm({ settings }: { settings: { name: string; timezone: string; careThresholdDays: number } }) {
  const save = useAction(saveSettingsAction);
  const e = save.fieldErrors;
  return (
    <form
      className="max-w-xl space-y-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        save.run(new FormData(ev.currentTarget));
      }}
    >
      <FormField label="Nome da igreja" htmlFor="s-name" error={e.name}>
        <Input id="s-name" name="name" defaultValue={settings.name} required />
      </FormField>
      <FormField label="Fuso horário" htmlFor="s-tz" error={e.timezone} hint="Usado para datas de encontros, aniversários e relatórios.">
        <NativeSelect id="s-tz" name="timezone" defaultValue={settings.timezone}>
          {ZONES.map((z) => <option key={z} value={z}>{z.replace("America/", "").replace("_", " ")}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label="Alerta de afastamento (dias)" htmlFor="s-care" error={e.careThresholdDays} hint="Quem ficar mais que isso sem presença aparece em “Precisam de cuidado”.">
        <Input id="s-care" name="careThresholdDays" type="number" min={7} max={180} defaultValue={settings.careThresholdDays} className="w-32" />
      </FormField>
      <Button type="submit" disabled={save.pending}>{save.pending ? <Spinner /> : "Salvar"}</Button>
    </form>
  );
}
