"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, X } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { createTournamentAction } from "@/lib/actions";
import { DAY_LABEL, type DayOfWeek, type Team, type TeamAvailability } from "@/types/domain";
import { cn, generateId } from "@/lib/utils";

const ALL_DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DEFAULT_SLOTS: Record<DayOfWeek, number> = {
  MONDAY: 1,
  TUESDAY: 0,
  WEDNESDAY: 0,
  THURSDAY: 1,
  FRIDAY: 1,
  SATURDAY: 2,
  SUNDAY: 1,
};

const PALETTE = [
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
  "#84cc16",
];

// Sin ancho: cada uso decide si es w-full, flex-1 o un ancho fijo, para que
// no compitan clases de width entre sí (Tailwind no respeta el orden de
// aparición en className, sino el orden en la hoja generada).
const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

interface TeamRow {
  id: string;
  name: string;
  managerName: string;
  allowedDays: DayOfWeek[];
}

function emptyRow(): TeamRow {
  return { id: generateId("row"), name: "", managerName: "", allowedDays: [] };
}

function defaultSeasonStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function CreateTournamentDialog({
  open,
  onClose,
  currentTeams,
  currentTeamAvailability,
}: {
  open: boolean;
  onClose: () => void;
  /** Equipos del torneo activo, para el botón "Usar plantilla actual". */
  currentTeams: Team[];
  currentTeamAvailability: TeamAvailability[];
}) {
  const router = useRouter();
  const { adminName } = useAdmin();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [doubleRound, setDoubleRound] = useState(true);
  const [includeSupercopa, setIncludeSupercopa] = useState(true);
  const [includePlayoffs, setIncludePlayoffs] = useState(false);
  const [seasonStart, setSeasonStart] = useState(defaultSeasonStart);
  const [slots, setSlots] = useState<Record<DayOfWeek, number>>(DEFAULT_SLOTS);
  // Precarga con la plantilla actual si hay equipos conocidos (ver
  // getLastTeamRoster en src/lib/data.ts): así el asistente ya arranca con
  // los 12 equipos en vez de forzar a tocar "Usar plantilla actual" cada vez.
  const [teams, setTeams] = useState<TeamRow[]>(() =>
    currentTeams.length > 0
      ? currentTeams.map((t) => ({
          id: generateId("row"),
          name: t.name,
          managerName: t.managerName,
          allowedDays: currentTeamAvailability.find((a) => a.teamId === t.id)?.allowedDays ?? [],
        }))
      : [emptyRow(), emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function useCurrentAsTemplate() {
    setTeams(
      currentTeams.map((t) => ({
        id: generateId("row"),
        name: t.name,
        managerName: t.managerName,
        allowedDays: currentTeamAvailability.find((a) => a.teamId === t.id)?.allowedDays ?? [],
      })),
    );
  }

  function updateTeam(id: string, patch: Partial<TeamRow>) {
    setTeams((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggleDay(id: string, day: DayOfWeek) {
    setTeams((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              allowedDays: r.allowedDays.includes(day)
                ? r.allowedDays.filter((d) => d !== day)
                : [...r.allowedDays, day],
            }
          : r,
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!adminName) {
      setError("Iniciá sesión como admin antes de crear un torneo.");
      return;
    }

    const trimmed = teams.map((t) => ({ ...t, name: t.name.trim(), managerName: t.managerName.trim() }));
    if (!name.trim()) {
      setError("Ponele un nombre al torneo.");
      return;
    }
    if (!seasonStart) {
      setError("Elegí la fecha de inicio del Apertura.");
      return;
    }
    if (trimmed.length < 2 || trimmed.some((t) => !t.name || !t.managerName)) {
      setError("Cargá al menos 2 equipos, todos con nombre y mánager.");
      return;
    }
    const weeklySlots = ALL_DAYS.filter((d) => slots[d] > 0).map((d) => ({ day: d, matchesPerDay: slots[d] }));
    if (weeklySlots.length === 0) {
      setError("Definí al menos un día de juego en la plantilla semanal.");
      return;
    }

    setSubmitting(true);
    try {
      const { tournamentSlug, conflicts, warnings } = await createTournamentAction(adminName, {
        name: name.trim(),
        description: description.trim() || undefined,
        doubleRound,
        includeSupercopa,
        includePlayoffs,
        seasonStart,
        weeklySlots,
        teams: trimmed.map((t, i) => ({
          name: t.name,
          managerName: t.managerName,
          allowedDays: t.allowedDays.length > 0 ? t.allowedDays : undefined,
          primaryColor: PALETTE[i % PALETTE.length],
        })),
      });
      onClose();
      router.push(`/torneos/${tournamentSlug}`);
      const notes: string[] = [];
      if (conflicts.length > 0) {
        notes.push(
          `${conflicts.length} partido(s) no se pudieron ubicar automáticamente en la plantilla semanal (faltó cupo); vas a tener que reprogramarlos a mano.`,
        );
      }
      if (warnings.length > 0) {
        notes.push(`${warnings.length} jornada(s) quedaron sin el partido dominical obligatorio:\n${warnings.join("\n")}`);
      }
      if (notes.length > 0) {
        window.alert(`Torneo creado. Ojo:\n\n${notes.join("\n\n")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el torneo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Nuevo torneo</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nombre del torneo</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Torneo Apertura 2026"
                className={cn(inputClass, "w-full")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Descripción (opcional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Copa de verano entre amigos"
                className={cn(inputClass, "w-full")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Arranca el (Apertura)</label>
                <input
                  type="date"
                  value={seasonStart}
                  onChange={(e) => setSeasonStart(e.target.value)}
                  className={cn(inputClass, "w-full")}
                />
              </div>
              <div className="flex flex-col justify-end gap-1.5 pb-1">
                <label className="flex items-center gap-2 text-sm text-muted-strong">
                  <input type="checkbox" checked={doubleRound} onChange={(e) => setDoubleRound(e.target.checked)} />
                  Ida y vuelta
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-strong">
                  <input
                    type="checkbox"
                    checked={includeSupercopa}
                    onChange={(e) => setIncludeSupercopa(e.target.checked)}
                  />
                  Incluir Supercopa
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-strong">
                  <input
                    type="checkbox"
                    checked={includePlayoffs}
                    onChange={(e) => setIncludePlayoffs(e.target.checked)}
                  />
                  Incluir Playoffs (top 8)
                </label>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Plantilla semanal (partidos por día)
            </h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {ALL_DAYS.map((day) => (
                <div key={day}>
                  <label className="mb-1 block text-[11px] text-muted">{DAY_LABEL[day].slice(0, 3)}</label>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={slots[day]}
                    onChange={(e) => setSlots((s) => ({ ...s, [day]: Math.max(0, Number(e.target.value) || 0) }))}
                    className={cn(inputClass, "w-full text-center")}
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Equipos ({teams.length})</h3>
              <button
                type="button"
                onClick={useCurrentAsTemplate}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Sparkles className="size-3.5" />
                Usar plantilla actual
              </button>
            </div>

            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex gap-2">
                    <input
                      value={team.name}
                      onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                      placeholder="Nombre del equipo"
                      className={cn(inputClass, "min-w-0 flex-1")}
                    />
                    <input
                      value={team.managerName}
                      onChange={(e) => updateTeam(team.id, { managerName: e.target.value })}
                      placeholder="Mánager"
                      className={cn(inputClass, "w-32 shrink-0")}
                    />
                    <button
                      type="button"
                      onClick={() => setTeams((rows) => rows.filter((r) => r.id !== team.id))}
                      className="shrink-0 text-muted hover:text-loss"
                      aria-label="Quitar equipo"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ALL_DAYS.map((day) => (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(team.id, day)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px]",
                          team.allowedDays.includes(day)
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border text-muted hover:text-foreground",
                        )}
                      >
                        {DAY_LABEL[day].slice(0, 3)}
                      </button>
                    ))}
                    {team.allowedDays.length === 0 && (
                      <span className="px-1 text-[11px] text-muted">Sin restricción de día</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setTeams((rows) => [...rows, emptyRow()])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-strong hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Agregar equipo
            </button>
          </section>

          {error && <p className="text-sm text-loss">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-strong hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Creando…" : "Crear torneo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
