import type { PersonStatus } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/labels";
import { ToneBadge } from "./tone";

const STATUS_TONE: Record<PersonStatus, string> = {
  member: "sage",
  visitor: "gold",
  inactive: "slate",
};

export function StatusBadge({ status }: { status: PersonStatus }) {
  return (
    <ToneBadge tone={STATUS_TONE[status]}>
      <span className="size-1.5 rounded-full bg-tone" />
      {STATUS_LABEL[status]}
    </ToneBadge>
  );
}
