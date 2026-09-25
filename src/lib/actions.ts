"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPin, isValidPin, verifyPin } from "@/lib/pin";
import { getActiveTournamentState } from "@/lib/data";
import { persistTournamentState } from "@/lib/persist-tournament";
import { createTournamentState, type CreateTournamentInput, type CreateTournamentConflict } from "@/lib/tournament-factory";
import { computeStandings, mergeStandings } from "@/lib/standings";
import { generateRoundRobin, scheduleMatchdays } from "@/lib/fixtures";
import {
  MAX_ROSTER_SIZE,
  MAX_PLAYERS_PER_POSITION,
  PLAYER_POSITIONS,
  LINEUP_SIZE,
  type ActionResult,
  type LineupMode,
  type TournamentState,
} from "@/types/domain";

// Antes esto era una lista de nombres públicos ("santiago", "zenits" — el
// nombre del DT y el equipo de Zenit's, ambos a la vista de cualquiera en
// la propia web) contra la que se comparaba el texto que el usuario
// tipeaba en el login. Cualquiera de los 12 amigos podía escribir "zenits"
// y ser admin de todo el sitio. Ahora hace falta una CLAVE de verdad,
// guardada solo en el servidor (env var `SITE_ADMIN_KEY`, nunca se manda al
// cliente) — no un nombre adivinable. El parámetro sigue llamándose
// `adminName` en las ~20 Server Actions de este archivo para no tener que
// tocar cada una de sus firmas/usos, pero en los hechos ahora es esa clave.
function assertAdmin(adminName: string) {
  const expected = process.env.SITE_ADMIN_KEY;
  if (!expected || adminName !== expected) {
    throw new Error("No tenés permisos de administrador para hacer esto.");
  }
}

// Helpers para las acciones nuevas de esta sección: devuelven { success,
// message } en vez de tirar un `throw` (ver el comentario largo al
// respecto en src/lib/admin-cms-actions.ts) para no perder el mensaje real
// por la redacción de producción de Next.js.
function fail(message: string): { success: false; message: string } {
  return { success: false, message };
}

const ok: ActionResult = { success: true };

/**
 * Verifica la clave de administrador contra el servidor sin tocar la base:
 * la usa el login del sitio (`src/lib/app-store.tsx`/`admin-login.tsx`)
 * antes de guardar la clave en localStorage y prender el modo admin.
 */
