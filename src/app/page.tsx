import { TournamentCard } from "@/components/tournaments/tournament-card";
import { NewTournamentButton } from "@/components/admin/new-tournament-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveTournamentState } from "@/lib/data";
import { Trophy } from "lucide-react";

export default async function DashboardPage() {
  const state = await getActiveTournamentState();

  const playedMatches = state
    ? Object.values(state.matchesByStage)
        .flat()
        .filter((m) => m.status === "PLAYED").length
    : 0;
  const activeStages = state ? state.stages.filter((s) => s.status !== "DRAFT").length : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tus torneos</h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona ligas de amigos: Apertura, Clausura, Supercopa y tabla general.
          </p>
        </div>
        <NewTournamentButton currentTeams={state?.teams ?? []} currentTeamAvailability={state?.teamAvailability ?? []} />
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
