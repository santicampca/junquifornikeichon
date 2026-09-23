import type { Team } from "@/types/domain";
import { cn } from "@/lib/utils";

/** Insignia circular del equipo: usa el logo si existe, si no las iniciales. */
export function TeamBadge({
  team,
  size = "md",
}: {
  team: Pick<Team, "name" | "shortName" | "primaryColor" | "logoUrl">;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (team.shortName ?? team.name).slice(0, 3).toUpperCase();
  const sizeClasses = {
    sm: "size-6 text-[10px]",
    md: "size-9 text-xs",
    lg: "size-14 text-base",
  }[size];

  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL de logo arbitraria/externa, sin dominio fijo para next/image
      <img
        src={team.logoUrl}
        alt={team.name}
        className={cn("shrink-0 rounded-full object-cover", sizeClasses)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        sizeClasses,
      )}
      style={{ backgroundColor: team.primaryColor ?? "#3b82f6" }}
    >
      {initials}
    </span>
  );
}
