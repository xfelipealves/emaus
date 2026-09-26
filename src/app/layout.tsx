import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "./app-identity";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Gestão da comunidade Emaús",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
