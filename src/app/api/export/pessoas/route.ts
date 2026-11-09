import { toCsv } from "@/lib/csv";
import { todayIso } from "@/lib/dates";
import { exportPeopleRows } from "@/server/import";
import { getCurrentUser } from "@/server/session";
import { getSettings } from "@/server/settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  if (user.role === "leader") return new Response("Sem permissão", { status: 403 });
  const settings = await getSettings();
  const csv = toCsv(await exportPeopleRows(user));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pessoas-${todayIso(settings.timezone)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
