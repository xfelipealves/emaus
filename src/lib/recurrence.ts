import { addDaysIso, weekdayOfIso } from "./dates";

export type Recurrence = "weekly" | "biweekly" | "monthly";

/**
 * Datas (YYYY-MM-DD) de uma série entre `from` e `until`, inclusive.
 * Mensal repete a mesma "n-ésima semana" do dia da semana (ex.: 1º domingo).
 */
export function occurrences(opts: {
  recurrence: Recurrence;
  weekday: number;
  startDate: string;
  from: string;
  until: string;
}) {
  const { recurrence, weekday, startDate, from, until } = opts;
  const dates: string[] = [];
  // Primeira ocorrência: primeiro `weekday` a partir do início da série.
  let first = startDate;
  while (weekdayOfIso(first) !== weekday) first = addDaysIso(first, 1);

  if (recurrence === "monthly") {
    const nth = Math.ceil(Number(first.slice(8, 10)) / 7);
    let [y, m] = first.split("-").map(Number);
    for (let guard = 0; guard < 240; guard++) {
      const date = nthWeekdayOfMonth(y, m, weekday, nth);
      if (date && date > until) break;
      if (date && date >= from && date >= first) dates.push(date);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return dates;
  }

  const step = recurrence === "weekly" ? 7 : 14;
  for (let d = first; d <= until; d = addDaysIso(d, step)) {
    if (d >= from) dates.push(d);
  }
  return dates;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  let d = `${year}-${pad(month)}-01`;
  while (weekdayOfIso(d) !== weekday) d = addDaysIso(d, 1);
  const date = addDaysIso(d, (nth - 1) * 7);
  // 5ª semana pode não existir no mês: pula.
  return Number(date.slice(5, 7)) === month ? date : null;
}
