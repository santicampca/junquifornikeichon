"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { adjustStagePointsAction } from "@/lib/actions";

export function PointsAdjuster({ stageId, teamId }: { stageId: string; teamId: string }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) return null;

  async function apply(delta: number) {
    setSubmitting(true);
    setError(null);
    try {
      await adjustStagePointsAction(adminName!, stageId, teamId, delta);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ajustar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1" title={error ?? "Sumar/restar puntos a mano"}>
      <button
        type="button"
        disabled={submitting}
        onClick={() => apply(-1)}
        className="flex size-5 items-center justify-center rounded border border-border text-muted hover:border-loss/40 hover:text-loss disabled:opacity-50"
        aria-label="Restar un punto"
      >
        <Minus className="size-3" />
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={() => apply(1)}
        className="flex size-5 items-center justify-center rounded border border-border text-muted hover:border-primary/40 hover:text-primary disabled:opacity-50"
        aria-label="Sumar un punto"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
