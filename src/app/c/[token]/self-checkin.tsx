"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { selfCheckinAction, selfVisitorAction } from "../actions";

type Step = { kind: "phone" } | { kind: "visitor" } | { kind: "reception" } | { kind: "done"; names: string[]; visitor?: boolean };

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function SelfCheckin({ token }: { token: string }) {
  const [step, setStep] = useState<Step>({ kind: "phone" });
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (step.kind === "done") {
    return (
      <div className="mt-10 animate-in rounded-3xl border bg-card p-8 text-center shadow-sm duration-500 fade-in zoom-in-95">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-background"><Check className="size-8" strokeWidth={3} /></div>
        <p className="mt-5 font-display text-3xl">
          {step.visitor ? `Seja bem-vindo, ${step.names[0]}!` : `Presença confirmada, ${step.names.join(" e ")}!`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {step.visitor ? "Ficamos muito felizes com sua visita. Alguém da equipe vai falar com você." : "Que bom ter você aqui hoje."}
        </p>
      </div>
    );
  }

  if (step.kind === "reception") {
    return (
      <div className="mt-10 rounded-3xl border bg-card p-6 text-center shadow-sm">
        <p className="font-display text-3xl">Que bom ter você aqui!</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Não encontramos esse número. Procure alguém da recepção para registrar sua presença.
        </p>
        <button type="button" className="mt-4 text-sm underline" onClick={() => setStep({ kind: "phone" })}>
          Tentar outro número
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-10 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          if (step.kind === "phone") {
            const r = await selfCheckinAction(token, phone);
            if (!r.ok) return setError(r.error);
            if (r.data.found) setStep({ kind: "done", names: r.data.names });
            else setStep({ kind: r.data.allowRegister ? "visitor" : "reception" });
          } else {
            const r = await selfVisitorAction(token, name, phone);
            if (!r.ok) return setError(r.error);
            setStep({ kind: "done", names: [r.data.name], visitor: true });
          }
        });
      }}
    >
      {step.kind === "phone" ? (
        <>
          <label htmlFor="phone" className="block text-lg">Qual é o seu celular?</label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            placeholder="(11) 99999-0000"
            className="h-14 text-2xl tracking-wide"
            autoFocus
            required
          />
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-2xl bg-gold/10 p-4 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" />
            Não encontramos esse número. É sua primeira vez? Conta pra gente seu nome.
          </div>
          <label htmlFor="name" className="block text-lg">Seu nome completo</label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-14 text-xl" autoFocus required />
          <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setStep({ kind: "phone" })}>
            Digitei o número errado
          </button>
        </>
      )}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={pending}>
        {pending ? <Spinner /> : <>{step.kind === "phone" ? "Confirmar presença" : "Concluir"} <ArrowRight data-icon="inline-end" /></>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Seu número é usado apenas para registrar sua presença na igreja.</p>
    </form>
  );
}
