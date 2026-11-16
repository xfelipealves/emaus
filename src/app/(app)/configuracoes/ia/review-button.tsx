"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { markRunReviewedAction } from "../actions";

export function ReviewButton({ runId }: { runId: string }) {
  const review = useAction(markRunReviewedAction);
  return (
    <Button variant="outline" size="sm" disabled={review.pending} onClick={() => review.run(runId)}>
      <Check data-icon="inline-start" /> Revisada
    </Button>
  );
}
