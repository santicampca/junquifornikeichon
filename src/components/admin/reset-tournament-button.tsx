"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { resetTournamentAction } from "@/lib/actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

export function ResetTournamentButton() {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [open, setOpen] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await resetTournamentAction(adminName!);
      setOpen(false);
      setJustReset(true);
      router.refresh();
      setTimeout(() => setJustReset(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reiniciar el torneo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-strong hover:border-loss/40 hover:text-loss"
        >
          <RotateCcw className="size-4" />
          Reiniciar torneo
        </button>
        {justReset && <span className="text-xs text-primary">Torneo reiniciado.</span>}
        {error && <span className="text-xs text-loss">{error}</span>}
      </div>
      <ConfirmDialog
        open={open}
        title="¿Reiniciar el torneo?"
        description="Se borran todos los marcadores cargados y la tabla vuelve a cero (PJ, Pts, goles). El calendario y los equipos quedan exactamente igual. Esta acción no se puede deshacer."
        confirmLabel={submitting ? "Reiniciando…" : "Sí, reiniciar"}
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
