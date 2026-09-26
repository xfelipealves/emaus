export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

type CalendarDateTime = CalendarDate & {
  hour: number;
  minute: number;
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

function calendarDateTimeInBrazil(date: Date): CalendarDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute };
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

export function normalizeDateOnly(date: Date): Date {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Data inválida");
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateTimeInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Data e horário devem usar o formato AAAA-MM-DDTHH:mm");

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  if (
    !Number.isFinite(candidate.getTime()) ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day ||
    candidate.getUTCHours() !== hour ||
    candidate.getUTCMinutes() !== minute
  ) {
    throw new Error("Data e horário inválidos");
  }

  const interpretedAsBrazil = calendarDateTimeInBrazil(candidate);
  const brazilCalendarAsUtc = Date.UTC(
    interpretedAsBrazil.year,
    interpretedAsBrazil.month - 1,
    interpretedAsBrazil.day,
    interpretedAsBrazil.hour,
    interpretedAsBrazil.minute,
  );
  const offset = candidate.getTime() - brazilCalendarAsUtc;
  const result = new Date(candidate.getTime() + offset);
  const resultCalendar = calendarDateTimeInBrazil(result);

  if (
    resultCalendar.year !== year ||
    resultCalendar.month !== month ||
    resultCalendar.day !== day ||
    resultCalendar.hour !== hour ||
    resultCalendar.minute !== minute
  ) {
    throw new Error("Data e horário inválidos");
  }

  return result;
}

export function formatDateInBrazil(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
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
