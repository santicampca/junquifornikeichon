"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { deleteTournamentAction } from "@/lib/actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

export function DeleteTournamentButton({ tournamentName }: { tournamentName: string }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteTournamentAction(adminName!);
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el torneo.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-loss/30 px-3 py-1.5 text-sm font-medium text-loss hover:bg-loss/10"
        >
          <Trash2 className="size-4" />
          Eliminar liga
        </button>
        {error && <span className="text-xs text-loss">{error}</span>}
      </div>
      <ConfirmDialog
        open={open}
        title={`¿Eliminar "${tournamentName}"?`}
        description="Se borran para siempre el calendario y todos los resultados cargados de esta liga. Los equipos NO se borran: quedan disponibles para reusar como plantilla en la próxima liga que crees. No hay forma de deshacer esto."
        confirmLabel={submitting ? "Eliminando…" : "Sí, eliminar todo"}
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
