"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { CreateTournamentDialog } from "@/components/admin/create-tournament-dialog";
import { useAdmin, useTournamentStore } from "@/lib/app-store";

export default function DashboardPage() {
  const { state } = useTournamentStore();
  const { isAdmin } = useAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hint, setHint] = useState(false);

  const playedMatches = Object.values(state.matchesByStage)
    .flat()
    .filter((m) => m.status === "PLAYED").length;
  const activeStages = state.stages.filter((s) => s.status !== "DRAFT").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tus torneos</h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona ligas de amigos: Apertura, Clausura, Supercopa y tabla general.
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={() => (isAdmin ? setDialogOpen(true) : setHint(true))}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Nuevo torneo
          </button>
          {hint && !isAdmin && (
            <p className="mt-1.5 max-w-52 text-xs text-muted">
              Iniciá sesión como admin (arriba a la derecha) para crear un torneo.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TournamentCard tournament={state.tournament} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Equipos" value={state.teams.length} />
        <StatTile label="Fases" value={state.stages.length} />
        <StatTile label="Fases activas" value={activeStages} />
        <StatTile label="Partidos jugados" value={playedMatches} />
      </div>

      <CreateTournamentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
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
