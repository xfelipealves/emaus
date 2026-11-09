"use client";

import { Check, HeartHandshake, MessageCircle, Phone, Plus, RotateCcw, Trash2, House, HandHeart, CircleDot } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { PersonAvatar } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/dates";
import { FOLLOW_UP_KIND_LABEL } from "@/lib/labels";
import { displayName, whatsappUrl } from "@/lib/text";
import { cn } from "@/lib/utils";
import { completeFollowUpAction, createFollowUpAction, deleteFollowUpAction, reopenFollowUpAction } from "@/app/(app)/pessoas/actions";

type Kind = keyof typeof FOLLOW_UP_KIND_LABEL;
export const KIND_ICON: Record<Kind, typeof Phone> = {
  call: Phone,
  visit: House,
  message: MessageCircle,
  prayer: HandHeart,
  other: CircleDot,
};

export type FollowUpRow = {
  id: string;
  title: string;
  kind: Kind;
  dueDate: string | null;
  doneAt: Date | null;
  outcome: string | null;
  person?: { id: string; fullName: string; preferredName: string | null; phone: string | null };
  assignee: { id: string; name: string } | null;
};

export function FollowUpDialog({
  open,
  onOpenChange,
  people,
  personId,
  assignees,
  currentUserId,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people?: { id: string; name: string }[];
  personId?: string;
  assignees: { id: string; name: string }[];
  currentUserId: string;
  defaultTitle?: string;
}) {
  const create = useAction(createFollowUpAction, { onSuccess: () => onOpenChange(false) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo acompanhamento</DialogTitle>
          <DialogDescription>Um lembrete de cuidado: ligar, visitar, mandar mensagem ou orar.</DialogDescription>
        </DialogHeader>
        <form
          id="follow-up-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.run(new FormData(e.currentTarget));
          }}
        >
          {personId ? (
            <input type="hidden" name="personId" value={personId} />
          ) : (
            <FormField label="Pessoa" htmlFor="fu-person" error={create.fieldErrors.personId}>
              <NativeSelect id="fu-person" name="personId" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {people?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="O que fazer" htmlFor="fu-title" error={create.fieldErrors.title}>
            <Input id="fu-title" name="title" required defaultValue={defaultTitle} placeholder="Ligar para saber como está" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Tipo" htmlFor="fu-kind">
              <NativeSelect id="fu-kind" name="kind" defaultValue="call">
                {Object.entries(FOLLOW_UP_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="Responsável" htmlFor="fu-assignee">
              <NativeSelect id="fu-assignee" name="assigneeId" defaultValue={currentUserId}>
                {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="Até" htmlFor="fu-due">
              <Input id="fu-due" name="dueDate" type="date" />
            </FormField>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="follow-up-form" disabled={create.pending}>
            {create.pending ? <Spinner /> : "Criar acompanhamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewFollowUpButton(props: Omit<Parameters<typeof FollowUpDialog>[0], "open" | "onOpenChange"> & { label?: string; variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={props.variant ?? "outline"} onClick={() => setOpen(true)}>
        <HeartHandshake data-icon="inline-start" /> {props.label ?? "Acompanhar"}
      </Button>
      <FollowUpDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function FollowUpItem({ item, today, showPerson }: { item: FollowUpRow; today: string; showPerson?: boolean }) {
  const [doneOpen, setDoneOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const complete = useAction(completeFollowUpAction, { onSuccess: () => setDoneOpen(false) });
  const reopen = useAction(reopenFollowUpAction);
  const remove = useAction(deleteFollowUpAction);
  const Icon = KIND_ICON[item.kind];
  const overdue = !item.doneAt && item.dueDate && item.dueDate < today;
  const wa = item.person ? whatsappUrl(item.person.phone) : null;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        aria-label={item.doneAt ? "Reabrir" : "Concluir"}
        onClick={() => (item.doneAt ? reopen.run(item.id) : setDoneOpen(true))}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          item.doneAt ? "border-success bg-success text-background" : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {item.doneAt && <Check className="size-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-medium", item.doneAt && "text-muted-foreground line-through")}>{item.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Icon className="size-3" /> {FOLLOW_UP_KIND_LABEL[item.kind]}</span>
          {showPerson && item.person && (
            <Link href={`/pessoas/${item.person.id}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
              <PersonAvatar name={displayName(item.person)} seed={item.person.id} size="xs" className="size-4 text-[8px]" />
              {displayName(item.person)}
            </Link>
          )}
          {item.assignee && <span>· {item.assignee.name}</span>}
          {item.dueDate && !item.doneAt && (
            <span className={cn(overdue && "font-medium text-destructive")}>
              · {item.dueDate === today ? "hoje" : overdue ? `atrasado (${formatDate(item.dueDate, undefined, { day: "2-digit", month: "short" })})` : `até ${formatDate(item.dueDate, undefined, { day: "2-digit", month: "short" })}`}
            </span>
          )}
          {item.doneAt && <span>· concluído {formatDate(item.doneAt, undefined, { day: "2-digit", month: "short" })}</span>}
        </div>
        {item.outcome && <p className="mt-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">{item.outcome}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        {wa && !item.doneAt && (
          <Button variant="ghost" size="icon-sm" aria-label="WhatsApp" render={<a href={wa} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <MessageCircle />
          </Button>
        )}
        {item.doneAt ? (
          <Button variant="ghost" size="icon-sm" aria-label="Reabrir" onClick={() => reopen.run(item.id)}><RotateCcw /></Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => remove.run(item.id)}><Trash2 /></Button>
        )}
      </div>
      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir acompanhamento</DialogTitle>
            <DialogDescription>{item.title}</DialogDescription>
          </DialogHeader>
          <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} placeholder="Como foi? (opcional) — fica registrado na linha do tempo." autoFocus />
          <DialogFooter>
            <Button disabled={complete.pending} onClick={() => complete.run(item.id, outcome)}>
              {complete.pending ? <Spinner /> : <><Check data-icon="inline-start" /> Concluir</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function FollowUpEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
      <Plus className="size-4" />
      {children}
    </div>
  );
}
