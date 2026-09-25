import { TournamentCard } from "@/components/tournaments/tournament-card";
import { NewTournamentButton } from "@/components/admin/new-tournament-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveTournamentState, getLastTeamRoster } from "@/lib/data";
import { buildMatchHeadline } from "@/lib/headlines";
import { Flame, Trophy } from "lucide-react";

export default async function DashboardPage() {
  const state = await getActiveTournamentState();
  // No depende de que haya torneo activo: si se borró la liga, sigue
  // teniendo los últimos equipos conocidos para precargar en el asistente.
  const lastRoster = await getLastTeamRoster();

  const allMatches = state ? Object.values(state.matchesByStage).flat() : [];
  const playedMatches = allMatches.filter((m) => m.status === "PLAYED").length;
  const activeStages = state ? state.stages.filter((s) => s.status !== "DRAFT").length : 0;

  const teamsById = new Map((state?.teams ?? []).map((t) => [t.id, t]));
  const headlines = allMatches
    .filter((m) => m.status === "PLAYED" || m.status === "WALKOVER")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
    .map((m) => buildMatchHeadline(m, teamsById.get(m.homeTeamId), teamsById.get(m.awayTeamId)))
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tus torneos</h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona ligas de amigos: Apertura, Clausura, Supercopa y tabla general.
          </p>
        </div>
        <NewTournamentButton currentTeams={lastRoster.teams} currentTeamAvailability={lastRoster.teamAvailability} />
      </div>

      {!state ? (
        <EmptyState
          icon={Trophy}
          title="Todavía no hay ningún torneo"
          description="Creá el primero con el botón de arriba, o corré el seed (npm run db:seed) para cargar el torneo de ejemplo."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <TournamentCard tournament={state.tournament} />
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Equipos" value={state.teams.length} />
            <StatTile label="Fases" value={state.stages.length} />
            <StatTile label="Fases activas" value={activeStages} />
            <StatTile label="Partidos jugados" value={playedMatches} />
          </div>

          {headlines.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight text-foreground">Noticias</h2>
              </div>
              <ul className="space-y-2">
                {headlines.map((h) => (
                  <li
                    key={h.matchId}
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground"
                  >
                    {h.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
