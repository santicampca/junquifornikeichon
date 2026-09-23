import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";
import type { Tournament } from "@/types/domain";
import { Card, CardContent } from "@/components/ui/card";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link href={`/torneos/${tournament.slug}`}>
      <Card className="group transition-colors hover:border-primary/50">
        <CardContent className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="size-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{tournament.name}</p>
            {tournament.description && (
              <p className="truncate text-sm text-muted">{tournament.description}</p>
            )}
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}
