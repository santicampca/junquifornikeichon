import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { AdminLogin } from "@/components/admin/admin-login";

export function Navbar({ activeTournamentSlug }: { activeTournamentSlug?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="size-4" strokeWidth={2.5} />
          </span>
          Torneos<span className="text-primary">FC</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href={activeTournamentSlug ? `/torneos/${activeTournamentSlug}` : "/"}
            className="rounded-md px-3 py-1.5 font-medium text-muted-strong transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            Torneos
          </Link>
          <Link
            href="/equipos"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-muted-strong transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <Users className="size-4" />
            Equipos
          </Link>
          <div className="ml-2 border-l border-border pl-2">
            <AdminLogin />
          </div>
        </nav>
      </div>
    </header>
  );
}
