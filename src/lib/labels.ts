import type { HouseholdRole, PersonStatus, Role } from "@/db/schema";

export const STATUS_LABEL: Record<PersonStatus, string> = {
  visitor: "Visitante",
  member: "Membro",
  inactive: "Inativo",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  secretary: "Secretaria",
  leader: "Líder",
};

export const HOUSEHOLD_ROLE_LABEL: Record<HouseholdRole, string> = {
  head: "Responsável",
  spouse: "Cônjuge",
  child: "Filho(a)",
  other: "Outro",
};

export const FOLLOW_UP_KIND_LABEL = {
  call: "Ligação",
  visit: "Visita",
  message: "Mensagem",
  prayer: "Oração",
  other: "Outro",
} as const;

export const RECURRENCE_LABEL = {
  weekly: "Toda semana",
  biweekly: "A cada 2 semanas",
  monthly: "Todo mês",
} as const;

export const WEEKDAY_LABEL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const TONES = ["ember", "sage", "sky", "gold", "plum", "rose", "teal", "slate"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABEL: Record<Tone, string> = {
  ember: "Brasa",
  sage: "Oliva",
  sky: "Céu",
  gold: "Trigo",
  plum: "Uva",
  rose: "Rosa",
  teal: "Mar",
  slate: "Pedra",
};

/** Cor estável a partir de um texto (avatares). */
export function toneFor(seed: string): Tone {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
