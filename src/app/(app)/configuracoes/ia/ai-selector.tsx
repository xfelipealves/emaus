"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { saveAiSettingsAction } from "../actions";

type Price = { input: number; output: number };
type Option = {
  id: string;
  label: string;
  note: string;
  configured: boolean;
  keyEnv: string;
  models: { id: string; label: string; price: Price }[];
};

function priceLabel(price: Price) {
  if (!price.input && !price.output) return "grátis";
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `US$ ${f(price.input)} / ${f(price.output)} por milhão de tokens`;
}
const EFFORT_LABEL = { none: "Nenhum (mais rápido)", low: "Baixo (recomendado)", medium: "Médio", high: "Alto (mais lento)" } as const;

export function AiSelector({
  options,
  active,
  model,
  effort,
}: {
  options: Option[];
  active: string | null;
  model: string | null;
  effort: string | null;
}) {
  const [provider, setProvider] = useState(active ?? options.find((o) => o.configured)?.id ?? "openai");
  const firstModel = (id: string) => options.find((o) => o.id === id)?.models[0]?.id ?? "";
  const [modelValue, setModelValue] = useState((provider === active && model) || firstModel(provider));
  const [effortValue, setEffortValue] = useState(effort ?? "low");
  const save = useAction(saveAiSettingsAction);
  const current = options.find((o) => o.id === provider);
  const visible = options.filter((o) => o.configured || ["openai", "groq"].includes(o.id));

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <h2 className="text-sm font-semibold">Provedor de IA</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        As chaves ficam no <code className="rounded bg-muted px-1">.env</code> do servidor. Trocar de provedor vale para as próximas conversas; as antigas continuam no histórico.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={!o.configured}
            onClick={() => {
              setProvider(o.id);
              setModelValue(firstModel(o.id));
            }}
            className={cn(
              "relative rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              provider === o.id ? "border-primary bg-primary/6 ring-1 ring-primary" : "hover:bg-muted/50",
            )}
          >
            {provider === o.id && <Check className="absolute top-3 right-3 size-4 text-primary" />}
            <div className="text-sm font-medium">{o.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{o.configured ? o.note : `Sem chave: defina ${o.keyEnv} no .env`}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField
          label="Modelo"
          htmlFor="ai-model"
          hint={current?.models.find((m) => m.id === modelValue) ? priceLabel(current.models.find((m) => m.id === modelValue)!.price) : undefined}
        >
          {current?.models.length ? (
            <NativeSelect id="ai-model" value={modelValue} onChange={(e) => setModelValue(e.target.value)}>
              {/* Mantém um modelo salvo que não está mais na lista. */}
              {!current.models.some((m) => m.id === modelValue) && modelValue && <option value={modelValue}>{modelValue}</option>}
              {current.models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </NativeSelect>
          ) : (
            <Input id="ai-model" value={modelValue} onChange={(e) => setModelValue(e.target.value)} placeholder="nome-do-modelo" />
          )}
        </FormField>
        {provider === "openai" && (
          <FormField label="Esforço de raciocínio" htmlFor="ai-effort">
            <NativeSelect id="ai-effort" value={effortValue} onChange={(e) => setEffortValue(e.target.value)}>
              {Object.entries(EFFORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </FormField>
        )}
      </div>
      <Button
        className="mt-4"
        disabled={save.pending}
        onClick={() => save.run({ provider, model: modelValue || undefined, effort: provider === "openai" ? effortValue : undefined })}
      >
        {save.pending ? <Spinner /> : "Salvar"}
      </Button>
    </div>
  );
}
