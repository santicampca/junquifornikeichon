import type { Match, Team } from "@/types/domain";
import { DAY_LABEL } from "@/types/domain";
import { TeamBadge } from "@/components/teams/team-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Match["status"], string> = {
  SCHEDULED: "Programado",
  PLAYED: "Finalizado",
  POSTPONED: "Aplazado",
  CANCELLED: "Cancelado",
  WALKOVER: "W.O.",
};

function TeamRow({ team, score, isWinner }: { team?: Team; score: number | null; isWinner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {team && <TeamBadge team={team} size="sm" />}
        <span className={cn("truncate text-sm", isWinner ? "font-semibold text-foreground" : "text-muted-strong")}>
          {team?.name ?? "Por definir"}
        </span>
      </div>
      <span className={cn("text-sm tabular-nums", isWinner ? "font-bold text-foreground" : "text-muted-strong")}>
        {score ?? "-"}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  homeTeam,
  awayTeam,
}: {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
}) {
  const isPlayed = match.status === "PLAYED" || match.status === "WALKOVER";
  const homeWins = isPlayed && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWins = isPlayed && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  const date = match.scheduledAt ? new Date(match.scheduledAt) : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>
          {date
            ? date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
            : "Sin fecha"}
          {match.dayOfWeek && ` · ${DAY_LABEL[match.dayOfWeek]}`}
        </span>
        <Badge tone={isPlayed ? "muted" : "primary"}>{STATUS_LABEL[match.status]}</Badge>
      </div>
      <div className="space-y-1.5">
        <TeamRow team={homeTeam} score={match.homeScore} isWinner={homeWins} />
        <TeamRow team={awayTeam} score={match.awayScore} isWinner={awayWins} />
      </div>
    </div>
  );
}
