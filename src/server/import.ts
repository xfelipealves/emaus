import "server-only";
import { db, schema } from "@/db";
import { type ImportField, parseDate, parseGender, parseStatus } from "@/lib/csv";
import { formatDate, todayIso } from "@/lib/dates";
import { HOUSEHOLD_ROLE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { normalizePhone, normalizeSearch } from "@/lib/text";
import { recordAudit, recordTimeline } from "./history";
import { listPeople } from "./people";
import type { CurrentUser } from "./session";
import { getSettings } from "./settings";

export type ImportSummary = {
  created: number;
  skipped: { line: number; name: string; reason: string }[];
  households: number;
};

export async function importPeople(
  user: CurrentUser,
  rows: Record<string, string>[],
  mapping: Partial<Record<ImportField, string>>,
): Promise<ImportSummary> {
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const get = (row: Record<string, string>, f: ImportField) =>
    mapping[f] ? row[mapping[f]!]?.trim() || undefined : undefined;

  const existing = await db.select().from(schema.person);
  const byPhone = new Map(existing.filter((p) => p.phoneDigits).map((p) => [p.phoneDigits!, p]));
  const byName = new Set(existing.map((p) => normalizeSearch(p.fullName)));
  const houses = new Map(
    (await db.select().from(schema.household)).map((h) => [normalizeSearch(h.name), h.id]),
  );

  const summary: ImportSummary = { created: 0, skipped: [], households: 0 };

  await db.transaction(async (tx) => {
    for (const [i, row] of rows.entries()) {
      const line = i + 2;
      const fullName = get(row, "fullName");
      if (!fullName || fullName.length < 2) {
        summary.skipped.push({ line, name: fullName ?? "—", reason: "Sem nome" });
        continue;
      }
      const phone = get(row, "phone");
      const digits = phone ? normalizePhone(phone) : "";
      if ((digits && byPhone.has(digits)) || byName.has(normalizeSearch(fullName))) {
        summary.skipped.push({ line, name: fullName, reason: "Já cadastrado" });
        continue;
      }

      let householdId: string | null = null;
      const houseName = get(row, "household");
      if (houseName) {
        const key = normalizeSearch(houseName);
        householdId = houses.get(key) ?? null;
        if (!householdId) {
          const [h] = await tx.insert(schema.household).values({ name: houseName }).returning();
          houses.set(key, h.id);
          householdId = h.id;
          summary.households++;
        }
      }

      const status = parseStatus(get(row, "status")) ?? "member";
      const [created] = await tx
        .insert(schema.person)
        .values({
          fullName,
          preferredName: get(row, "preferredName") ?? null,
          status,
          phone: phone ?? null,
          phoneDigits: digits || null,
          email: get(row, "email")?.toLowerCase() ?? null,
          birthDate: parseDate(get(row, "birthDate")) ?? null,
          gender: parseGender(get(row, "gender")) ?? null,
          address: get(row, "address") ?? null,
          householdId,
          householdRole: householdId ? "other" : null,
          firstVisitDate: parseDate(get(row, "firstVisitDate")) ?? (status === "visitor" ? today : null),
          memberSince: parseDate(get(row, "memberSince")) ?? null,
        })
        .returning();
      await recordTimeline(tx, {
        personId: created.id,
        actorId: user.id,
        kind: "registered",
        title: `Importado como ${STATUS_LABEL[status].toLowerCase()}`,
      });
      if (digits) byPhone.set(digits, created);
      byName.add(normalizeSearch(fullName));
      summary.created++;
    }
    await recordAudit(tx, {
      actorId: user.id,
      entity: "person",
      entityId: "import",
      action: "import",
      summary: `Importação CSV: ${summary.created} pessoas, ${summary.households} famílias, ${summary.skipped.length} ignoradas`,
    });
  });
  return summary;
}

export async function exportPeopleRows(user: CurrentUser) {
  const people = await listPeople(user);
  const houses = new Map(
    (await db.select().from(schema.household)).map((h) => [h.id, h]),
  );
  return people.map((p) => ({
    "Nome completo": p.fullName,
    Apelido: p.preferredName,
    Status: STATUS_LABEL[p.status],
    Celular: p.phone,
    "E-mail": p.email,
    Nascimento: p.birthDate ? formatDate(p.birthDate, undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    Idade: p.age,
    Sexo: p.gender === "female" ? "F" : p.gender === "male" ? "M" : "",
    Endereço: p.address,
    Família: p.householdId ? houses.get(p.householdId)?.name : "",
    "Papel na família": p.householdRole ? HOUSEHOLD_ROLE_LABEL[p.householdRole] : "",
    Ministérios: p.ministries.map((m) => m.name).join(", "),
    "Primeira visita": p.firstVisitDate ? formatDate(p.firstVisitDate, undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    "Membro desde": p.memberSince ? formatDate(p.memberSince, undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    "Presenças": p.visits,
    "Última presença": p.lastSeen ? formatDate(p.lastSeen, undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
  }));
}
