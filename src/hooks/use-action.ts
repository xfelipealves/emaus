"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

/** Executa uma server action com estado de carregamento, toast e erros de campo. */
export function useAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ActionResult<T>>,
  opts: { onSuccess?: (data: T) => void; refresh?: boolean; silent?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  function run(...args: A) {
    return new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        const result = await action(...args);
        if (result.ok) {
          setFieldErrors({});
          if (result.message && !opts.silent) toast.success(result.message);
          opts.onSuccess?.(result.data);
          if (opts.refresh !== false) router.refresh();
        } else {
          setFieldErrors(result.fieldErrors ?? {});
          toast.error(result.error);
        }
        resolve(result);
      });
    });
  }

  return { run, pending, fieldErrors };
}
