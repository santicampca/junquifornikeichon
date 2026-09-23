import Link from "next/link";
import type { CompetitionStage } from "@/types/domain";
import { STAGE_TYPE_LABEL } from "@/types/domain";
import { cn } from "@/lib/utils";

export function StageTabs({
  tournamentSlug,
  stages,
  activeStageId,
  basePath,
}: {
  tournamentSlug: string;
  stages: CompetitionStage[];
  activeStageId: string;
  /** Por defecto `/torneos/[slug]`; pasar `/torneos/[slug]/calendario` etc. para reusar los tabs en otras vistas. */
  basePath?: string;
}) {
  const base = basePath ?? `/torneos/${tournamentSlug}`;

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
      {stages.map((stage) => {
        const isActive = stage.id === activeStageId;
        return (
          <Link
            key={stage.id}
            href={`${base}?fase=${stage.id}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-strong hover:bg-surface-elevated hover:text-foreground",
            )}
          >
            {STAGE_TYPE_LABEL[stage.type]}
          </Link>
        );
      })}
    </div>
  );
}
