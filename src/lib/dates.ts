import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DEFAULT_TZ = "America/Sao_Paulo";

// Criar Intl.DateTimeFormat é caro (ms no Raspberry): um formatador por fuso/opções.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, opts: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(opts);
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    formatters.set(key, fmt);
  }
  return fmt;
}

function parts(date: Date, timeZone: string) {
  const fmt = formatter("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const map = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return map as Record<string, string>;
}

/** Data civil (YYYY-MM-DD) de um instante no fuso informado. */
export function isoDateInTz(date: Date, timeZone = DEFAULT_TZ) {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function timeInTz(date: Date, timeZone = DEFAULT_TZ) {
  const p = parts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

export function todayIso(timeZone = DEFAULT_TZ) {
  return isoDateInTz(new Date(), timeZone);
}

function offsetMs(instant: Date, timeZone: string) {
  const p = parts(instant, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Converte data + hora "de parede" no fuso da igreja para um instante UTC. */
export function zonedToUtc(isoDate: string, time: string, timeZone = DEFAULT_TZ) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Segunda passada corrige transições de horário de verão.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** Início do dia (00:00) no fuso, como instante UTC. */
export function startOfDayUtc(isoDate: string, timeZone = DEFAULT_TZ) {
  return zonedToUtc(isoDate, "00:00", timeZone);
}

export function addDaysIso(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado, para uma data civil. */
export function weekdayOfIso(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diffDaysIso(a: string, b: string) {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
}

export function ageFrom(birthDate: string | null | undefined, today: string) {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 ? age : null;
}

/** Dias até o próximo aniversário (0 = hoje). */
export function daysUntilBirthday(birthDate: string, today: string) {
  const [, bm, bd] = birthDate.split("-").map(Number);
  const [ty] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  // 29/02 em ano não bissexto vira 28/02.
  const clampDay = (year: number) =>
    bm === 2 && bd === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1
      ? 28
      : bd;
  let next = `${ty}-${pad(bm)}-${pad(clampDay(ty))}`;
  if (next < today) next = `${ty + 1}-${pad(bm)}-${pad(clampDay(ty + 1))}`;
  return diffDaysIso(next, today);
}

const dateFmt = (timeZone: string, opts: Intl.DateTimeFormatOptions) =>
  formatter("pt-BR", { timeZone, ...opts });

export function formatDate(
  value: Date | string | null | undefined,
  timeZone = DEFAULT_TZ,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
) {
  if (!value) return "—";
  if (typeof value === "string") {
    // Datas civis não têm fuso: formata em UTC para não "voltar um dia".
    const [y, m, d] = value.split("-").map(Number);
    return dateFmt("UTC", opts).format(new Date(Date.UTC(y, m - 1, d)));
  }
  return dateFmt(timeZone, opts).format(value);
}

export function formatDateTime(value: Date, timeZone = DEFAULT_TZ) {
  return dateFmt(timeZone, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatTime(value: Date, timeZone = DEFAULT_TZ) {
  return dateFmt(timeZone, { hour: "2-digit", minute: "2-digit" }).format(value);
}

export function formatRelative(value: Date, now = new Date()) {
  const text = formatDistanceStrict(value, now, { locale: ptBR, addSuffix: true });
  return text;
}

export function formatDaysAgo(days: number) {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 14) return `há ${days} dias`;
  if (days < 60) return `há ${Math.round(days / 7)} semanas`;
  if (days < 730) return `há ${Math.round(days / 30)} meses`;
  return `há ${Math.round(days / 365)} anos`;
}

export function hoursUntil(date: Date) {
  return (date.getTime() - Date.now()) / 3_600_000;
}

/** "domingo, 8 de novembro" → "Domingo, 8 de novembro" */
export function upperFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
