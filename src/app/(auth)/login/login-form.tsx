"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.username({
      username: String(form.get("username")).trim().toLowerCase(),
      password: String(form.get("password")),
      rememberMe: true,
    });
    if (error) {
      setPending(false);
      setError(
        error.status === 403
          ? (error.message ?? "Esta conta está desativada.")
          : error.status === 429
            ? "Muitas tentativas. Aguarde um minuto."
            : "Usuário ou senha incorretos.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="username">Usuário</FieldLabel>
          <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required autoFocus className="h-10" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
          {pending ? <Spinner /> : <>Entrar <ArrowRight data-icon="inline-end" /></>}
        </Button>
      </FieldGroup>
    </form>
  );
}
