import "server-only";
import { z } from "zod";
import { ActionError } from "./session";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Executa a lógica de uma server action convertendo erros esperados em resultado. */
export async function runAction<T>(
  fn: () => Promise<T>,
  message?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".");
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, error: "Revise os campos destacados.", fieldErrors };
    }
    if (error instanceof ActionError) return { ok: false, error: error.message };
    // Redirects do Next precisam continuar propagando.
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error(error);
    return { ok: false, error: "Algo deu errado. Tente novamente." };
  }
}

/** Converte FormData em objeto simples; campos vazios viram undefined. */
export function formToObject(form: FormData) {
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key).map(String);
    if (key.endsWith("[]")) out[key.slice(0, -2)] = values.filter(Boolean);
    else out[key] = values[0]?.trim() ? values[0].trim() : undefined;
  }
  return out;
}

/** Tipos de TypeScript somem em runtime: valida valores de enum recebidos pelas actions. */
export function oneOf<const T extends readonly string[]>(values: T, value: unknown, label = "valor"): T[number] {
  if (typeof value === "string" && (values as readonly string[]).includes(value)) return value as T[number];
  throw new ActionError(`${label} inválido.`);
}
