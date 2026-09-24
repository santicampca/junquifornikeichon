import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { CompetitionStage, Match, Player, Team, TeamAvailability, TournamentState } from "@/types/domain";

/**
 * Lee el torneo activo (Tournament.isActive = true) completo desde Mongo y
 * lo devuelve con la misma forma que usan las páginas y componentes
 * (`TournamentState`). Si no hay ningún torneo activo (base recién creada,
 * sin seed), devuelve `null`.
 *
 * Envuelta en `cache()` de React: el layout y la página de una misma
 * request la llaman por separado, pero solo se ejecuta una consulta real.
 */
export const getActiveTournamentState = cache(async (): Promise<TournamentState | null> => {
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      teams: true,
      teamAvailability: true,
      seasons: {
        include: {
          stages: {
            include: {
              aggregatesFrom: true,
              matches: true,
            },
          },
        },
      },
    },
  });

  if (!tournament) return null;

  const teams: Team[] = tournament.teams.map((t) => ({
    id: t.id,
    tournamentId: t.tournamentId,
    name: t.name,
    shortName: t.shortName ?? undefined,
    slug: t.slug,
    logoUrl: t.logoUrl ?? undefined,
    managerName: t.managerName,
    primaryColor: t.primaryColor ?? undefined,
    foundedYear: t.foundedYear ?? undefined,
  }));

  const teamAvailability: TeamAvailability[] = tournament.teamAvailability.map((a) => ({
    teamId: a.teamId,
    tournamentId: a.tournamentId,
    allowedDays: a.allowedDays,
    notes: a.notes ?? undefined,
  }));

  const stageRecords = tournament.seasons.flatMap((season) => season.stages);

  const stages: CompetitionStage[] = stageRecords.map((s) => ({
    id: s.id,
    seasonId: s.seasonId,
    name: s.name,
    type: s.type,
    format: s.format,
    status: s.status,
    points: { win: s.pointsForWin, draw: s.pointsForDraw, loss: s.pointsForLoss },
    aggregatesFrom: s.aggregatesFrom.length > 0 ? s.aggregatesFrom.map((a) => a.childStageId) : undefined,
  }));

  const matchesByStage: Record<string, Match[]> = {};
  for (const s of stageRecords) {
    matchesByStage[s.id] = s.matches.map((m) => ({
      id: m.id,
      stageId: m.stageId,
      matchdayId: m.matchdayId ?? undefined,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      // `?? 0` / `?? false`: los partidos sembrados antes de agregar estos
      // campos no los tienen en el documento de Mongo; Prisma normalmente
      // rellena el default al leer, pero esto blinda igual contra un
      // `undefined` si algún documento viejo no lo trae.
      homeYellowCards: m.homeYellowCards ?? 0,
      awayYellowCards: m.awayYellowCards ?? 0,
      homeRedCards: m.homeRedCards ?? 0,
      awayRedCards: m.awayRedCards ?? 0,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : undefined,
      dayOfWeek: m.dayOfWeek ?? undefined,
      venue: m.venue ?? undefined,
      round: m.round ?? undefined,
      status: m.status,
      isMandatorySundayMatch: m.isMandatorySundayMatch ?? false,
    }));
  }

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      logoUrl: tournament.logoUrl ?? undefined,
      description: tournament.description ?? undefined,
    },
    teams,
    teamAvailability,
    stages,
    matchesByStage,
  };
});

/**
 * Plantilla de jugadores de un equipo. Separada de `getActiveTournamentState`
 * porque solo se necesita en la página de detalle del equipo, no en cada
 * request del resto de la app.
 */
export const getTeamPlayers = cache(async (teamId: string): Promise<Player[]> => {
  const players = await prisma.player.findMany({
    where: { teamId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
  });

  return players.map((p) => ({
    id: p.id,
    teamId: p.teamId,
    name: p.name,
    number: p.number ?? undefined,
    position: p.position ?? undefined,
  }));
});
