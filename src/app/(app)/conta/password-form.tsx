"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { changeOwnPasswordAction } from "./actions";

export function PasswordForm({ firstAccess }: { firstAccess: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useAction(changeOwnPasswordAction, {
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      if (firstAccess) router.replace("/");
    },
  });
  const mismatch = confirm.length > 0 && confirm !== next;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) change.run(current, next);
      }}
    >
      <FormField label={firstAccess ? "Senha provisória" : "Senha atual"} htmlFor="pw-current">
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </FormField>
      <FormField label="Nova senha" htmlFor="pw-new" hint="Mínimo de 8 caracteres.">
        <Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
      </FormField>
      <FormField label="Confirme a nova senha" htmlFor="pw-confirm" error={mismatch ? "As senhas não conferem." : undefined}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </FormField>
      <Button type="submit" disabled={change.pending || mismatch || next.length < 8} className="w-fit">
        {change.pending ? <Spinner /> : "Salvar nova senha"}
      </Button>
    </form>
  );
}
