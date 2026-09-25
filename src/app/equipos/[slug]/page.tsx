import { notFound } from "next/navigation";
import { TeamBadge } from "@/components/teams/team-badge";
import { TeamRoster } from "@/components/teams/team-roster";
import { TeamLineupEditor } from "@/components/teams/team-lineup-editor";
import { MatchCard } from "@/components/matches/match-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { computeStandings } from "@/lib/standings";
import { getActiveTournamentState, getTeamPlayers, getTeamLineups } from "@/lib/data";

export default async function TeamProfilePage(props: PageProps<"/equipos/[slug]">) {
  const { slug } = await props.params;
  const state = await getActiveTournamentState();
  const team = state?.teams.find((t) => t.slug === slug);
  if (!state || !team) notFound();

  const [players, lineups] = await Promise.all([getTeamPlayers(team.id), getTeamLineups(team.id)]);

  const { teams, stages, matchesByStage, stageParticipants } = state;
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const allMatches = Object.values(matchesByStage).flat();
  const teamMatches = allMatches.filter(
    (m) => m.homeTeamId === team.id || m.awayTeamId === team.id,
  );

  const overall = computeStandings([team.id], teamMatches)[0];

  const perStage = stages
    .filter((s) => s.type !== "GENERAL")
    .map((stage) => {
      const stageMatches = (matchesByStage[stage.id] ?? []).filter(
        (m) => m.homeTeamId === team.id || m.awayTeamId === team.id,
      );
      const adjustment = stageParticipants.find((p) => p.stageId === stage.id && p.teamId === team.id)?.pointsAdjustment ?? 0;
      return {
        stage,
        row: computeStandings([team.id], stageMatches, stage.points, 5, { [team.id]: adjustment })[0],
      };
    })
    .filter(({ row }) => row.played > 0);

  const recentMatches = [...teamMatches]
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <TeamBadge team={team} size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{team.name}</h1>
          <p className="text-sm text-muted">DT/Mánager: {team.managerName}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="PJ" value={overall?.played ?? 0} />
        <StatTile label="V" value={overall?.won ?? 0} />
        <StatTile label="E" value={overall?.drawn ?? 0} />
        <StatTile label="D" value={overall?.lost ?? 0} />
        <StatTile label="GF / GC" value={`${overall?.goalsFor ?? 0} / ${overall?.goalsAgainst ?? 0}`} />
        <StatTile label="DG" value={overall?.goalDifference ?? 0} />
      </div>

      {perStage.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Desempeño por fase
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Fase</th>
                  <th className="px-2 py-2 text-center font-medium">PJ</th>
                  <th className="px-2 py-2 text-center font-medium">V</th>
                  <th className="px-2 py-2 text-center font-medium">E</th>
                  <th className="px-2 py-2 text-center font-medium">D</th>
                  <th className="px-2 py-2 text-center font-medium">DG</th>
                  <th className="px-2 py-2 text-center font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {perStage.map(({ stage, row }) => (
                  <tr key={stage.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-2 font-medium text-foreground">{stage.name}</td>
                    <td className="px-2 py-2 text-center text-muted-strong">{row.played}</td>
                    <td className="px-2 py-2 text-center text-muted-strong">{row.won}</td>
                    <td className="px-2 py-2 text-center text-muted-strong">{row.drawn}</td>
                    <td className="px-2 py-2 text-center text-muted-strong">{row.lost}</td>
                    <td className="px-2 py-2 text-center text-muted-strong">
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-foreground">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Historial de partidos
          </h2>
          {recentMatches.length === 0 ? (
            <EmptyState title="Este equipo todavía no tiene partidos" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  homeTeam={teamsById.get(match.homeTeamId)}
                  awayTeam={teamsById.get(match.awayTeamId)}
                  tournamentSlug={state.tournament.slug}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Plantilla ({players.length})
          </h2>
          <Card>
            <CardContent>
              <TeamRoster teamId={team.id} players={players} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <TeamLineupEditor teamId={team.id} players={players} lineups={lineups} />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
