import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type {
  CompetitionStage,
  Match,
  Player,
  StageParticipant,
  Team,
  TeamAvailability,
  TournamentState,
} from "@/types/domain";

// `proofImageData` (foto de comprobante en base64) puede pesar bastante y
// `getActiveTournamentState` trae TODOS los partidos del torneo en cada
// request de cada página — incluirla ahí infla cada request innecesariamente.
// Se excluye acá y se trae aparte, solo en la página de detalle del
// partido, con `getMatchProofImage`.
const MATCH_SELECT_WITHOUT_PROOF = {
  id: true,
  stageId: true,
  matchdayId: true,
  homeTeamId: true,
  awayTeamId: true,
  homeScore: true,
  awayScore: true,
  homeYellowCards: true,
  awayYellowCards: true,
  homeRedCards: true,
  awayRedCards: true,
  scheduledAt: true,
  dayOfWeek: true,
  venue: true,
  round: true,
  status: true,
  isMandatorySundayMatch: true,
  isForfeit: true,
} as const;

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
              participants: true,
              matches: { select: MATCH_SELECT_WITHOUT_PROOF },
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
    hasPin: t.pinHash !== null,
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
      isForfeit: m.isForfeit ?? false,
      // No se trae acá a propósito (ver MATCH_SELECT_WITHOUT_PROOF).
      proofImageData: undefined,
    }));
  }

  const stageParticipants: StageParticipant[] = stageRecords.flatMap((s) =>
    s.participants.map((p) => ({
      stageId: p.stageId,
      teamId: p.teamId,
      pointsAdjustment: p.pointsAdjustment ?? 0,
    })),
  );

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
    stageParticipants,
  };
});

/**
 * Roster de equipos para "Usar plantilla actual" en el asistente de crear
 * torneo. No depende de que haya un torneo activo: busca el `tournamentId`
 * más reciente entre TODOS los equipos que existen (incluidos los
 * huérfanos de una liga borrada, ver `deleteTournamentAction`) y devuelve
 * ese grupo completo. Así el asistente siempre tiene equipos para
 * precargar, incluso recién después de borrar la liga activa.
 */
export const getLastTeamRoster = cache(
  async (): Promise<{ teams: Team[]; teamAvailability: TeamAvailability[] }> => {
    const latestTeam = await prisma.team.findFirst({ orderBy: { createdAt: "desc" } });
    if (!latestTeam) return { teams: [], teamAvailability: [] };

    const [teamRecords, availabilityRecords] = await Promise.all([
      prisma.team.findMany({ where: { tournamentId: latestTeam.tournamentId }, orderBy: { createdAt: "asc" } }),
      prisma.teamAvailability.findMany({ where: { tournamentId: latestTeam.tournamentId } }),
    ]);

    const teams: Team[] = teamRecords.map((t) => ({
      id: t.id,
      tournamentId: t.tournamentId,
      name: t.name,
      shortName: t.shortName ?? undefined,
      slug: t.slug,
      logoUrl: t.logoUrl ?? undefined,
      managerName: t.managerName,
      primaryColor: t.primaryColor ?? undefined,
      foundedYear: t.foundedYear ?? undefined,
      hasPin: t.pinHash !== null,
    }));

    const teamAvailability: TeamAvailability[] = availabilityRecords.map((a) => ({
      teamId: a.teamId,
      tournamentId: a.tournamentId,
      allowedDays: a.allowedDays,
      notes: a.notes ?? undefined,
    }));

    return { teams, teamAvailability };
  },
);

/**
 * Trae solo la foto de comprobante de un partido (base64), separada del
 * snapshot principal por su peso (ver `MATCH_SELECT_WITHOUT_PROOF`). Se usa
 * únicamente en la página de detalle del partido.
 */
export const getMatchProofImage = cache(async (matchId: string): Promise<string | undefined> => {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { proofImageData: true } });
  return match?.proofImageData ?? undefined;
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
