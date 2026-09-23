import { Plus } from "lucide-react";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { tournament, teams } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tus torneos</h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona ligas de amigos: Apertura, Clausura, Supercopa y tabla general.
          </p>
        </div>
        <button
          disabled
          title="Próximamente"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground opacity-50"
        >
          <Plus className="size-4" />
          Nuevo torneo
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TournamentCard tournament={tournament} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Equipos" value={teams.length} />
        <StatTile label="Temporadas" value={1} />
        <StatTile label="Fases activas" value={2} />
        <StatTile label="Partidos jugados" value={6 * teams.length} />
      </div>
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
