"use client";

import { CalendarPlus, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { ToneDot } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { RECURRENCE_LABEL, WEEKDAY_LABEL } from "@/lib/labels";
import { saveEventAction } from "@/app/(app)/encontros/actions";

export type EventFormInitial = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  date: string;
  time: string;
  durationMinutes: number;
  location: string | null;
  ministryIds: string[];
};

export function EventSheet({
  categories,
  ministries,
  initial,
  defaultOpen = false,
  today,
}: {
  categories: { id: string; name: string; color: string }[];
  ministries: { id: string; name: string; color: string }[];
  initial?: EventFormInitial;
  defaultOpen?: boolean;
  today: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [recurrence, setRecurrence] = useState("none");
  const [date, setDate] = useState(initial?.date ?? today);
  const [audience, setAudience] = useState<Set<string>>(new Set(initial?.ministryIds ?? []));
  const router = useRouter();
  const save = useAction((form: FormData) => saveEventAction(initial?.id ?? null, form), {
    onSuccess: (d) => {
      setOpen(false);
      if (!initial) router.push(`/encontros/${d.id}`);
    },
  });
  const e = save.fieldErrors;
  const weekday = WEEKDAY_LABEL[new Date(`${date}T12:00:00Z`).getUTCDay()]?.toLowerCase();

  return (
    <>
      {initial ? (
        <Button variant="outline" onClick={() => setOpen(true)}><Pencil data-icon="inline-start" /> Editar</Button>
      ) : (
        <Button onClick={() => setOpen(true)}><CalendarPlus data-icon="inline-start" /> Novo encontro</Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl font-normal">{initial ? "Editar encontro" : "Novo encontro"}</SheetTitle>
            <SheetDescription>Cultos, células, reuniões e eventos. A presença é lançada dentro de cada encontro.</SheetDescription>
          </SheetHeader>
          <form
            className="grid gap-4 px-4 pb-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              save.run(new FormData(ev.currentTarget));
            }}
          >
            <FormField label="Título" htmlFor="ev-title" error={e.title}>
              <Input id="ev-title" name="title" defaultValue={initial?.title} placeholder="Culto de Celebração" required autoFocus />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Categoria" htmlFor="ev-cat">
                <NativeSelect id="ev-cat" name="categoryId" defaultValue={initial?.categoryId ?? categories[0]?.id ?? ""}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label="Local" htmlFor="ev-loc">
                <Input id="ev-loc" name="location" defaultValue={initial?.location ?? ""} placeholder="Templo" />
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Data" htmlFor="ev-date" error={e.date} className="col-span-3 sm:col-span-1">
                <Input id="ev-date" name="date" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} required />
              </FormField>
              <FormField label="Início" htmlFor="ev-time" error={e.time}>
                <Input id="ev-time" name="time" type="time" defaultValue={initial?.time ?? "19:00"} required />
              </FormField>
              <FormField label="Duração" htmlFor="ev-dur">
                <NativeSelect id="ev-dur" name="durationMinutes" defaultValue={String(initial?.durationMinutes ?? 120)}>
                  {[60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m / 60}h{m % 60 ? "30" : ""}</option>)}
                </NativeSelect>
              </FormField>
            </div>

            {!initial && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Repetir" htmlFor="ev-rec">
                  <NativeSelect id="ev-rec" name="recurrence" value={recurrence} onChange={(ev) => setRecurrence(ev.target.value)}>
                    <option value="none">Não repetir</option>
                    {Object.entries(RECURRENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect>
                </FormField>
                {recurrence !== "none" && (
                  <FormField label="Até (opcional)" htmlFor="ev-until">
                    <Input id="ev-until" name="until" type="date" min={date} />
                  </FormField>
                )}
              </div>
            )}
            {recurrence !== "none" && (
              <p className="-mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {recurrence === "monthly" ? `Todo mês, na mesma semana, ${weekday}.` : `${RECURRENCE_LABEL[recurrence as "weekly"]}, ${weekday}.`} Os próximos encontros são criados automaticamente.
              </p>
            )}

            <FormField label="Público" hint={audience.size ? "Só participantes destes ministérios aparecem na lista de presença." : "Igreja toda: todos os ativos aparecem na lista de presença."}>
              <div className="grid grid-cols-2 gap-1.5">
                {[...audience].map((id) => <input key={id} type="hidden" name="ministryIds[]" value={id} />)}
                {ministries.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/6">
                    <Checkbox
                      checked={audience.has(m.id)}
                      onCheckedChange={(c) => setAudience((s) => { const n = new Set(s); if (c) n.add(m.id); else n.delete(m.id); return n; })}
                    />
                    <ToneDot tone={m.color} /> <span className="truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </FormField>

            <FormField label="Descrição" htmlFor="ev-desc">
              <Textarea id="ev-desc" name="description" rows={2} defaultValue={initial?.description ?? ""} />
            </FormField>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={save.pending} className="min-w-32">
                {save.pending ? <Spinner /> : initial ? "Salvar" : "Criar encontro"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
