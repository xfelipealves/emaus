import type { Metadata } from "next";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { ChurchForm } from "./church-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function ChurchSettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.churchId);
  return <ChurchForm settings={settings} />;
}
