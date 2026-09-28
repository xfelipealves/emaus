import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { listAccounts, listPeopleWithoutAccounts } from "@/features/auth/account-service";
import { listLeaderScopeConfiguration } from "@/features/ministerios/access-scope-service";
import { listMinistries } from "@/features/ministerios/ministry-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { CreateAccountForm, DeactivateAccountForm } from "./account-forms";
import { MinistryAccessForm } from "./ministry-access-form";

export default async function UsersPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.role !== "ADMINISTRATOR") redirect("/");

  const [accounts, people, leaders, ministries] = await Promise.all([
    listAccounts(session),
    listPeopleWithoutAccounts(session),
    listLeaderScopeConfiguration({ id: session.id, role: session.role }),
    listMinistries({ id: session.id, role: session.role, ministryAccess: [] }),
  ]);
  const activeMinistries = ministries
    .filter((ministry) => ministry.status === "ACTIVE")
    .map((ministry) => ({ id: ministry.id, name: ministry.name }));

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <p className="text-sm font-medium text-[#26766d]">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Usuários e acessos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Gerencie contas internas vinculadas às Pessoas da comunidade.</p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <CreateAccountForm people={people} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Contas cadastradas</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {accounts.map((account) => (
              <div key={account.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{account.person.fullName}</p>
                  <p className="text-sm text-slate-500">@{account.username} · {account.role === "ADMINISTRATOR" ? "Administrador" : account.role === "LEADER" ? "Líder" : "Secretaria"}</p>
                  <p className={`mt-1 text-xs font-semibold ${account.status === "ACTIVE" ? "text-[#26766d]" : "text-slate-400"}`}>{account.status === "ACTIVE" ? "Ativa" : "Desativada"}</p>
                </div>
                {account.status === "ACTIVE" ? <DeactivateAccountForm accountId={account.id} personName={account.person.fullName} /> : null}
              </div>
            ))}
            {accounts.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma conta cadastrada.</p> : null}
          </div>
        </section>
      </div>
      <div className="mt-6">
        <MinistryAccessForm leaders={leaders} ministries={activeMinistries} />
      </div>
    </div>
  );
}
