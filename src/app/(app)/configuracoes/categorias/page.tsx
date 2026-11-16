import type { Metadata } from "next";
import { listCategories } from "@/server/events";
import { requireUser } from "@/server/session";
import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const user = await requireUser();
  return <CategoriesManager categories={await listCategories(user)} />;
}
