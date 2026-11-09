"use client";

import { KeyRound, LogOut, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { PersonAvatar, ToneBadge, ToneDot } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import type { Role } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createUserAction, resetPasswordAction, revokeSessionsAction, setUserActiveAction, updateUserAction } from "../actions";

type U = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  /** Texto pronto do servidor (evita divergência de hidratação). */
  lastSeen: string;
  personId: string | null;
  ministries: { id: string; name: string; color: string }[];
};
type M = { id: string; name: string; color: string };

const ROLE_HINT: Record<Role, string> = {
  admin: "Acesso total, inclusive configurações e auditoria.",
  secretary: "Cadastra pessoas, cria encontros e lança presença.",
  leader: "Vê e cuida apenas das pessoas dos ministérios liberados.",
};
const ROLE_TONE: Record<Role, string> = { admin: "ember", secretary: "sky", leader: "sage" };

export function UsersManager({ users, ministries, people, currentUserId }: { users: U[]; ministries: M[]; people: { id: string; name: string }[]; currentUserId: string }) {
  const [editing, setEditing] = useState<U | null | "new">(null);
  const [resetting, setResetting] = useState<U | null>(null);
  const active = useAction(setUserActiveAction);
  const revoke = useAction(revokeSessionsAction);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          O Emaús é restrito à liderança. Crie contas só para quem precisa acompanhar pessoas; a senha inicial é provisória e precisa ser trocada no primeiro acesso.
        </p>
        <Button onClick={() => setEditing("new")}><UserPlus data-icon="inline-start" /> Nova conta</Button>
      </div>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
        {users.map((u) => (
          <li key={u.id} className={cn("flex items-center gap-3 px-4 py-3 sm:px-5", !u.active && "opacity-55")}>
            <PersonAvatar name={u.name} seed={u.id} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.name}</span>
                <ToneBadge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</ToneBadge>
                {!u.active && <ToneBadge tone="slate">desativada</ToneBadge>}
                {u.active && u.mustChangePassword && <ToneBadge tone="gold">aguardando 1º acesso</ToneBadge>}
                {u.id === currentUserId && <span className="text-xs text-muted-foreground">(você)</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>@{u.username}</span>
                <span>{u.email}</span>
                <span>{u.lastSeen}</span>
                {u.role === "leader" && (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {u.ministries.length ? u.ministries.map((m) => <span key={m.id} className="inline-flex items-center gap-1"><ToneDot tone={m.color} />{m.name}</span>) : "sem ministérios liberados"}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ações" />}><MoreHorizontal /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setEditing(u)}><Pencil /> Editar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResetting(u)}><KeyRound /> Redefinir senha</DropdownMenuItem>
                {u.id !== currentUserId && <DropdownMenuItem onClick={() => revoke.run(u.id)}><LogOut /> Encerrar sessões</DropdownMenuItem>}
                {u.id !== currentUserId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant={u.active ? "destructive" : "default"} onClick={() => active.run(u.id, !u.active)}>
                      <Power /> {u.active ? "Desativar conta" : "Reativar conta"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          ministries={ministries}
          people={people}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function UserDialog({ user, ministries, people, onClose }: { user: U | null; ministries: M[]; people: { id: string; name: string }[]; onClose: () => void }) {
  const [role, setRole] = useState<Role>(user?.role ?? "secretary");
  const [access, setAccess] = useState(new Set(user?.ministries.map((m) => m.id) ?? []));
  const save = useAction((form: FormData) => (user ? updateUserAction(user.id, form) : createUserAction(form)), { onSuccess: onClose });
  const e = save.fieldErrors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>{user ? "Atualize o papel e os acessos." : "Passe o usuário e a senha provisória pessoalmente; no primeiro acesso a pessoa define a própria senha."}</DialogDescription>
        </DialogHeader>
        <form id="user-form" className="grid gap-4" onSubmit={(ev) => { ev.preventDefault(); save.run(new FormData(ev.currentTarget)); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome" htmlFor="u-name" error={e.name}>
              <Input id="u-name" name="name" defaultValue={user?.name} required autoFocus />
            </FormField>
            <FormField label="Usuário" htmlFor="u-username" error={e.username}>
              <Input id="u-username" name="username" defaultValue={user?.username} required autoCapitalize="none" placeholder="maria.silva" />
            </FormField>
          </div>
          <FormField label="E-mail" htmlFor="u-email" error={e.email}>
            <Input id="u-email" name="email" type="email" defaultValue={user?.email} required />
          </FormField>
          {!user && (
            <FormField label="Senha provisória" htmlFor="u-password" error={e.password} hint="Mínimo de 8 caracteres. Será trocada no primeiro acesso.">
              <Input id="u-password" name="password" type="text" minLength={8} required autoComplete="new-password" />
            </FormField>
          )}
          <FormField label="Papel" htmlFor="u-role" hint={ROLE_HINT[role]}>
            <NativeSelect id="u-role" name="role" value={role} onChange={(ev) => setRole(ev.target.value as Role)}>
              {(["admin", "secretary", "leader"] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </NativeSelect>
          </FormField>
          {role === "leader" && (
            <FormField label="Ministérios liberados">
              <div className="grid grid-cols-2 gap-1.5">
                {[...access].map((id) => <input key={id} type="hidden" name="ministryIds[]" value={id} />)}
                {ministries.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/6">
                    <Checkbox checked={access.has(m.id)} onCheckedChange={(c) => setAccess((s) => { const n = new Set(s); if (c) n.add(m.id); else n.delete(m.id); return n; })} />
                    <ToneDot tone={m.color} /> <span className="truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </FormField>
          )}
          <FormField label="Cadastro de pessoa vinculado" htmlFor="u-person" hint="Opcional: liga a conta ao perfil da pessoa na igreja.">
            <NativeSelect id="u-person" name="personId" defaultValue={user?.personId ?? ""}>
              <option value="">Nenhum</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </FormField>
        </form>
        <DialogFooter>
          <Button type="submit" form="user-form" disabled={save.pending}>{save.pending ? <Spinner /> : user ? "Salvar" : "Criar conta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: U; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useAction(resetPasswordAction, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha de {user.name}</DialogTitle>
          <DialogDescription>A senha nova é provisória: as sessões abertas caem e a pessoa define uma senha própria no próximo acesso.</DialogDescription>
        </DialogHeader>
        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" autoFocus />
        <DialogFooter>
          <Button disabled={password.length < 8 || reset.pending} onClick={() => reset.run(user.id, password)}>Redefinir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
