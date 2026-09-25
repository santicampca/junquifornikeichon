import Link from "next/link";
import { Goal } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { TopScorer } from "@/types/domain";

export function TopScorersPanel({ scorers }: { scorers: TopScorer[] }) {
  if (scorers.length === 0) {
    return <EmptyState icon={Goal} title="Todavía no hay goles cargados" />;
  }

  return (
    <ol className="space-y-2">
      {scorers.map((s, i) => (
        <li
          key={s.playerId}
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-muted-strong">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{s.playerName}</p>
              <Link href={`/equipos/${s.teamSlug}`} className="text-xs text-muted hover:text-primary hover:underline">
                {s.teamName}
              </Link>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-bold text-primary">
            <Goal className="size-4" />
            {s.goals}
          </span>
        </li>
      ))}
    </ol>
  );
}