export async function verifyAdminAccessAction(secret: string): Promise<ActionResult> {
  try {
    assertAdmin(secret);
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Clave incorrecta.");
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
 * Elimina por completo el torneo activo (fases, calendario, resultados) de
 * la base. Los EQUIPOS (y sus jugadores/disponibilidad) NO se borran acá a
 * propósito: quedan huérfanos (su tournamentId apunta a un torneo que ya no
 * existe) pero siguen en la base, así "Usar plantilla actual" en el
 * asistente de creación siempre tiene con qué trabajar (ver
 * `getLastTeamRoster` en src/lib/data.ts), incluso si no queda ningún
 * torneo activo. Si querés borrar un equipo de verdad, es un CRUD aparte
 * (no existe todavía).
 *
 * Si queda algún torneo archivado (de una creación anterior), el más
 * reciente pasa a ser el activo; si no queda ninguno, la app vuelve al
 * estado "sin torneo" (pero con los equipos intactos para reusar).
 */
export async function deleteTournamentAction(adminName: string): Promise<void> {
  assertAdmin(adminName);

  const state = await getActiveTournamentState();
  if (!state) throw new Error("No hay torneo activo para eliminar.");

  const stageIds = state.stages.map((s) => s.id);

  // Orden explícito para no depender de la emulación de cascade de Mongo:
  // primero lo que referencia stages, después los stages, al final el torneo.
  await prisma.match.deleteMany({ where: { stageId: { in: stageIds } } });
  await prisma.stageParticipant.deleteMany({ where: { stageId: { in: stageIds } } });
  await prisma.stageAggregation.deleteMany({
    where: { OR: [{ parentStageId: { in: stageIds } }, { childStageId: { in: stageIds } }] },
  });
  await prisma.matchday.deleteMany({ where: { stageId: { in: stageIds } } });
  await prisma.competitionStage.deleteMany({ where: { id: { in: stageIds } } });
  await prisma.season.deleteMany({ where: { tournamentId: state.tournament.id } });
  await prisma.tournament.delete({ where: { id: state.tournament.id } });

  const nextActive = await prisma.tournament.findFirst({ orderBy: { createdAt: "desc" } });
  if (nextActive) {
    await prisma.tournament.update({ where: { id: nextActive.id }, data: { isActive: true } });
  }

  revalidatePath("/", "layout");
}

/**
 * Cambia el nombre visible del torneo activo. El slug (usado en las URLs)
 * no se toca, así los links existentes siguen funcionando.
 */
export async function updateTournamentNameAction(adminName: string, tournamentId: string, name: string): Promise<void> {
  assertAdmin(adminName);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede quedar vacío.");

  await prisma.tournament.update({ where: { id: tournamentId }, data: { name: trimmed } });
  revalidatePath("/", "layout");
}

/** Actualiza el reglamento (texto libre) que se muestra en la pestaña "Reglas". */
export async function updateTournamentRulesAction(
  adminName: string,
  tournamentId: string,
  rules: string,
): Promise<ActionResult> {
  try {
    assertAdmin(adminName);
    const trimmed = rules.trim();
    if (trimmed.length > 5000) return fail("El reglamento es demasiado largo (máximo 5000 caracteres).");

    await prisma.tournament.update({ where: { id: tournamentId }, data: { rules: trimmed || null } });
    revalidatePath("/", "layout");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo guardar el reglamento.");
  }
}

// ============================================================
// CALENDARIO DEL CLAUSURA (generado a mano, no al crear el torneo)
// ============================================================

export type GenerateClausuraOutcome =
  | { success: true; conflictsCount: number; warnings: string[] }
  | { success: false; message: string };

/**
 * Genera el calendario del Clausura a partir de la fecha de inicio que
 * elige el admin, reusando la plantilla semanal y el formato (ida/vuelta)
 * que se guardaron al crear el torneo (`Tournament.weeklySlots`/`doubleRound`
 * — ver persist-tournament.ts). Solo funciona si la fase todavía no tiene
 * partidos generados.
 */
export async function generateClausuraCalendarAction(
  adminName: string,
  stageId: string,
  seasonStart: string,
): Promise<GenerateClausuraOutcome> {
  try {
    assertAdmin(adminName);

    const state = await getActiveTournamentState();
    if (!state) return fail("No hay torneo activo.");

    const stage = state.stages.find((s) => s.id === stageId);
    if (!stage || stage.type !== "CLAUSURA") return fail("Esa fase no es del Clausura.");

    const existing = await prisma.match.count({ where: { stageId } });
    if (existing > 0) return fail("El Clausura ya tiene un calendario generado.");

    const start = new Date(seasonStart);
    if (Number.isNaN(start.getTime())) return fail("Fecha inválida.");

    const tournament = await prisma.tournament.findUnique({ where: { id: state.tournament.id } });
    if (!tournament || tournament.weeklySlots.length === 0) {
      return fail("Este torneo no tiene una plantilla semanal guardada; no se puede generar el calendario automáticamente.");
    }

    const teamIds = state.teams.map((t) => t.id);
    const fixture = generateRoundRobin(teamIds, { doubleRound: tournament.doubleRound });
    const { scheduled, conflicts, warnings } = scheduleMatchdays(fixture, {
      seasonStart: start,
      weeklySlots: tournament.weeklySlots.map((s) => ({ day: s.day, matchesPerDay: s.matchesPerDay })),
      availability: state.teamAvailability,
    });

    await prisma.match.createMany({
      data: scheduled.map((m) => ({
        stageId,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        scheduledAt: m.scheduledAt,
        dayOfWeek: m.dayOfWeek,
        round: `Jornada ${m.round}`,
        status: "SCHEDULED",
        isMandatorySundayMatch: m.isMandatorySundayMatch,
      })),
    });

    await prisma.stageParticipant.createMany({
      data: teamIds.map((teamId) => ({ stageId, teamId })),
    });

    await prisma.competitionStage.update({ where: { id: stageId }, data: { status: "SCHEDULED", startDate: start } });

    revalidatePath("/", "layout");
    return { success: true, conflictsCount: conflicts.length, warnings };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo generar el calendario del Clausura.");
  }
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
  const { tournamentSlug } = await persistTournamentState(state, {
    isActive: true,
    weeklySlots: input.weeklySlots,
    doubleRound: input.doubleRound,
  });

  revalidatePath("/", "layout");

  return { tournamentSlug, conflicts, warnings };
}

// ============================================================
// LOGIN DE EQUIPO (PIN de 3 dígitos)
// ============================================================

export interface TeamSession {
  teamId: string;
  teamName: string;
}

/**
 * Primera vez que un equipo/DT entra: elige su equipo y define su PIN.
 * Solo funciona si el equipo todavía no tiene uno configurado —evita que
 * alguien le "robe" el login a otro equipo pisándole el PIN—; para
 * cambiarlo una vez creado hace falta pedirle al admin que lo resetee
 * directo en la base (no hay flujo de "olvidé mi PIN" todavía).
 */
export async function setTeamPinAction(teamId: string, pin: string): Promise<TeamSession> {
  if (!isValidPin(pin)) throw new Error("El PIN tiene que ser de exactamente 3 números.");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Ese equipo no existe.");
  if (team.pinHash !== null) throw new Error("Este equipo ya tiene un PIN configurado.");

  await prisma.team.update({ where: { id: teamId }, data: { pinHash: hashPin(pin) } });
  revalidatePath("/", "layout");

  return { teamId: team.id, teamName: team.name };
}

export async function loginTeamAction(teamId: string, pin: string): Promise<TeamSession> {
  if (!isValidPin(pin)) throw new Error("El PIN tiene que ser de exactamente 3 números.");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Ese equipo no existe.");
  if (team.pinHash === null) throw new Error("Este equipo todavía no configuró su PIN.");
  if (!verifyPin(pin, team.pinHash)) throw new Error("PIN incorrecto.");

  return { teamId: team.id, teamName: team.name };
}

// ============================================================
// AJUSTE MANUAL DE PUNTOS
// ============================================================

/**
 * Suma (o resta, con delta negativo) puntos a mano al equipo dentro de una
 * fase concreta. Es acumulativo: cada llamada incrementa el ajuste actual,
 * no lo reemplaza.
 */
export async function adjustStagePointsAction(
  adminName: string,
  stageId: string,
  teamId: string,
  delta: number,
): Promise<void> {
  assertAdmin(adminName);
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("El ajuste tiene que ser un número entero distinto de cero.");
  }

  await prisma.stageParticipant.update({
    where: { stageId_teamId: { stageId, teamId } },
    data: { pointsAdjustment: { increment: delta } },
  });

  revalidatePath("/", "layout");
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
  if (input.position && !(PLAYER_POSITIONS as readonly string[]).includes(input.position)) {
    throw new Error("Posición inválida.");
  }
}

/**
 * Tope de plantel (MAX_ROSTER_SIZE) y de jugadores por posición
 * (MAX_PLAYERS_PER_POSITION, ver src/types/domain.ts): 2 porteros, 2
 * defensas, 2 mediocampistas, 2 delanteros como máximo. `excludePlayerId` se
 * usa al editar, para no contarse a sí mismo contra el tope.
 */
async function assertRosterCapacity(teamId: string, position: string | undefined, excludePlayerId?: string): Promise<void> {
  const teammates = await prisma.player.findMany({
    where: { teamId, ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}) },
  });

  if (!excludePlayerId && teammates.length >= MAX_ROSTER_SIZE) {
    throw new Error(`El plantel ya tiene el máximo de ${MAX_ROSTER_SIZE} jugadores.`);
  }
  if (position) {
    const sameCount = teammates.filter((p) => p.position === position).length;
    if (sameCount >= MAX_PLAYERS_PER_POSITION) {
      throw new Error(`Ya hay ${MAX_PLAYERS_PER_POSITION} jugadores anotados como ${position}.`);
    }
  }
}

