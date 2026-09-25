"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { generatePlayoffsAction, generatePlayoffsSemifinalsAction, generatePlayoffsFinalAction } from "@/lib/actions";
import type { Match } from "@/types/domain";

const MODE_LABEL = {
  quarters: "Generar Cuartos de Final (top 8)",
  semis: "Generar semifinales",
  final: "Generar la final",
} as const;

export function GeneratePlayoffsButton({ stageId, matches }: { stageId: string; matches: Match[] }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) return null;

  const quarterfinals = matches.filter((m) => m.round === "Cuartos de Final");
  const semifinals = matches.filter((m) => m.round === "Semifinal");
  const hasFinal = matches.some((m) => m.round === "Final");
  const isClosed = (m: Match) => m.status === "PLAYED" || m.status === "WALKOVER";
  const quarterfinalsClosed = quarterfinals.length === 4 && quarterfinals.every(isClosed);
  const semifinalsClosed = semifinals.length === 2 && semifinals.every(isClosed);

  let mode: keyof typeof MODE_LABEL | null = null;
  if (matches.length === 0) mode = "quarters";
  else if (quarterfinalsClosed && semifinals.length === 0) mode = "semis";
  else if (semifinalsClosed && !hasFinal) mode = "final";

  if (!mode) return null;

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "quarters") await generatePlayoffsAction(adminName!, stageId);
      else if (mode === "semis") await generatePlayoffsSemifinalsAction(adminName!, stageId);
      else await generatePlayoffsFinalAction(adminName!, stageId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={submitting}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Swords className="size-4" />
        {submitting ? "Generando…" : MODE_LABEL[mode]}
      </button>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
