"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { createFollowUpAction } from "../pessoas/actions";

/** Cria em um toque um lembrete de ligação para a pessoa. */
export function QuickFollowUp({ personId, name }: { personId: string; name: string }) {
  const run = useAction(createFollowUpAction);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={run.pending}
      onClick={() => {
        const f = new FormData();
        f.set("personId", personId);
        f.set("title", `Ligar para ${name.split(" ")[0]}`);
        f.set("kind", "call");
        run.run(f);
      }}
    >
      <Phone data-icon="inline-start" /> Ligar
    </Button>
  );
}
