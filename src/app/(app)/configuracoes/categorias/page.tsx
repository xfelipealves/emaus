import type { Metadata } from "next";
import { listCategories } from "@/server/events";
import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  return <CategoriesManager categories={await listCategories()} />;
}
