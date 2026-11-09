import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { ChurchForm } from "./church-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function ChurchSettingsPage() {
  const settings = await getSettings();
  return <ChurchForm settings={settings} />;
}
