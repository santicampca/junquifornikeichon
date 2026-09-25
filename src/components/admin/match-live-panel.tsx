"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, PlayCircle, ShieldAlert } from "lucide-react";
import { useAdmin, useTeamAuth } from "@/lib/app-store";
import {
  finishMatchAction,
  markForfeitAction,
  updateMatchLiveAction,
  uploadMatchProofAction,
  type MatchLiveInput,
} from "@/lib/actions";
import { compressImageFile } from "@/lib/image";
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

/**
 * Acta en vivo: marcador + tarjetas editables, comprobante de foto y cierre
 * del partido. "Cerrar partido" exige comprobante ya subido; para un
 * partido no jugado (incomparecencia) está el forfeit aparte, que no lo pide.
 * No es admin-only: cualquiera de los dos equipos que juegan este partido
 * también puede cargarlo (mismo criterio que la plantilla de jugadores).
 */
export function MatchLivePanel({
  match,
  homeTeam,
  awayTeam,
  proofImageData,
}: {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  /** Foto de comprobante ya cargada (si existe), traída aparte por su peso. */
  proofImageData?: string;
}) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const { session } = useTeamAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<MatchLiveInput>({
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    homeYellowCards: match.homeYellowCards,
    awayYellowCards: match.awayYellowCards,
    homeRedCards: match.homeRedCards,
    awayRedCards: match.awayRedCards,
  });
  const [proofPreview, setProofPreview] = useState<string | undefined>(proofImageData);
  const [submitting, setSubmitting] = useState<"save" | "finish" | "proof" | "forfeit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeitWinner, setForfeitWinner] = useState<"home" | "away">("home");
  const [forfeitWinnerScore, setForfeitWinnerScore] = useState(3);
  const [forfeitLoserScore, setForfeitLoserScore] = useState(0);

  const isClosed = CLOSED_STATUSES.includes(match.status);
  const canEdit = isAdmin || session?.teamId === match.homeTeamId || session?.teamId === match.awayTeamId;
  const callerTeamId = session?.teamId ?? null;

  if (!canEdit) return null;
  if (isClosed) return null;

  function patch(field: keyof MatchLiveInput, value: number) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSubmitting("save");
    setError(null);
    try {
      await updateMatchLiveAction(adminName, callerTeamId, match.id, form);
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
      await finishMatchAction(adminName, callerTeamId, match.id, form);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el partido.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitting("proof");
    setError(null);
    try {
      const dataUrl = await compressImageFile(file);
      await uploadMatchProofAction(adminName, callerTeamId, match.id, dataUrl);
      setProofPreview(dataUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el comprobante.");
    } finally {
      setSubmitting(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleForfeit() {
    const winnerTeamId = forfeitWinner === "home" ? match.homeTeamId : match.awayTeamId;
    const winnerName = (forfeitWinner === "home" ? homeTeam?.name : awayTeam?.name) ?? "el ganador";
    if (!window.confirm(`¿Cerrar como forfeit a favor de ${winnerName}? No se puede deshacer.`)) return;
    setSubmitting("forfeit");
    setError(null);
    try {
      await markForfeitAction(adminName, callerTeamId, match.id, winnerTeamId, forfeitWinnerScore, forfeitLoserScore);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar el forfeit.");
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

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Comprobante del resultado
        </p>
        {proofPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, no next/image posible
          <img src={proofPreview} alt="Comprobante" className="mb-2 max-h-40 rounded-lg border border-border" />
        ) : (
          <p className="mb-2 text-xs text-muted">
            Sin comprobante todavía. Hace falta uno para poder cerrar el partido (salvo forfeit).
          </p>
        )}
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-strong hover:bg-surface",
            submitting === "proof" && "opacity-50",
          )}
        >
          <ImagePlus className="size-4" />
          {submitting === "proof" ? "Subiendo…" : proofPreview ? "Cambiar foto" : "Subir foto"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleProofChange}
            disabled={submitting !== null}
            className="hidden"
          />
        </label>
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
          disabled={submitting !== null || !proofPreview}
          title={!proofPreview ? "Subí el comprobante primero" : undefined}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          {submitting === "finish" ? "Cerrando…" : "Cerrar partido"}
        </button>
        {saved && <span className="text-xs text-primary">Guardado.</span>}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setForfeitOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-loss hover:underline"
        >
          <ShieldAlert className="size-3.5" />
          {forfeitOpen ? "Cancelar forfeit" : "Marcar como forfeit"}
        </button>
        {forfeitOpen && (
          <div className="mt-2 space-y-2 rounded-lg border border-loss/30 bg-loss/5 p-3">
            <p className="text-xs text-muted">
              Para cuando un equipo no se presentó. No pide comprobante y cierra el partido directo.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={forfeitWinner === "home"}
                  onChange={() => setForfeitWinner("home")}
                />
                Ganó {homeTeam?.name ?? "Local"}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={forfeitWinner === "away"}
                  onChange={() => setForfeitWinner("away")}
                />
                Ganó {awayTeam?.name ?? "Visitante"}
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-muted">Marcador:</span>
              <input
                type="number"
                min={0}
                value={forfeitWinnerScore}
                onChange={(e) => setForfeitWinnerScore(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
              />
              <span>-</span>
              <input
                type="number"
                min={0}
                value={forfeitLoserScore}
                onChange={(e) => setForfeitLoserScore(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleForfeit}
              disabled={submitting !== null}
              className="rounded-lg bg-loss px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting === "forfeit" ? "Cerrando…" : "Cerrar como forfeit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
