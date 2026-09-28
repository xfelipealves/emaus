"use client";

import { useEffect } from "react";
import { ErrorMessage } from "../../components/ui/error-message";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

type DashboardErrorFallbackProps = Pick<DashboardErrorProps, "reset">;

export function DashboardErrorFallback({ reset }: DashboardErrorFallbackProps) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col justify-center gap-4 p-6">
      <ErrorMessage>
        <h1 className="font-semibold">Não foi possível carregar esta página</h1>
        <p className="mt-1">O conteúdo não está disponível agora. Tente novamente.</p>
      </ErrorMessage>
      <div>
        <button className="button-secondary" onClick={reset} type="button">
          Tentar novamente
        </button>
      </div>
    </main>
  );
}

export function logProtectedPageError(error: Error & { digest?: string }) {
  const diagnostic = {
    scope: "dashboard",
    digest: error.digest,
  };

  if (process.env.NODE_ENV === "development") {
    console.error("[Emaús] protected page render failed", {
      ...diagnostic,
      message: error.message,
    });
    return;
  }

  console.error("[Emaús] protected page render failed", diagnostic);
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    logProtectedPageError(error);
  }, [error]);

  return <DashboardErrorFallback reset={reset} />;
}
