import Link from "next/link";
import type { Team } from "@/types/domain";
import { TeamBadge } from "@/components/teams/team-badge";
import { Card, CardContent } from "@/components/ui/card";

export function TeamCard({ team }: { team: Team }) {
  return (
    <Link href={`/equipos/${team.slug}`}>
      <Card className="transition-colors hover:border-border-strong">
        <CardContent className="flex items-center gap-3">
          <TeamBadge team={team} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{team.name}</p>
            <p className="truncate text-sm text-muted">DT/Mánager: {team.managerName}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
