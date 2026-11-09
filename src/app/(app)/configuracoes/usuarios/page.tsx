import type { Metadata } from "next";
import { listMinistries } from "@/server/ministries";
import { listPeople } from "@/server/people";
import { requireUser } from "@/server/session";
import { listUsers } from "@/server/users";
import { displayName } from "@/lib/text";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const user = await requireUser();
  const [users, ministries, people] = await Promise.all([listUsers(), listMinistries(user), listPeople(user)]);
  return (
    <UsersManager
      currentUserId={user.id}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.displayUsername ?? u.username ?? "",
        email: u.email,
        role: u.role,
        active: u.active,
        personId: u.personId,
        ministries: u.ministryAccess.map((a) => a.ministry),
      }))}
      ministries={ministries.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
      people={people.map((p) => ({ id: p.id, name: displayName(p) }))}
    />
  );
}
