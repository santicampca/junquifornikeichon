"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin, useTeamAuth } from "@/lib/app-store";
import { setTeamLineupAction } from "@/lib/actions";
import { LINEUP_SIZE, type LineupMode, type Player, type TeamLineup } from "@/types/domain";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<LineupMode, string> = {
  PASIVO: "Pasivo (con arquero)",
  ACTIVO: "Activo (sin arquero)",
};

const MODE_HELP: Record<LineupMode, string> = {
  PASIVO: "6 titulares: exactamente 1 arquero + 5 jugadores de campo.",
  ACTIVO: "4 titulares, sin arquero: al menos 1 defensa ocupa ese lugar.",
};

function ModePanel({
  teamId,
  mode,
  players,
  initialPlayerIds,
  canEdit,
}: {
  teamId: string;
  mode: LineupMode;
  players: Player[];
  initialPlayerIds: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPlayerIds));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const size = LINEUP_SIZE[mode];
  // En modo activo no hay arquero: no tiene sentido ofrecerlo como opción.
  const eligiblePlayers = mode === "ACTIVO" ? players.filter((p) => p.position !== "Portero") : players;

  function toggle(id: string) {
    setSavedOk(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setSavedOk(false);
    setSubmitting(true);
    const result = await setTeamLineupAction(teamId, mode, [...selected]);
    if (result.success) {
      setSavedOk(true);
      router.refresh();
    } else {
      setError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{MODE_LABEL[mode]}</h3>
        {canEdit && (
          <span className={cn("text-xs font-medium", selected.size === size ? "text-win" : "text-muted")}>
            {selected.size}/{size}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">{MODE_HELP[mode]}</p>

      {!canEdit ? (
        <ul className="space-y-1">
          {players
            .filter((p) => initialPlayerIds.includes(p.id))
            .map((p) => (
              <li key={p.id} className="text-sm text-foreground">
                {p.name} {p.position && <span className="text-xs text-muted">— {p.position}</span>}
              </li>
            ))}
          {initialPlayerIds.length === 0 && <p className="text-xs text-muted">Todavía no se definió.</p>}
        </ul>
      ) : (
        <>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {eligiblePlayers.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-elevated">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="text-foreground">{p.name}</span>
                  {p.position && <span className="text-xs text-muted">{p.position}</span>}
                </label>
              </li>
            ))}
            {eligiblePlayers.length === 0 && (
              <p className="text-xs text-muted">No hay jugadores disponibles para este modo todavía.</p>
            )}
          </ul>
          {error && <p className="mt-2 text-xs text-loss">{error}</p>}
          {savedOk && <p className="mt-2 text-xs text-win">Alineación guardada.</p>}
          <button
            onClick={handleSave}
            disabled={submitting}
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Guardando…" : "Guardar alineación"}
          </button>
        </>
      )}
    </div>
  );
}

export function TeamLineupEditor({
  teamId,
  players,
  lineups,
}: {
  teamId: string;
  players: Player[];
  lineups: TeamLineup[];
}) {
  const { isAdmin } = useAdmin();
  const { session } = useTeamAuth();
  const canEdit = isAdmin || session?.teamId === teamId;

  const byMode = new Map(lineups.map((l) => [l.mode, l.playerIds]));

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Alineaciones</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModePanel
          teamId={teamId}
          mode="PASIVO"
          players={players}
          initialPlayerIds={byMode.get("PASIVO") ?? []}
          canEdit={canEdit}
        />
        <ModePanel
          teamId={teamId}
          mode="ACTIVO"
          players={players}
          initialPlayerIds={byMode.get("ACTIVO") ?? []}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
