import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Trophy } from "lucide-react";
import { TeamBadge } from "@/components/teams/team-badge";
import { Badge } from "@/components/ui/badge";
import { MatchLivePanel } from "@/components/admin/match-live-panel";
import { RescheduleMatchForm } from "@/components/admin/reschedule-match-form";
import { DAY_LABEL } from "@/types/domain";
import { getActiveTournamentState } from "@/lib/data";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  LIVE: "En vivo",
  PLAYED: "Finalizado",
  POSTPONED: "Aplazado",
  CANCELLED: "Cancelado",
  WALKOVER: "W.O.",
};

export default async function MatchDetailPage(props: PageProps<"/torneos/[slug]/partidos/[matchId]">) {
  const { slug, matchId } = await props.params;

  const state = await getActiveTournamentState();
  if (!state || slug !== state.tournament.slug) notFound();

  const { tournament, teams, stages, matchesByStage } = state;
  const match = Object.values(matchesByStage).flat().find((m) => m.id === matchId);
  if (!match) notFound();

  const stage = stages.find((s) => s.id === match.stageId);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const homeTeam = teamsById.get(match.homeTeamId);
  const awayTeam = teamsById.get(match.awayTeamId);
  const date = match.scheduledAt ? new Date(match.scheduledAt) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/torneos/${tournament.slug}/calendario?fase=${match.stageId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Calendario · {stage?.name ?? tournament.name}
      </Link>

      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-2 text-xs text-muted">
          <span>
            {date
              ? date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
              : "Sin fecha"}
            {match.dayOfWeek && ` · ${DAY_LABEL[match.dayOfWeek]}`}
            {date && ` · ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
          <div className="flex items-center gap-1.5">
            {match.isMandatorySundayMatch && (
              <span title="Partido dominical obligatorio">
                <CalendarClock className="size-3.5 text-primary" />
              </span>
            )}
            <Badge tone={match.status === "LIVE" ? "loss" : match.status === "PLAYED" ? "muted" : "primary"}>
              {STATUS_LABEL[match.status]}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Link
            href={homeTeam ? `/equipos/${homeTeam.slug}` : "#"}
            className="flex flex-col items-center gap-2 text-center"
          >
            {homeTeam && <TeamBadge team={homeTeam} size="lg" />}
            <span className="text-sm font-medium text-foreground">{homeTeam?.name ?? "Por definir"}</span>
          </Link>
          <div className="flex items-center gap-2 text-3xl font-bold tabular-nums text-foreground">
            <span>{match.homeScore ?? "-"}</span>
            <span className="text-muted">:</span>
            <span>{match.awayScore ?? "-"}</span>
          </div>
          <Link
            href={awayTeam ? `/equipos/${awayTeam.slug}` : "#"}
            className="flex flex-col items-center gap-2 text-center"
          >
            {awayTeam && <TeamBadge team={awayTeam} size="lg" />}
            <span className="text-sm font-medium text-foreground">{awayTeam?.name ?? "Por definir"}</span>
          </Link>
        </div>

        {(match.homeYellowCards + match.awayYellowCards + match.homeRedCards + match.awayRedCards > 0) && (
          <div className="mt-4 flex justify-center gap-6 border-t border-border pt-3 text-sm text-muted-strong">
            <span>🟨 {match.homeYellowCards} · 🟥 {match.homeRedCards}</span>
            <span>🟨 {match.awayYellowCards} · 🟥 {match.awayRedCards}</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <MatchLivePanel match={match} homeTeam={homeTeam} awayTeam={awayTeam} />
        <RescheduleMatchForm match={match} />
      </div>

      {stage?.type === "GENERAL" && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <Trophy className="size-3.5" />
          La Tabla General no tiene partidos propios.
        </p>
      )}
    </div>
  );
}
