"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getActiveTournamentState } from "@/lib/data";
import { persistTournamentState } from "@/lib/persist-tournament";
import { createTournamentState, type CreateTournamentInput, type CreateTournamentConflict } from "@/lib/tournament-factory";

// Misma lista que src/lib/app-store.tsx: una traba de conveniencia, no
// autenticación real. Se valida acá también (no solo en el cliente) porque
// una Server Action es un endpoint HTTP más: cualquiera con la URL podría
// invocarla directo si no se revisara el nombre del lado del servidor.
const ADMIN_ALLOWLIST = ["santiago", "zenits", "zenit s"];

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function assertAdmin(adminName: string) {
  if (!ADMIN_ALLOWLIST.includes(normalizeName(adminName))) {
    throw new Error("No tenés permisos de administrador para hacer esto.");
  }
}

/**
 * Pone todos los partidos del torneo activo en su estado inicial: borra
 * marcadores (null) y status vuelve a SCHEDULED. No toca calendario ni
 * equipos.
 */
export async function resetTournamentAction(adminName: string): Promise<void> {
  assertAdmin(adminName);

  const state = await getActiveTournamentState();
  if (!state) throw new Error("No hay torneo activo para reiniciar.");

  const stageIds = state.stages.map((s) => s.id);

  await prisma.match.updateMany({
    where: { stageId: { in: stageIds } },
    data: { homeScore: null, awayScore: null, status: "SCHEDULED" },
  });

  await prisma.competitionStage.updateMany({
    where: { id: { in: stageIds }, status: { not: "DRAFT" } },
    data: { status: "SCHEDULED" },
  });

  revalidatePath("/", "layout");
}

/**
 * Elimina por completo el torneo activo (equipos, fases, calendario,
 * resultados) de la base. Si queda algún torneo archivado (de una creación
 * anterior), el más reciente pasa a ser el activo; si no queda ninguno, la
 * app vuelve al estado "sin torneo".
 */
export async function deleteTournamentAction(adminName: string): Promise<void> {
  assertAdmin(adminName);

  const state = await getActiveTournamentState();
  if (!state) throw new Error("No hay torneo activo para eliminar.");

  const stageIds = state.stages.map((s) => s.id);
  const teamIds = state.teams.map((t) => t.id);

  // Orden explícito para no depender de la emulación de cascade de Mongo:
  // primero lo que referencia stages/teams, después stages/teams, al final el torneo.
  await prisma.match.deleteMany({ where: { stageId: { in: stageIds } } });
  await prisma.stageParticipant.deleteMany({ where: { stageId: { in: stageIds } } });
  await prisma.stageAggregation.deleteMany({
    where: { OR: [{ parentStageId: { in: stageIds } }, { childStageId: { in: stageIds } }] },
  });
  await prisma.matchday.deleteMany({ where: { stageId: { in: stageIds } } });
  await prisma.competitionStage.deleteMany({ where: { id: { in: stageIds } } });
  await prisma.teamAvailability.deleteMany({ where: { tournamentId: state.tournament.id } });
  await prisma.player.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.season.deleteMany({ where: { tournamentId: state.tournament.id } });
  await prisma.tournament.delete({ where: { id: state.tournament.id } });

  const nextActive = await prisma.tournament.findFirst({ orderBy: { createdAt: "desc" } });
  if (nextActive) {
    await prisma.tournament.update({ where: { id: nextActive.id }, data: { isActive: true } });
  }

  revalidatePath("/", "layout");
}

export interface CreateTournamentOutcome {
  tournamentSlug: string;
  conflicts: CreateTournamentConflict[];
}

/**
 * Arma un torneo nuevo (mismo motor que el seed) y lo persiste como el
 * torneo activo. El anterior no se borra: queda archivado
 * (isActive = false), así no se pierde el historial.
 */
export async function createTournamentAction(
  adminName: string,
  input: CreateTournamentInput,
): Promise<CreateTournamentOutcome> {
  assertAdmin(adminName);

  const { state, conflicts } = createTournamentState(input);

  await prisma.tournament.updateMany({ where: { isActive: true }, data: { isActive: false } });
  const { tournamentSlug } = await persistTournamentState(state, { isActive: true });

  revalidatePath("/", "layout");

  return { tournamentSlug, conflicts };
}
