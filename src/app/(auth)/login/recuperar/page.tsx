"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { APP_NAME } from "@/app/app-identity";
import { requestPasswordRecoveryAction, type PasswordRecoveryActionState } from "../actions";

export default function RecoveryPage() {
  const [state, formAction, isPending] = useActionState<PasswordRecoveryActionState, FormData>(
    requestPasswordRecoveryAction,
    {},
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9f8] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#26766d]">{APP_NAME}</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Recuperação de senha</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Informe o e-mail da sua conta para ver as orientações de recuperação.</p>
        </div>

        <form action={formAction} className="grid gap-5">
          <Input id="email" name="email" label="E-mail da conta" type="email" autoComplete="email" required />
          {state.message ? (
            <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm leading-6 text-[#155e58]">
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending} className="min-h-12">
            {isPending ? "Enviando..." : "Solicitar recuperação"}
          </Button>
        </form>

        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[#26766d] underline-offset-4 hover:underline">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
