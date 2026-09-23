import Link from "next/link";
import type { StandingRow } from "@/lib/standings";
import type { Team } from "@/types/domain";
import { TeamBadge } from "@/components/teams/team-badge";
import { cn } from "@/lib/utils";

const FORM_TONE: Record<string, string> = {
  W: "bg-win text-primary-foreground",
  D: "bg-draw text-primary-foreground",
  L: "bg-loss text-primary-foreground",
};

export function StandingsTable({
  rows,
  teamsById,
  highlightTopN,
}: {
  rows: StandingRow[];
  teamsById: Map<string, Team>;
  /** Cuántas primeras posiciones resaltar (ej: zona de clasificación). */
  highlightTopN?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-muted">
            <th className="w-10 px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Equipo</th>
            <th className="px-2 py-2 text-center font-medium">PJ</th>
            <th className="px-2 py-2 text-center font-medium">V</th>
            <th className="px-2 py-2 text-center font-medium">E</th>
            <th className="px-2 py-2 text-center font-medium">D</th>
            <th className="px-2 py-2 text-center font-medium">GF</th>
            <th className="px-2 py-2 text-center font-medium">GC</th>
            <th className="px-2 py-2 text-center font-medium">DG</th>
            <th className="px-2 py-2 text-center font-medium">Pts</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Racha</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const team = teamsById.get(row.teamId);
            if (!team) return null;
            const position = index + 1;
            const highlighted = highlightTopN ? position <= highlightTopN : false;

            return (
              <tr
                key={row.teamId}
                className={cn(
                  "border-b border-border/60 last:border-b-0 hover:bg-surface-elevated/60",
                  highlighted && "bg-primary/5",
                )}
              >
                <td className="px-3 py-2 text-center">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded text-xs font-semibold",
                      highlighted ? "bg-primary text-primary-foreground" : "text-muted",
                    )}
                  >
                    {position}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/equipos/${team.slug}`}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                  >
                    <TeamBadge team={team} size="sm" />
                    <span className="truncate">{team.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-center text-muted-strong">{row.played}</td>
                <td className="px-2 py-2 text-center text-muted-strong">{row.won}</td>
                <td className="px-2 py-2 text-center text-muted-strong">{row.drawn}</td>
                <td className="px-2 py-2 text-center text-muted-strong">{row.lost}</td>
                <td className="px-2 py-2 text-center text-muted-strong">{row.goalsFor}</td>
                <td className="px-2 py-2 text-center text-muted-strong">{row.goalsAgainst}</td>
                <td className="px-2 py-2 text-center text-muted-strong">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="px-2 py-2 text-center text-base font-bold text-foreground">
                  {row.points}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <div className="flex justify-end gap-1">
                    {row.form.length === 0 && <span className="text-xs text-muted">—</span>}
                    {row.form.map((result, i) => (
                      <span
                        key={i}
                        className={cn(
                          "flex size-5 items-center justify-center rounded text-[10px] font-bold",
                          FORM_TONE[result],
                        )}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
