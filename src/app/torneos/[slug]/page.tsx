import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarDays, Trophy } from "lucide-react";
import { StageTabs } from "@/components/tournaments/stage-tabs";
import { StandingsTable } from "@/components/standings/standings-table";
import { MatchCard } from "@/components/matches/match-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { ResetTournamentButton } from "@/components/admin/reset-tournament-button";
import { DeleteTournamentButton } from "@/components/admin/delete-tournament-button";
import { EditTournamentName } from "@/components/admin/edit-tournament-name";
import { EditTournamentRules } from "@/components/admin/edit-tournament-rules";
import { GeneratePlayoffsButton } from "@/components/admin/generate-playoffs-button";
import { GenerateClausuraButton } from "@/components/admin/generate-clausura-button";
import { StageLineupModeSelector } from "@/components/admin/stage-lineup-mode-selector";
import { PalmaresPanel } from "@/components/tournaments/palmares-panel";
import { TopScorersPanel } from "@/components/tournaments/top-scorers-panel";
import { PlaylistPanel } from "@/components/tournaments/playlist-panel";
import { TournamentAnthemPlayer } from "@/components/tournaments/tournament-anthem-player";
import { computeStandings, mergeStandings } from "@/lib/standings";
import { getActiveTournamentState, getChampions, getTopScorers, getPlaylist, getAnthemTrack } from "@/lib/data";
import type { Match } from "@/types/domain";

const SPECIAL_TABS = ["reglas", "palmares", "goleadores", "playlist"] as const;
type SpecialTab = (typeof SPECIAL_TABS)[number];

const SPECIAL_TAB_LABEL: Record<SpecialTab, string> = {
  reglas: "Reglas",
  palmares: "Palmarés",
  goleadores: "Goleadores",
  playlist: "Playlist",
};

export default async function TournamentPage(props: PageProps<"/torneos/[slug]">) {
  const { slug } = await props.params;
  const { fase } = await props.searchParams;

  const state = await getActiveTournamentState();
  if (!state || slug !== state.tournament.slug) notFound();

  const { tournament, teams, stages, matchesByStage, stageParticipants } = state;
  const teamIds = teams.map((t) => t.id);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const [champions, topScorers, playlist, anthem] = await Promise.all([
    getChampions(),
    getTopScorers(teamIds),
    getPlaylist(),
    getAnthemTrack(),
  ]);

  function adjustmentsForStage(stageId: string): Record<string, number> {
    return Object.fromEntries(
      stageParticipants.filter((p) => p.stageId === stageId).map((p) => [p.teamId, p.pointsAdjustment]),
    );
  }

  const faseParam = Array.isArray(fase) ? fase[0] : fase;
  const specialTab: SpecialTab | null = (SPECIAL_TABS as readonly string[]).includes(faseParam ?? "")
    ? (faseParam as SpecialTab)
    : null;

  const activeStage =
    stages.find((s) => s.id === faseParam) ?? stages.find((s) => s.type === "APERTURA") ?? stages[0];

  const isGeneral = activeStage.type === "GENERAL";
  const ownMatches: Match[] = matchesByStage[activeStage.id] ?? [];
  const hasParticipants = isGeneral || ownMatches.length > 0 || activeStage.status !== "DRAFT";

  const rows = isGeneral
    ? mergeStandings(
        (activeStage.aggregatesFrom ?? []).map((childId) => {
          const child = stages.find((s) => s.id === childId);
          return computeStandings(teamIds, matchesByStage[childId] ?? [], child?.points, 5, adjustmentsForStage(childId));
        }),
      )
    : computeStandings(teamIds, ownMatches, activeStage.points, 5, adjustmentsForStage(activeStage.id));

  const upcoming = [...ownMatches]
    .filter((m) => m.status === "SCHEDULED")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, 4);

  const recent = [...ownMatches]
    .filter((m) => m.status === "PLAYED" || m.status === "WALKOVER")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {anthem && <TournamentAnthemPlayer audioData={anthem.audioData} />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="size-6" />
          </span>
          <div>
            <EditTournamentName
              tournamentId={tournament.id}
              name={tournament.name}
              className="text-xl font-bold tracking-tight text-foreground"
            />
            <p className="text-sm text-muted">{specialTab ? SPECIAL_TAB_LABEL[specialTab] : activeStage.name}</p>
          </div>
          {!specialTab && <StageLineupModeSelector stageId={activeStage.id} mode={activeStage.lineupMode} />}
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
        <StageTabs
          tournamentSlug={tournament.slug}
          stages={stages}
          activeStageId={specialTab ?? activeStage.id}
          extraTabs={[
            { id: "reglas", label: "Reglas" },
            { id: "palmares", label: "Palmarés" },
            { id: "goleadores", label: "Goleadores" },
            { id: "playlist", label: "Playlist" },
          ]}
        />
      </div>

      {specialTab === "reglas" ? (
        <Card>
          <CardContent>
            <EditTournamentRules tournamentId={tournament.id} rules={tournament.rules} />
          </CardContent>
        </Card>
      ) : specialTab === "palmares" ? (
        <PalmaresPanel champions={champions} teams={teams} />
      ) : specialTab === "goleadores" ? (
        <TopScorersPanel scorers={topScorers} />
      ) : specialTab === "playlist" ? (
        <PlaylistPanel tracks={playlist} />
      ) : !hasParticipants ? (
        <div className="space-y-4">
          <EmptyState
            icon={CalendarClock}
            title="Fase aún no definida"
            description={
              activeStage.type === "PLAYOFFS"
                ? "Eliminación directa top 8 sobre la Tabla General: 1° vs 8°, 4° vs 5°, 2° vs 7°, 3° vs 6°. Se genera a mano cuando termine la liga."
                : activeStage.type === "CLAUSURA"
                  ? "El calendario del Clausura se genera a mano cuando quieras: elegí la fecha de inicio."
                  : "La Supercopa se juega entre el campeón del Apertura y el campeón del Clausura. Se habilitará al finalizar ambas fases."
            }
          />
          {activeStage.type === "PLAYOFFS" && (
            <div className="flex justify-center">
              <GeneratePlayoffsButton stageId={activeStage.id} matches={ownMatches} />
            </div>
          )}
          {activeStage.type === "CLAUSURA" && (
            <div className="flex justify-center">
              <GenerateClausuraButton stageId={activeStage.id} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Tabla de posiciones
            </h2>
            <StandingsTable
              rows={rows}
              teamsById={teamsById}
              highlightTopN={1}
              secondaryHighlightRange={isGeneral ? [2, 8] : undefined}
              stageId={isGeneral || activeStage.type === "PLAYOFFS" ? undefined : activeStage.id}
            />
            {activeStage.type === "PLAYOFFS" && (
              <div className="mt-3 flex justify-center">
                <GeneratePlayoffsButton stageId={activeStage.id} matches={ownMatches} />
              </div>
            )}
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
                      tournamentSlug={tournament.slug}
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
                      tournamentSlug={tournament.slug}
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
