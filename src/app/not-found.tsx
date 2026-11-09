import Link from "next/link";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="paper flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="size-12" />
      <h1 className="font-display text-5xl">Caminho não encontrado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta página não existe ou você não tem acesso a ela.
      </p>
      <Button render={<Link href="/" />} nativeButton={false}>Voltar ao início</Button>
    </main>
  );
}
