export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRAZIL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function calendarDateInBrazil(date: Date): CalendarDate {
  const parts = dateFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

  return { year: values.year, month: values.month, day: values.day };
}

function calendarDateFromUtc(date: Date): CalendarDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function parseDateInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Data deve usar o formato AAAA-MM-DD");
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  const calendar = calendarDateFromUtc(date);
  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isFinite(date.getTime()) ||
    calendar.year !== year ||
    calendar.month !== month ||
    calendar.day !== day
  ) {
    throw new Error("Data inválida");
  }

  return date;
}

export function formatDateInBrazil(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function calculateAge(birthDate: Date | null | undefined, now = new Date()): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = calendarDateFromUtc(birthDate);
  const today = calendarDateInBrazil(now);
  const birthdayPassed =
    today.month > birth.month ||
    (today.month === birth.month && today.day >= birth.day);

  return today.year - birth.year - (birthdayPassed ? 0 : 1);
}
