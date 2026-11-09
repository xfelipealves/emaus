export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  // Remove DDI 55 para comparar números com e sem código do país.
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

export function formatPhone(value: string | null | undefined) {
  if (!value) return null;
  const d = normalizePhone(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

export function whatsappUrl(value: string | null | undefined) {
  if (!value) return null;
  const d = normalizePhone(value);
  if (d.length < 10) return null;
  return `https://wa.me/55${d}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter((p) => !/^(de|da|do|dos|das|e)$/i.test(p));
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Nome de exibição: apelido quando houver. */
export function displayName(p: { fullName: string; preferredName?: string | null }) {
  return p.preferredName?.trim() || p.fullName;
}
