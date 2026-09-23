"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAdmin, useTournamentStore } from "@/lib/app-store";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

export function ResetTournamentButton() {
  const { isAdmin } = useAdmin();
  const { resetTournament } = useTournamentStore();
  const [open, setOpen] = useState(false);
  const [justReset, setJustReset] = useState(false);

  if (!isAdmin) return null;

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
      </div>
      <ConfirmDialog
        open={open}
        title="¿Reiniciar el torneo?"
        description="Se borran todos los marcadores cargados y la tabla vuelve a cero (PJ, Pts, goles). El calendario y los equipos quedan exactamente igual. Esta acción no se puede deshacer."
        confirmLabel="Sí, reiniciar"
        tone="danger"
        onConfirm={() => {
          resetTournament();
          setOpen(false);
          setJustReset(true);
          setTimeout(() => setJustReset(false), 3000);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
