"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { finishMatchAction, updateMatchLiveAction, type MatchLiveInput } from "@/lib/actions";
import type { Match, Team } from "@/types/domain";
import { cn } from "@/lib/utils";

const CLOSED_STATUSES: Match["status"][] = ["PLAYED", "CANCELLED", "WALKOVER"];

function CounterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex size-6 items-center justify-center rounded-md border border-border text-muted-strong hover:bg-surface-elevated"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums text-foreground">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex size-6 items-center justify-center rounded-md border border-border text-muted-strong hover:bg-surface-elevated"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Acta en vivo: marcador + tarjetas editables, con "Guardar" (LIVE) y "Cerrar partido" (PLAYED). */
export function MatchLivePanel({ match, homeTeam, awayTeam }: { match: Match; homeTeam?: Team; awayTeam?: Team }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();

  const [form, setForm] = useState<MatchLiveInput>({
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    homeYellowCards: match.homeYellowCards,
    awayYellowCards: match.awayYellowCards,
    homeRedCards: match.homeRedCards,
    awayRedCards: match.awayRedCards,
  });
  const [submitting, setSubmitting] = useState<"save" | "finish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isClosed = CLOSED_STATUSES.includes(match.status);

  if (!isAdmin || !adminName) return null;
  if (isClosed) return null;

  function patch(field: keyof MatchLiveInput, value: number) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSubmitting("save");
    setError(null);
    try {
      await updateMatchLiveAction(adminName!, match.id, form);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el acta.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleFinish() {
    if (!window.confirm("¿Cerrar el partido? El marcador y las tarjetas quedan como finales.")) return;
    setSubmitting("finish");
    setError(null);
    try {
      await finishMatchAction(adminName!, match.id, form);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el partido.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-surface-elevated p-4">
      <div className="mb-3 flex items-center gap-2">
        <PlayCircle className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Acta en vivo</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="truncate text-xs font-medium text-muted-strong">{homeTeam?.name ?? "Local"}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => patch("homeScore", Math.max(0, form.homeScore - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-strong hover:bg-surface"
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold tabular-nums text-foreground">
              {form.homeScore}
            </span>
            <button
              type="button"
              onClick={() => patch("homeScore", form.homeScore + 1)}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-strong hover:bg-surface"
            >
              +
            </button>
          </div>
          <CounterInput label="🟨 Amarillas" value={form.homeYellowCards} onChange={(v) => patch("homeYellowCards", v)} />
          <CounterInput label="🟥 Rojas" value={form.homeRedCards} onChange={(v) => patch("homeRedCards", v)} />
        </div>

        <div className="space-y-3">
          <p className="truncate text-xs font-medium text-muted-strong">{awayTeam?.name ?? "Visitante"}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => patch("awayScore", Math.max(0, form.awayScore - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-strong hover:bg-surface"
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold tabular-nums text-foreground">
              {form.awayScore}
            </span>
            <button
              type="button"
              onClick={() => patch("awayScore", form.awayScore + 1)}
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-strong hover:bg-surface"
            >
              +
            </button>
          </div>
          <CounterInput label="🟨 Amarillas" value={form.awayYellowCards} onChange={(v) => patch("awayYellowCards", v)} />
          <CounterInput label="🟥 Rojas" value={form.awayRedCards} onChange={(v) => patch("awayRedCards", v)} />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-loss">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting !== null}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-strong hover:bg-surface disabled:opacity-50"
        >
          {submitting === "save" ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={submitting !== null}
          className={cn(
            "flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50",
          )}
        >
          <CheckCircle2 className="size-4" />
          {submitting === "finish" ? "Cerrando…" : "Cerrar partido"}
        </button>
        {saved && <span className="text-xs text-primary">Guardado.</span>}
      </div>
    </div>
  );
}
