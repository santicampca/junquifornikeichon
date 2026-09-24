import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { StageTabs } from "@/components/tournaments/stage-tabs";
import { MatchCard } from "@/components/matches/match-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveTournamentState } from "@/lib/data";
import type { Match } from "@/types/domain";

function roundNumber(label: string): number {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export default async function CalendarPage(props: PageProps<"/torneos/[slug]/calendario">) {
  const { slug } = await props.params;
  const { fase } = await props.searchParams;

  const state = await getActiveTournamentState();
  if (!state || slug !== state.tournament.slug) notFound();

  const { tournament, teams, stages, matchesByStage } = state;
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const activeStage =
    stages.find((s) => s.id === fase) ?? stages.find((s) => s.type === "APERTURA") ?? stages[0];

  const matches: Match[] = matchesByStage[activeStage.id] ?? [];

  const byRound = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.round ?? "Sin jornada";
    const bucket = byRound.get(key) ?? [];
    bucket.push(m);
    byRound.set(key, bucket);
  }
  const rounds = [...byRound.entries()].sort((a, b) => roundNumber(a[0]) - roundNumber(b[0]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/torneos/${tournament.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tournament.name}
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <CalendarDays className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Calendario</h1>
          <p className="text-sm text-muted">{activeStage.name}</p>
        </div>
      </div>

      <div className="mb-6">
        <StageTabs
          tournamentSlug={tournament.slug}
          stages={stages}
          activeStageId={activeStage.id}
          basePath={`/torneos/${tournament.slug}/calendario`}
        />
      </div>

      {rounds.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Esta fase todavía no tiene calendario"
          description="La Tabla General no tiene partidos propios: agrega los puntos de Apertura y Clausura."
        />
      ) : (
        <div className="space-y-6">
          {rounds.map(([round, roundMatches]) => (
            <section key={round}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{round}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {roundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    homeTeam={teamsById.get(match.homeTeamId)}
                    awayTeam={teamsById.get(match.awayTeamId)}
                    tournamentSlug={tournament.slug}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
