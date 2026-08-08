"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { APP_NAME } from "@/app/app-identity";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9f8] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#26766d]">{APP_NAME}</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Bem-vindo de volta.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Entre para cuidar da comunidade com presença.</p>
        </div>

        <form action={formAction} className="grid gap-5">
          <Input id="username" name="username" label="Nome de usuário" autoComplete="username" required />
          <Input id="password" name="password" label="Senha" type="password" autoComplete="current-password" required />
          {state.error ? (
            <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending} className="mt-2 min-h-12">
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
