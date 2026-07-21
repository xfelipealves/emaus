export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function getBusinessDateParts(date: Date): DateParts {
  const parts = datePartsFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export function calculateAge(birthDate: Date | null, at: Date = new Date()): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = getBusinessDateParts(birthDate);
  const current = getBusinessDateParts(at);
  let age = current.year - birth.year;

  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) {
    age -= 1;
  }

  return age;
}

export function formatBusinessDate(date: Date): string {
  const { day, month, year } = getBusinessDateParts(date);

  return [day, month, year].map((part, index) => (index === 2 ? String(part) : String(part).padStart(2, "0"))).join("/");
}
