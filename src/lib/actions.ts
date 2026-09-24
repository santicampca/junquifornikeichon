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
    data: {
      homeScore: null,
      awayScore: null,
      homeYellowCards: 0,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 0,
      status: "SCHEDULED",
    },
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
  warnings: string[];
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

  const { state, conflicts, warnings } = createTournamentState(input);

  await prisma.tournament.updateMany({ where: { isActive: true }, data: { isActive: false } });
  const { tournamentSlug } = await persistTournamentState(state, { isActive: true });

  revalidatePath("/", "layout");

  return { tournamentSlug, conflicts, warnings };
}

// ============================================================
// PLANTILLA DE JUGADORES (CRUD)
// ============================================================

export interface PlayerInput {
  name: string;
  number?: number;
  position?: string;
}

function assertValidPlayerInput(input: PlayerInput) {
  if (!input.name.trim()) throw new Error("El jugador necesita un nombre.");
  if (input.number !== undefined && (!Number.isInteger(input.number) || input.number < 0 || input.number > 99)) {
    throw new Error("El dorsal debe ser un número entero entre 0 y 99.");
  }
}

export async function createPlayerAction(adminName: string, teamId: string, input: PlayerInput): Promise<void> {
  assertAdmin(adminName);
  assertValidPlayerInput(input);

  await prisma.player.create({
    data: {
      teamId,
      name: input.name.trim(),
      number: input.number,
      position: input.position?.trim() || undefined,
    },
  });

  revalidatePath("/", "layout");
}

export async function updatePlayerAction(adminName: string, playerId: string, input: PlayerInput): Promise<void> {
  assertAdmin(adminName);
  assertValidPlayerInput(input);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      name: input.name.trim(),
      number: input.number,
      position: input.position?.trim() || undefined,
    },
  });

  revalidatePath("/", "layout");
}

export async function deletePlayerAction(adminName: string, playerId: string): Promise<void> {
  assertAdmin(adminName);
  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath("/", "layout");
}

// ============================================================
// ACTA DE PARTIDO EN VIVO
// ============================================================

export interface MatchLiveInput {
  homeScore: number;
  awayScore: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
}

function assertValidMatchLiveInput(input: MatchLiveInput) {
  const values = Object.values(input);
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    throw new Error("Los marcadores y tarjetas deben ser números enteros no negativos.");
  }
}

/**
 * Actualiza el marcador y las tarjetas de un partido "en caliente". Si el
 * partido todavía estaba SCHEDULED, lo pasa a LIVE (primer toque del acta).
 * No cierra el partido: para eso está `finishMatchAction`.
 */
export async function updateMatchLiveAction(
  adminName: string,
  matchId: string,
  input: MatchLiveInput,
): Promise<void> {
  assertAdmin(adminName);
  assertValidMatchLiveInput(input);

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("El partido no existe.");
  if (match.status === "PLAYED" || match.status === "CANCELLED") {
    throw new Error("Este partido ya está cerrado; reabrilo antes de editarlo.");
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...input,
      status: match.status === "SCHEDULED" ? "LIVE" : match.status,
    },
  });

  revalidatePath("/", "layout");
}

/**
 * Cierra el acta: fija el marcador/tarjetas final y pasa el partido a
 * PLAYED. La tabla de posiciones se recalcula sola en el próximo render
 * (`computeStandings` lee directo de los partidos PLAYED), no hace falta
 * ningún paso extra acá.
 */
export async function finishMatchAction(adminName: string, matchId: string, input: MatchLiveInput): Promise<void> {
  assertAdmin(adminName);
  assertValidMatchLiveInput(input);

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("El partido no existe.");
  if (match.status === "CANCELLED") {
    throw new Error("Un partido cancelado no se puede cerrar como jugado.");
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { ...input, status: "PLAYED" },
  });

  revalidatePath("/", "layout");
}

// ============================================================
// CALENDARIO: REPROGRAMAR UN PARTIDO
// ============================================================

/// Ciclo fijo de la liga: los partidos solo se juegan de jueves a lunes.
const ALLOWED_MATCH_DAYS = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"] as const;

const DAY_FROM_JS_INDEX = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

/**
 * Reprograma un partido a una nueva fecha/hora, validando de forma estricta:
 *  - Que caiga dentro del ciclo fijo jueves a lunes de la liga.
 *  - Que respete la disponibilidad propia de cada equipo (si la tiene
 *    configurada, ej: Alianza Lima solo juega jueves/domingo).
 * Si algo no cumple, no se guarda nada: se tira un error con el motivo
 * exacto para que se muestre tal cual en el panel del admin.
 */
export async function rescheduleMatchAction(
  adminName: string,
  matchId: string,
  scheduledAtIso: string,
): Promise<void> {
  assertAdmin(adminName);

  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Fecha/hora inválida.");

  const dayOfWeek = DAY_FROM_JS_INDEX[scheduledAt.getDay()];
  if (!ALLOWED_MATCH_DAYS.includes(dayOfWeek as (typeof ALLOWED_MATCH_DAYS)[number])) {
    throw new Error("La liga solo juega de jueves a lunes; elegí un día dentro de ese rango.");
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("El partido no existe.");

  const availability = await prisma.teamAvailability.findMany({
    where: { teamId: { in: [match.homeTeamId, match.awayTeamId] } },
  });
  for (const a of availability) {
    if (a.allowedDays.length > 0 && !a.allowedDays.includes(dayOfWeek)) {
      const team = await prisma.team.findUnique({ where: { id: a.teamId } });
      throw new Error(`${team?.name ?? "Uno de los equipos"} no puede jugar ese día según su disponibilidad configurada.`);
    }
  }

  // Heurística simple: si el partido queda en domingo y alguno de los dos
  // equipos tiene disponibilidad restringida, cumple la regla del "domingo
  // obligatorio"; si no, no. No revalida el resto de la jornada.
  const restrictedTeamIds = new Set(availability.filter((a) => a.allowedDays.length > 0).map((a) => a.teamId));
  const isMandatorySundayMatch =
    dayOfWeek === "SUNDAY" &&
    (restrictedTeamIds.has(match.homeTeamId) || restrictedTeamIds.has(match.awayTeamId));

  await prisma.match.update({
    where: { id: matchId },
    data: { scheduledAt, dayOfWeek, isMandatorySundayMatch },
  });

  revalidatePath("/", "layout");
}
