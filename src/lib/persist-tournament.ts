import { prisma } from "@/lib/prisma";
import type { TournamentState } from "@/types/domain";

/**
 * Persiste un `TournamentState` armado en memoria (por `createTournamentState`,
 * ver tournament-factory.ts) en Mongo, remapeando los ids temporales del
 * generador a los ObjectId reales que asigna cada `create`. La usan tanto
 * `prisma/seed.ts` como la Server Action de creación de torneos
 * (`src/lib/actions.ts`), para no duplicar esta lógica.
 */
export async function persistTournamentState(
  state: TournamentState,
  { isActive = true }: { isActive?: boolean } = {},
): Promise<{ tournamentId: string; tournamentSlug: string }> {
  const tournament = await prisma.tournament.create({
    data: {
      name: state.tournament.name,
      slug: state.tournament.slug,
      description: state.tournament.description,
      isActive,
    },
  });

  const season = await prisma.season.create({
    data: {
      tournamentId: tournament.id,
      name: "Temporada actual",
      year: new Date().getFullYear(),
      isCurrent: true,
    },
  });

  const teamIdMap = new Map<string, string>(); // id temporal (factory) -> ObjectId real
  for (const t of state.teams) {
    const created = await prisma.team.create({
      data: {
        tournamentId: tournament.id,
        name: t.name,
        shortName: t.shortName,
        slug: t.slug,
        managerName: t.managerName,
        primaryColor: t.primaryColor,
      },
    });
    teamIdMap.set(t.id, created.id);
  }

  if (state.teamAvailability.length > 0) {
    await prisma.teamAvailability.createMany({
      data: state.teamAvailability.map((a) => ({
        teamId: teamIdMap.get(a.teamId)!,
        tournamentId: tournament.id,
        allowedDays: a.allowedDays,
        notes: a.notes,
      })),
    });
  }

  const stageIdMap = new Map<string, string>();
  for (const s of state.stages) {
    const created = await prisma.competitionStage.create({
      data: {
        seasonId: season.id,
        name: s.name,
        type: s.type,
        format: s.format,
        status: s.status,
        pointsForWin: s.points.win,
        pointsForDraw: s.points.draw,
        pointsForLoss: s.points.loss,
      },
    });
    stageIdMap.set(s.id, created.id);
  }

  for (const s of state.stages) {
    if (!s.aggregatesFrom || s.aggregatesFrom.length === 0) continue;
    await prisma.stageAggregation.createMany({
      data: s.aggregatesFrom.map((childOldId) => ({
        parentStageId: stageIdMap.get(s.id)!,
        childStageId: stageIdMap.get(childOldId)!,
      })),
    });
  }

  // Todos los equipos participan de las fases con partidos propios (no Supercopa/General).
  for (const s of state.stages) {
    if (s.type === "GENERAL" || s.type === "SUPERCOPA") continue;
    await prisma.stageParticipant.createMany({
      data: state.teams.map((t) => ({ stageId: stageIdMap.get(s.id)!, teamId: teamIdMap.get(t.id)! })),
    });
  }

  for (const [oldStageId, matches] of Object.entries(state.matchesByStage)) {
    if (matches.length === 0) continue;
    await prisma.match.createMany({
      data: matches.map((m) => ({
        stageId: stageIdMap.get(oldStageId)!,
        homeTeamId: teamIdMap.get(m.homeTeamId)!,
        awayTeamId: teamIdMap.get(m.awayTeamId)!,
        homeScore: m.homeScore ?? undefined,
        awayScore: m.awayScore ?? undefined,
        scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : undefined,
        dayOfWeek: m.dayOfWeek,
        round: m.round,
        status: m.status,
      })),
    });
  }

  return { tournamentId: tournament.id, tournamentSlug: tournament.slug };
}
