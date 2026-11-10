import Papa from "papaparse";
import { normalizeSearch } from "./text";

export const IMPORT_FIELDS = {
  fullName: "Nome completo",
  preferredName: "Apelido",
  status: "Status",
  phone: "Celular",
  email: "E-mail",
  birthDate: "Nascimento",
  gender: "Sexo",
  address: "Endereço",
  household: "Família",
  firstVisitDate: "Primeira visita",
  memberSince: "Membro desde",
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;

const ALIASES: Record<ImportField, string[]> = {
  fullName: ["nome completo", "nome", "name", "full name", "pessoa"],
  preferredName: ["apelido", "como gosta de ser chamado", "nickname"],
  status: ["status", "situacao", "tipo"],
  phone: ["celular", "telefone", "whatsapp", "fone", "phone", "contato"],
  email: ["email", "e-mail", "mail"],
  birthDate: ["nascimento", "data de nascimento", "aniversario", "birthday", "birth date", "dt nascimento"],
  gender: ["sexo", "genero", "gender"],
  address: ["endereco", "address", "rua"],
  household: ["familia", "casa", "household", "family"],
  firstVisitDate: ["primeira visita", "data da primeira visita", "first visit"],
  memberSince: ["membro desde", "data de membresia", "batismo", "member since"],
};

export function guessMapping(headers: string[]) {
  const mapping: Partial<Record<ImportField, string>> = {};
  for (const [field, aliases] of Object.entries(ALIASES) as [ImportField, string[]][]) {
    const hit = headers.find((h) => aliases.includes(normalizeSearch(h)));
    if (hit) mapping[field] = hit;
  }
  return mapping;
}

export function parseCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return { headers: result.meta.fields ?? [], rows: result.data };
}

/** Aceita DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD e DD/MM/AA. */
export function parseDate(value: string | undefined) {
  const v = value?.trim();
  if (!v) return undefined;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return pad(m[1], m[2], m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let year = Number(m[3]);
    if (m[3].length === 2) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
    return pad(String(year), m[2], m[1]);
  }
  return undefined;
}

function pad(y: string, m: string, d: string) {
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseStatus(value: string | undefined) {
  const v = normalizeSearch(value ?? "");
  if (!v) return undefined;
  if (v.startsWith("memb")) return "member" as const;
  if (v.startsWith("inat") || v.startsWith("afast")) return "inactive" as const;
  if (v.startsWith("visit") || v.startsWith("congreg")) return "visitor" as const;
  return undefined;
}

export function parseGender(value: string | undefined) {
  const v = normalizeSearch(value ?? "");
  if (["f", "feminino", "mulher", "female"].includes(v)) return "female" as const;
  if (["m", "masculino", "homem", "male"].includes(v)) return "male" as const;
  return undefined;
}

/** escapeFormulae: um nome como "=HYPERLINK(...)" não vira fórmula no Excel. */
export function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  // BOM para o Excel abrir acentos corretamente.
  return "﻿" + Papa.unparse(rows, { delimiter: ";", escapeFormulae: true });
}
