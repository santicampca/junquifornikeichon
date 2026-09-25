"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/app-store";
import { setStageLineupModeAction } from "@/lib/actions";
import type { LineupMode } from "@/types/domain";

const MODE_BADGE_LABEL: Record<LineupMode, string> = {
  PASIVO: "Modo pasivo (con arquero)",
  ACTIVO: "Modo activo (sin arquero)",
};

export function StageLineupModeSelector({ stageId, mode }: { stageId: string; mode?: LineupMode }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [submitting, setSubmitting] = useState(false);

  if (!isAdmin) {
    return mode ? <span className="text-xs text-muted">{MODE_BADGE_LABEL[mode]}</span> : null;
  }

  async function handleChange(value: string) {
    if (!adminName) return;
    setSubmitting(true);
    await setStageLineupModeAction(adminName, stageId, value === "" ? null : (value as LineupMode));
    router.refresh();
    setSubmitting(false);
  }

  return (
    <select
      value={mode ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      disabled={submitting}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
    >
      <option value="">Sin modo de alineación</option>
      <option value="PASIVO">Pasivo (con arquero)</option>
      <option value="ACTIVO">Activo (sin arquero)</option>
    </select>
  );
}
