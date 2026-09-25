"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin, useTeamAuth } from "@/lib/app-store";
import { setTeamLineupAction } from "@/lib/actions";
import {
  ACTIVE_FORMATIONS,
  FORMATION_SLOTS,
  FORMATION_SLOT_LABELS,
  LINEUP_SIZE,
  type ActiveFormation,
  type LineupMode,
  type Player,
  type TeamLineup,
} from "@/types/domain";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<LineupMode, string> = {
  PASIVO: "Pasivo (con arquero)",
  ACTIVO: "Activo (sin arquero)",
};

const MODE_HELP: Record<LineupMode, string> = {
  PASIVO: "6 titulares: exactamente 1 arquero + 5 jugadores de campo.",
  ACTIVO: "4 titulares, sin arquero: al menos 1 defensa ocupa ese lugar.",
};

function PitchDot({ x, y, logoUrl, label }: { x: number; y: number; logoUrl?: string; label?: string }) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-blue-500 shadow">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- escudo SVG local, no CDN que optimizar
          <img src={logoUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      {label && (
        <span className="max-w-16 truncate rounded bg-black/70 px-1 text-[9px] font-medium leading-tight text-white">
          {label}
        </span>
      )}
    </div>
  );
}

function MiniPitch({
  formation,
  selected,
  onClick,
}: {
  formation: ActiveFormation;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border hover:border-muted-strong",
      )}
    >
      <div className="relative aspect-[3/4] w-16 overflow-hidden rounded bg-green-800/70">
        {FORMATION_SLOTS[formation].map((slot, i) => (
          <div
            key={i}
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-foreground">{formation}</span>
    </button>
  );
}

function PasivoPanel({
  teamId,
  players,
  initialPlayerIds,
  canEdit,
}: {
  teamId: string;
  players: Player[];
  initialPlayerIds: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPlayerIds));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const size = LINEUP_SIZE.PASIVO;

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
    const result = await setTeamLineupAction(teamId, "PASIVO", [...selected]);
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
        <h3 className="text-sm font-semibold text-foreground">{MODE_LABEL.PASIVO}</h3>
        {canEdit && (
          <span className={cn("text-xs font-medium", selected.size === size ? "text-win" : "text-muted")}>
            {selected.size}/{size}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">{MODE_HELP.PASIVO}</p>

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
            {players.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-elevated">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="text-foreground">{p.name}</span>
                  {p.position && <span className="text-xs text-muted">{p.position}</span>}
                </label>
              </li>
            ))}
            {players.length === 0 && <p className="text-xs text-muted">No hay jugadores cargados todavía.</p>}
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

function ActivoPanel({
  teamId,
  teamLogoUrl,
  players,
  initialPlayerIds,
  initialFormation,
  canEdit,
}: {
  teamId: string;
  teamLogoUrl?: string;
  players: Player[];
  initialPlayerIds: string[];
  initialFormation?: ActiveFormation;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [formation, setFormation] = useState<ActiveFormation | null>(initialFormation ?? null);
  const [slots, setSlots] = useState<string[]>(() => {
    const filled = [...initialPlayerIds];
    while (filled.length < 4) filled.push("");
    return filled.slice(0, 4);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const eligiblePlayers = players.filter((p) => p.position !== "Portero");
  const playerById = new Map(players.map((p) => [p.id, p]));
  const filledSlots = slots.filter(Boolean).length;

  function setSlot(index: number, playerId: string) {
    setSavedOk(false);
    setSlots((prev) => prev.map((id, i) => (i === index ? playerId : id)));
  }

  async function handleSave() {
    if (!formation) {
      setError("Elegí una formación.");
      return;
    }
    setError(null);
    setSavedOk(false);
    setSubmitting(true);
    const result = await setTeamLineupAction(teamId, "ACTIVO", slots.filter(Boolean), formation);
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
        <h3 className="text-sm font-semibold text-foreground">{MODE_LABEL.ACTIVO}</h3>
        {canEdit && (
          <span className={cn("text-xs font-medium", filledSlots === 4 ? "text-win" : "text-muted")}>
            {filledSlots}/4
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">{MODE_HELP.ACTIVO}</p>

      {!canEdit ? (
        initialFormation ? (
          <div className="relative mx-auto aspect-[3/4] w-40 overflow-hidden rounded-lg bg-green-800/70">
            {FORMATION_SLOTS[initialFormation].map((slot, i) => (
              <PitchDot
                key={i}
                x={slot.x}
                y={slot.y}
                logoUrl={teamLogoUrl}
                label={playerById.get(initialPlayerIds[i])?.name}
              />
            ))}
          </div>
        ) : initialPlayerIds.length > 0 ? (
          <ul className="space-y-1">
            {players
              .filter((p) => initialPlayerIds.includes(p.id))
              .map((p) => (
                <li key={p.id} className="text-sm text-foreground">
                  {p.name} {p.position && <span className="text-xs text-muted">— {p.position}</span>}
                </li>
              ))}
            <p className="text-xs text-muted">Todavía no eligió una formación.</p>
          </ul>
        ) : (
          <p className="text-xs text-muted">Todavía no se definió.</p>
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            {ACTIVE_FORMATIONS.map((f) => (
              <MiniPitch key={f} formation={f} selected={formation === f} onClick={() => setFormation(f)} />
            ))}
          </div>

          {formation && (
            <>
              <div className="relative mx-auto mb-3 aspect-[3/4] w-40 overflow-hidden rounded-lg bg-green-800/70">
                {FORMATION_SLOTS[formation].map((slot, i) => (
                  <PitchDot
                    key={i}
                    x={slot.x}
                    y={slot.y}
                    logoUrl={teamLogoUrl}
                    label={playerById.get(slots[i])?.name ?? FORMATION_SLOT_LABELS[formation][i]}
                  />
                ))}
              </div>

              <div className="space-y-1.5">
                {slots.map((slotPlayerId, i) => (
                  <select
                    key={i}
                    value={slotPlayerId}
                    onChange={(e) => setSlot(i, e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">{`${FORMATION_SLOT_LABELS[formation][i]} — sin asignar`}</option>
                    {eligiblePlayers.map((p) => (
                      <option key={p.id} value={p.id} disabled={slots.includes(p.id) && slots[i] !== p.id}>
                        {p.name}
                        {p.position ? ` (${p.position})` : ""}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </>
          )}

          {eligiblePlayers.length === 0 && (
            <p className="mt-2 text-xs text-muted">No hay jugadores disponibles para este modo todavía.</p>
          )}

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
  teamLogoUrl,
  players,
  lineups,
}: {
  teamId: string;
  teamLogoUrl?: string;
  players: Player[];
  lineups: TeamLineup[];
}) {
  const { isAdmin } = useAdmin();
  const { session } = useTeamAuth();
  const canEdit = isAdmin || session?.teamId === teamId;

  const pasivo = lineups.find((l) => l.mode === "PASIVO");
  const activo = lineups.find((l) => l.mode === "ACTIVO");

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Alineaciones</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <PasivoPanel teamId={teamId} players={players} initialPlayerIds={pasivo?.playerIds ?? []} canEdit={canEdit} />
        <ActivoPanel
          teamId={teamId}
          teamLogoUrl={teamLogoUrl}
          players={players}
          initialPlayerIds={activo?.playerIds ?? []}
          initialFormation={activo?.formation}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
