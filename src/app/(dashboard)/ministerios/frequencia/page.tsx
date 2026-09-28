import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { getMeetingActor } from "@/features/encontros/meeting-service";
import { getMinistryFrequencyReport, parseFrequencyReportPeriod } from "@/features/ministerios/frequency-report";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { FrequencyReportView } from "@/features/ministerios/frequency-report-view";

type FrequencySearchParams = {
  from?: string | string[];
  to?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function FrequencyPage({ searchParams }: { searchParams: Promise<FrequencySearchParams> }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) redirect("/login");

  const query = await searchParams;
  const from = firstValue(query.from);
  const to = firstValue(query.to);
  const period = parseFrequencyReportPeriod(from, to);
  const summaries = period.kind === "valid"
    ? await getMinistryFrequencyReport(actor, { start: period.start, endExclusive: period.endExclusive })
    : [];

  return <FrequencyReportView from={from} to={to} period={period} summaries={summaries} />;
}
