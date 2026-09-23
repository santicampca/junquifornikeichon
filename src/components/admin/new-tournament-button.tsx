"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { CreateTournamentDialog } from "@/components/admin/create-tournament-dialog";
import type { Team, TeamAvailability } from "@/types/domain";

export function NewTournamentButton({
  currentTeams,
  currentTeamAvailability,
}: {
  currentTeams: Team[];
  currentTeamAvailability: TeamAvailability[];
}) {
  const { isAdmin } = useAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hint, setHint] = useState(false);

  return (
    <div className="text-right">
      <button
        onClick={() => (isAdmin ? setDialogOpen(true) : setHint(true))}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="size-4" />
        Nuevo torneo
      </button>
      {hint && !isAdmin && (
        <p className="mt-1.5 max-w-52 text-xs text-muted">
          Iniciá sesión como admin (arriba a la derecha) para crear un torneo.
        </p>
      )}
      <CreateTournamentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        currentTeams={currentTeams}
        currentTeamAvailability={currentTeamAvailability}
      />
    </div>
  );
}
