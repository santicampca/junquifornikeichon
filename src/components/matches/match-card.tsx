import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { Match, Team } from "@/types/domain";
import { DAY_LABEL } from "@/types/domain";
import { TeamBadge } from "@/components/teams/team-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Match["status"], string> = {
  SCHEDULED: "Programado",
  LIVE: "En vivo",
  PLAYED: "Finalizado",
  POSTPONED: "Aplazado",
  CANCELLED: "Cancelado",
  WALKOVER: "W.O.",
};

const STATUS_TONE: Record<Match["status"], "primary" | "muted" | "loss"> = {
  SCHEDULED: "primary",
  LIVE: "loss",
  PLAYED: "muted",
  POSTPONED: "muted",
  CANCELLED: "muted",
  WALKOVER: "muted",
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
  /** Si se pasa, la tarjeta entera es un link al acta del partido. */
  tournamentSlug,
}: {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  tournamentSlug?: string;
}) {
  const isPlayed = match.status === "PLAYED" || match.status === "WALKOVER";
  const homeWins = isPlayed && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWins = isPlayed && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  const date = match.scheduledAt ? new Date(match.scheduledAt) : undefined;
  const totalCards = match.homeYellowCards + match.awayYellowCards + match.homeRedCards + match.awayRedCards;

  const content = (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-3",
        tournamentSlug && "transition-colors hover:border-primary/40 hover:bg-surface-elevated",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">
          {date
            ? date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
            : "Sin fecha"}
          {match.dayOfWeek && ` · ${DAY_LABEL[match.dayOfWeek]}`}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {match.isMandatorySundayMatch && (
            <span title="Partido dominical obligatorio">
              <CalendarClock className="size-3.5 text-primary" />
            </span>
          )}
          <Badge tone={STATUS_TONE[match.status]}>{STATUS_LABEL[match.status]}</Badge>
        </div>
      </div>
      <div className="space-y-1.5">
        <TeamRow team={homeTeam} score={match.homeScore} isWinner={homeWins} />
        <TeamRow team={awayTeam} score={match.awayScore} isWinner={awayWins} />
      </div>
      {totalCards > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          🟨 {match.homeYellowCards + match.awayYellowCards} · 🟥 {match.homeRedCards + match.awayRedCards}
        </p>
      )}
    </div>
  );

  if (!tournamentSlug) return content;

  return <Link href={`/torneos/${tournamentSlug}/partidos/${match.id}`}>{content}</Link>;
}
