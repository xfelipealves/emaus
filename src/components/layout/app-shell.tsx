import { DesktopNavigation, MobileNavigation, TopbarActions } from "./navigation";

function formatToday() {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function AppShell({ children, userName }: Readonly<{ children: React.ReactNode; userName: string }>) {
  return (
    <div className="app-canvas min-h-[100dvh]">
      <div className="flex min-h-[100dvh]">
        <DesktopNavigation />
        <div className="min-w-0 flex-1">
          <header className="topbar">
            <div className="topbar__context">
              <p className="topbar__eyebrow">Emaús · hoje</p>
              <p className="topbar__date">{formatToday()}</p>
            </div>
            <TopbarActions userName={userName} />
          </header>
          <main className="px-5 pb-28 pt-10 sm:px-8 lg:px-12 lg:pb-12">{children}</main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}
