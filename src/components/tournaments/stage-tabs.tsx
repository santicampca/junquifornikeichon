import Link from "next/link";
import type { CompetitionStage } from "@/types/domain";
import { STAGE_TYPE_LABEL } from "@/types/domain";
import { cn } from "@/lib/utils";

function tabClass(isActive: boolean) {
  return cn(
    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted-strong hover:bg-surface-elevated hover:text-foreground",
  );
}

export function StageTabs({
  tournamentSlug,
  stages,
  activeStageId,
  basePath,
  extraTabs = [],
}: {
  tournamentSlug: string;
  stages: CompetitionStage[];
  activeStageId: string;
  /** Por defecto `/torneos/[slug]`; pasar `/torneos/[slug]/calendario` etc. para reusar los tabs en otras vistas. */
  basePath?: string;
  /** Pestañas extra que no son una fase (ej: Reglas, Palmarés), al final de la lista. */
  extraTabs?: { id: string; label: string }[];
}) {
  const base = basePath ?? `/torneos/${tournamentSlug}`;

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
      {stages.map((stage) => (
        <Link key={stage.id} href={`${base}?fase=${stage.id}`} className={tabClass(stage.id === activeStageId)}>
          {STAGE_TYPE_LABEL[stage.type]}
        </Link>
      ))}
      {extraTabs.map((tab) => (
        <Link key={tab.id} href={`${base}?fase=${tab.id}`} className={tabClass(tab.id === activeStageId)}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
