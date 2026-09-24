"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { rescheduleMatchAction } from "@/lib/actions";
import type { Match } from "@/types/domain";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

/** yyyy-MM-ddThh:mm para el input datetime-local, en hora local. */
function toLocalInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RescheduleMatchForm({ match }: { match: Match }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();

  const [value, setValue] = useState(() => toLocalInputValue(match.scheduledAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!isAdmin || !adminName) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await rescheduleMatchAction(adminName!, match.id, new Date(value).toISOString());
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reprogramar el partido.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-strong" />
        <h3 className="text-sm font-semibold text-foreground">Reprogramar</h3>
      </div>
      <p className="mb-2 text-xs text-muted">
        La liga solo juega de jueves a lunes; si el equipo tiene días fijos configurados (ej: Alianza Lima,
        UD Europollas), también se valida contra eso.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn(inputClass)}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Guardando…" : "Reprogramar"}
        </button>
        {saved && <span className="text-xs text-primary">Reprogramado.</span>}
      </div>
      {error && <p className="mt-2 text-xs text-loss">{error}</p>}
    </form>
  );
}
