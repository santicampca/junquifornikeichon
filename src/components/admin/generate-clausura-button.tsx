"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { generateClausuraCalendarAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function GenerateClausuraButton({ stageId }: { stageId: string }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [seasonStart, setSeasonStart] = useState(defaultStart);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminName) return;
    if (!seasonStart) {
      setError("Elegí la fecha de inicio.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await generateClausuraCalendarAction(adminName, stageId, seasonStart);
    if (result.success) {
      router.refresh();
      const notes: string[] = [];
      if (result.conflictsCount > 0) {
        notes.push(
          `${result.conflictsCount} partido(s) no se pudieron ubicar automáticamente (faltó cupo); reprogramalos a mano.`,
        );
      }
      if (result.warnings.length > 0) {
        notes.push(`${result.warnings.length} jornada(s) quedaron sin el partido dominical obligatorio.`);
      }
      if (notes.length > 0) window.alert(`Calendario del Clausura generado. Ojo:\n\n${notes.join("\n")}`);
    } else {
      setError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={seasonStart}
          onChange={(e) => setSeasonStart(e.target.value)}
          className={cn(
            "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary",
          )}
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <CalendarPlus className="size-4" />
          {submitting ? "Generando…" : "Generar calendario del Clausura"}
        </button>
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
    </form>
  );
}