/**
 * Sin `assertAdmin` a propósito: cada equipo administra su propia
 * plantilla (mismo criterio que `setTeamLineupAction` para las
 * alineaciones) — el admin también puede, pero no hace falta. La UI
 * (`TeamRoster`) ya gatea la edición a `isAdmin || session?.teamId === teamId`.
 */
export async function createPlayerAction(teamId: string, input: PlayerInput): Promise<void> {
  assertValidPlayerInput(input);
  await assertRosterCapacity(teamId, input.position?.trim() || undefined);

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

export async function updatePlayerAction(playerId: string, input: PlayerInput): Promise<void> {
  assertValidPlayerInput(input);

  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing) throw new Error("Jugador no encontrado.");
  await assertRosterCapacity(existing.teamId, input.position?.trim() || undefined, playerId);

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

export async function deletePlayerAction(playerId: string): Promise<void> {
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

// data URL de una imagen (ej: "data:image/jpeg;base64,...") comprimida del
// lado del cliente antes de mandarla; ~6MB en base64 ya es una foto grande
// de sobra para este uso, así que se usa como tope defensivo.
const MAX_PROOF_DATA_URL_LENGTH = 6_000_000;

/**
 * Sube (o reemplaza) la foto de comprobante de un partido. No cierra el
 * partido por sí sola: eso lo hace `finishMatchAction`, que exige que ya
 * haya un comprobante cargado.
 */
export async function uploadMatchProofAction(adminName: string, matchId: string, proofImageData: string): Promise<void> {
  assertAdmin(adminName);
  if (!proofImageData.startsWith("data:image/")) {
    throw new Error("El comprobante tiene que ser una imagen.");
  }
  if (proofImageData.length > MAX_PROOF_DATA_URL_LENGTH) {
    throw new Error("La imagen es muy pesada; probá con una más chica.");
  }

  await prisma.match.update({ where: { id: matchId }, data: { proofImageData } });
  revalidatePath("/", "layout");
}

/**
 * Cierra el acta: fija el marcador/tarjetas final y pasa el partido a
 * PLAYED. Exige que ya haya un comprobante de foto cargado (ver
 * `uploadMatchProofAction`); si no, no se puede cerrar —salvo que sea un
 * forfeit, para eso está `markForfeitAction`, que no pide comprobante.
 * La tabla de posiciones se recalcula sola en el próximo render
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
  if (!match.proofImageData) {
    throw new Error("Subí una foto de comprobante del resultado antes de cerrar el partido.");
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { ...input, status: "PLAYED" },
  });

  revalidatePath("/", "layout");
}

/**
 * Cierra un partido como forfeit (incomparecencia): no hace falta
 * comprobante porque no se jugó. El equipo ganador se anota la victoria
 * (marcador por default 3-0, configurable) y el resultado cuenta para la
 * tabla igual que un partido jugado (WALKOVER ya lo hace `computeStandings`).
 */
export async function markForfeitAction(
  adminName: string,
  matchId: string,
  winnerTeamId: string,
  winnerScore = 3,
  loserScore = 0,
): Promise<void> {
  assertAdmin(adminName);
  if (!Number.isInteger(winnerScore) || !Number.isInteger(loserScore) || winnerScore < 0 || loserScore < 0) {
    throw new Error("El marcador del forfeit debe ser un número entero no negativo.");
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("El partido no existe.");
  if (match.status === "PLAYED") throw new Error("Este partido ya está cerrado como jugado.");
  if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
    throw new Error("El equipo ganador tiene que ser uno de los dos que juegan este partido.");
  }

  const isHomeWinner = winnerTeamId === match.homeTeamId;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: isHomeWinner ? winnerScore : loserScore,
      awayScore: isHomeWinner ? loserScore : winnerScore,
      status: "WALKOVER",
      isForfeit: true,
    },
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

// ============================================================
// PLAYOFFS (top-8 eliminación directa sobre la Tabla General:
// Cuartos de Final -> Semifinal -> Final)
// ============================================================

/** Tabla General actual (misma lógica que usa la página del torneo). */
function generalStandingsRows(state: TournamentState) {
  const generalStage = state.stages.find((s) => s.type === "GENERAL");
  const teamIds = state.teams.map((t) => t.id);
  const adjustmentsForStage = (stageId: string) =>
    Object.fromEntries(
      state.stageParticipants.filter((p) => p.stageId === stageId).map((p) => [p.teamId, p.pointsAdjustment]),
    );

  return generalStage
    ? mergeStandings(
        (generalStage.aggregatesFrom ?? []).map((childId) => {
          const child = state.stages.find((s) => s.id === childId);
          return computeStandings(teamIds, state.matchesByStage[childId] ?? [], child?.points, 5, adjustmentsForStage(childId));
        }),
      )
    : computeStandings(teamIds, Object.values(state.matchesByStage).flat());
}

/** Siembra estándar de bracket de 8: evita que el 1° y el 2° se crucen antes de la final. */
function quarterfinalPairs(rows: { teamId: string }[]): [string, string][] {
  const [s1, s2, s3, s4, s5, s6, s7, s8] = rows.map((r) => r.teamId);
  return [
    [s1, s8],
    [s4, s5],
    [s2, s7],
    [s3, s6],
  ];
}

function resolveWinner(match: { homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null }): string {
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  if (home === away) {
    throw new Error("Un partido de playoffs quedó empatado; corregí el resultado antes de avanzar de ronda.");
  }
  return home > away ? match.homeTeamId : match.awayTeamId;
}

/**
 * Genera los Cuartos de Final de la fase Playoffs a partir de la Tabla
 * General actual (1° vs 8°, 4° vs 5°, 2° vs 7°, 3° vs 6°). Se genera a mano
 * (no al crear el torneo) porque los rivales dependen de cómo termine la
 * liga. Solo funciona si la fase todavía no tiene partidos generados.
 */
export async function generatePlayoffsAction(adminName: string, stageId: string): Promise<void> {
  assertAdmin(adminName);

  const state = await getActiveTournamentState();
  if (!state) throw new Error("No hay torneo activo.");

  const stage = state.stages.find((s) => s.id === stageId);
  if (!stage || stage.type !== "PLAYOFFS") throw new Error("Esa fase no es de Playoffs.");

  const existing = await prisma.match.count({ where: { stageId } });
  if (existing > 0) throw new Error("Esta fase ya tiene partidos generados.");

  const rows = generalStandingsRows(state);
  if (rows.length < 8) throw new Error("Hacen falta al menos 8 equipos en la tabla para generar playoffs.");

  const now = new Date();
  await prisma.match.createMany({
    data: quarterfinalPairs(rows).map(([homeTeamId, awayTeamId]) => ({
      stageId,
      homeTeamId,
      awayTeamId,
      round: "Cuartos de Final",
      status: "SCHEDULED",
      scheduledAt: now,
    })),
  });

  await prisma.competitionStage.update({ where: { id: stageId }, data: { status: "SCHEDULED" } });

  revalidatePath("/", "layout");
}

/**
 * Genera las semifinales una vez que los 4 Cuartos de Final están cerrados.
 * Reconstruye qué partido guardado corresponde a cada cruce de la siembra
 * (1v8, 4v5, 2v7, 3v6) comparando equipos en vez de depender del orden de
 * inserción en Mongo (no garantizado), y arma: ganador(1v8) vs ganador(4v5),
 * ganador(2v7) vs ganador(3v6) — así el 1° y el 2° sembrados no se cruzan
 * antes de la final.
 */
export async function generatePlayoffsSemifinalsAction(adminName: string, stageId: string): Promise<void> {
  assertAdmin(adminName);

  const state = await getActiveTournamentState();
  if (!state) throw new Error("No hay torneo activo.");

  const stage = state.stages.find((s) => s.id === stageId);
  if (!stage || stage.type !== "PLAYOFFS") throw new Error("Esa fase no es de Playoffs.");

  const quarterfinals = await prisma.match.findMany({ where: { stageId, round: "Cuartos de Final" } });
  if (quarterfinals.length !== 4) throw new Error("Todavía no se generaron los cuatro Cuartos de Final.");

  const unfinished = quarterfinals.filter((m) => m.status !== "PLAYED" && m.status !== "WALKOVER");
  if (unfinished.length > 0) throw new Error("Faltan cerrar resultados de Cuartos de Final.");

  const alreadyHasSemis = await prisma.match.count({ where: { stageId, round: "Semifinal" } });
  if (alreadyHasSemis > 0) throw new Error("Las semifinales ya están generadas.");

  const rows = generalStandingsRows(state);
  if (rows.length < 8) throw new Error("Hacen falta al menos 8 equipos en la tabla para generar playoffs.");

  const pairs = quarterfinalPairs(rows);
  const findMatch = (pair: [string, string]) => {
    const pairSet = new Set(pair);
    const match = quarterfinals.find(
      (m) => pairSet.has(m.homeTeamId) && pairSet.has(m.awayTeamId) && m.homeTeamId !== m.awayTeamId,
    );
    if (!match) throw new Error("No se pudo reconstruir el cruce de Cuartos de Final; revisá los resultados cargados.");
    return match;
  };

  const winners = pairs.map((pair) => resolveWinner(findMatch(pair)));
  const now = new Date();

  await prisma.match.createMany({
    data: [
      { stageId, homeTeamId: winners[0], awayTeamId: winners[1], round: "Semifinal", status: "SCHEDULED", scheduledAt: now },
      { stageId, homeTeamId: winners[2], awayTeamId: winners[3], round: "Semifinal", status: "SCHEDULED", scheduledAt: now },
    ],
  });

  revalidatePath("/", "layout");
}

/**
 * Genera la final una vez que las dos semifinales están cerradas: toma al
 * ganador de cada una. Si algo empató en el marcador (no debería en un mata-mata),
 * tira error pidiendo que se cargue un resultado con ganador claro.
 */
export async function generatePlayoffsFinalAction(adminName: string, stageId: string): Promise<void> {
  assertAdmin(adminName);

  const semifinals = await prisma.match.findMany({ where: { stageId, round: "Semifinal" } });
  if (semifinals.length !== 2) throw new Error("Todavía no se generaron las dos semifinales.");

  const unfinished = semifinals.filter((m) => m.status !== "PLAYED" && m.status !== "WALKOVER");
  if (unfinished.length > 0) throw new Error("Faltan cerrar resultados de semifinal.");

  const alreadyHasFinal = await prisma.match.count({ where: { stageId, round: "Final" } });
  if (alreadyHasFinal > 0) throw new Error("La final ya está generada.");

  const winners = semifinals.map((m) => resolveWinner(m));

  await prisma.match.create({
    data: {
      stageId,
      homeTeamId: winners[0],
      awayTeamId: winners[1],
      round: "Final",
      status: "SCHEDULED",
      scheduledAt: new Date(),
    },
  });

  revalidatePath("/", "layout");
}

// ============================================================
// ALINEACIONES ("fútbol de plato": modo PASIVO con arquero / ACTIVO sin
// arquero). Cada fase se marca con un modo; cada equipo tiene una
// alineación titular fija por modo, editable en cualquier momento desde su
// perfil (no se rearma partido a partido).
// ============================================================

export async function setStageLineupModeAction(
  adminName: string,
  stageId: string,
  mode: LineupMode | null,
): Promise<void> {
  assertAdmin(adminName);
  await prisma.competitionStage.update({ where: { id: stageId }, data: { lineupMode: mode } });
  revalidatePath("/", "layout");
}

function assertLineupComposition(mode: LineupMode, players: { position: string | null }[]): string | null {
  const expectedSize = LINEUP_SIZE[mode];
  if (players.length !== expectedSize) {
    return `El modo ${mode === "PASIVO" ? "pasivo" : "activo"} necesita exactamente ${expectedSize} jugadores.`;
  }

  const goalkeepers = players.filter((p) => p.position === "Portero").length;
  if (mode === "PASIVO") {
    if (goalkeepers !== 1) return "El modo pasivo necesita exactamente 1 arquero en la alineación.";
  } else {
    if (goalkeepers !== 0) return "El modo activo no lleva arquero.";
    const defenders = players.filter((p) => p.position === "Defensa").length;
    if (defenders < 1) return "El modo activo necesita al menos 1 defensa (ocupa el lugar del arquero).";
  }
  return null;
}

/**
 * Guarda la alineación titular fija de un equipo para un modo. Reemplaza
 * por completo la lista anterior de ese modo (no es incremental).
 */
export async function setTeamLineupAction(
  teamId: string,
  mode: LineupMode,
  playerIds: string[],
): Promise<ActionResult> {
  try {
    const uniqueIds = [...new Set(playerIds)];
    if (uniqueIds.length !== playerIds.length) {
      return { success: false, message: "Un jugador no puede estar dos veces en la misma alineación." };
    }

    const players = await prisma.player.findMany({ where: { id: { in: uniqueIds }, teamId } });
    if (players.length !== uniqueIds.length) {
      return { success: false, message: "Alguno de los jugadores seleccionados no pertenece a este equipo." };
    }

    const compositionError = assertLineupComposition(mode, players);
    if (compositionError) return { success: false, message: compositionError };

    await prisma.teamLineup.upsert({
      where: { teamId_mode: { teamId, mode } },
      create: { teamId, mode, playerIds: uniqueIds },
      update: { playerIds: uniqueIds },
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "No se pudo guardar la alineación." };
  }
}

// ============================================================
// PALMARÉS: títulos históricos por equipo. Ver comentario largo sobre
// teamSlug/teamName (en vez de una relación a Team) en prisma/schema.prisma.
// ============================================================

export async function addChampionAction(
  adminName: string,
  input: { teamSlug: string; teamName: string; year: number; title: string },
): Promise<ActionResult> {
  try {
    assertAdmin(adminName);
    if (!input.teamSlug || !input.teamName.trim()) return fail("Elegí un equipo.");
    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) return fail("Año inválido.");
    const title = input.title.trim();
    if (!title) return fail("Poné un título (ej: Apertura, Clausura, Supercopa, Playoffs).");
    if (title.length > 60) return fail("El título es demasiado largo (máximo 60 caracteres).");

    await prisma.champion.create({
      data: { teamSlug: input.teamSlug, teamName: input.teamName.trim(), year: input.year, title },
    });
    revalidatePath("/", "layout");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo guardar el título.");
  }
}

export async function deleteChampionAction(adminName: string, id: string): Promise<ActionResult> {
  try {
    assertAdmin(adminName);
    await prisma.champion.delete({ where: { id } });
    revalidatePath("/", "layout");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo eliminar el título.");
  }
}
