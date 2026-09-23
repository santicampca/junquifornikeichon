import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarDays, Trophy } from "lucide-react";
import { StageTabs } from "@/components/tournaments/stage-tabs";
import { StandingsTable } from "@/components/standings/standings-table";
import { MatchCard } from "@/components/matches/match-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ResetTournamentButton } from "@/components/admin/reset-tournament-button";
import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { computeStandings, mergeStandings } from "@/lib/standings";
import { getActiveTournamentState } from "@/lib/data";
import type { Match } from "@/types/domain";

export default async function TournamentPage(props: PageProps<"/torneos/[slug]">) {
  const { slug } = await props.params;
  const { fase } = await props.searchParams;

  const state = await getActiveTournamentState();
  if (!state || slug !== state.tournament.slug) notFound();

  const { tournament, teams, stages, matchesByStage } = state;
  const teamIds = teams.map((t) => t.id);
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const activeStage =
    stages.find((s) => s.id === fase) ?? stages.find((s) => s.type === "APERTURA") ?? stages[0];

  const isGeneral = activeStage.type === "GENERAL";
  const ownMatches: Match[] = matchesByStage[activeStage.id] ?? [];
  const hasParticipants = isGeneral || ownMatches.length > 0 || activeStage.status !== "DRAFT";

  const rows = isGeneral
    ? mergeStandings(
        (activeStage.aggregatesFrom ?? []).map((childId) => {
          const child = stages.find((s) => s.id === childId);
          return computeStandings(teamIds, matchesByStage[childId] ?? [], child?.points);
        }),
      )
    : computeStandings(teamIds, ownMatches, activeStage.points);

  const upcoming = [...ownMatches]
    .filter((m) => m.status === "SCHEDULED")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, 4);

  const recent = [...ownMatches]
    .filter((m) => m.status === "PLAYED")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{tournament.name}</h1>
            <p className="text-sm text-muted">{activeStage.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/torneos/${tournament.slug}/calendario?fase=${activeStage.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-strong hover:bg-surface-elevated hover:text-foreground"
          >
            <CalendarDays className="size-4" />
            Calendario
          </Link>
          <ResetTournamentButton />
          <DeleteTournamentButton tournamentName={tournament.name} />
        </div>
      </div>

      <div className="mb-6">
        <StageTabs tournamentSlug={tournament.slug} stages={stages} activeStageId={activeStage.id} />
      </div>

      {!hasParticipants ? (
        <EmptyState
          icon={CalendarClock}
          title="Fase aún no definida"
          description="La Supercopa se juega entre el campeón del Apertura y el campeón del Clausura. Se habilitará al finalizar ambas fases."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Tabla de posiciones
            </h2>
            <StandingsTable rows={rows} teamsById={teamsById} highlightTopN={2} />
            {isGeneral && (
              <p className="mt-2 text-xs text-muted">
                Suma los puntos de Apertura y Clausura. Esta fase no tiene partidos propios.
              </p>
            )}
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Próximos partidos
              </h2>
              {upcoming.length === 0 ? (
                <EmptyState title="Sin partidos programados" />
              ) : (
                <div className="space-y-2">
                  {upcoming.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      homeTeam={teamsById.get(match.homeTeamId)}
                      awayTeam={teamsById.get(match.awayTeamId)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Resultados recientes
              </h2>
              {recent.length === 0 ? (
                <EmptyState title="Aún no hay resultados" />
              ) : (
                <div className="space-y-2">
                  {recent.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      homeTeam={teamsById.get(match.homeTeamId)}
                      awayTeam={teamsById.get(match.awayTeamId)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
