"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPin, isValidPin, verifyPin } from "@/lib/pin";
import { getActiveTournamentState } from "@/lib/data";
import { persistTournamentState } from "@/lib/persist-tournament";
import { createTournamentState, type CreateTournamentInput, type CreateTournamentConflict } from "@/lib/tournament-factory";
import { computeStandings, mergeStandings } from "@/lib/standings";

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
// PLAYOFFS (top-4 eliminación directa sobre la Tabla General)
// ============================================================

/**
 * Genera las semifinales de la fase Playoffs a partir de la Tabla General
 * actual (1° vs 4°, 2° vs 3°). Se genera a mano (no al crear el torneo)
 * porque los rivales dependen de cómo termine la liga. Solo funciona si la
 * fase todavía no tiene partidos generados.
 */
export async function generatePlayoffsAction(adminName: string, stageId: string): Promise<void> {
  assertAdmin(adminName);

  const state = await getActiveTournamentState();
  if (!state) throw new Error("No hay torneo activo.");

  const stage = state.stages.find((s) => s.id === stageId);
  if (!stage || stage.type !== "PLAYOFFS") throw new Error("Esa fase no es de Playoffs.");

  const existing = await prisma.match.count({ where: { stageId } });
  if (existing > 0) throw new Error("Esta fase ya tiene partidos generados.");

  const generalStage = state.stages.find((s) => s.type === "GENERAL");
  const teamIds = state.teams.map((t) => t.id);
  const rows = generalStage
    ? mergeStandings(
        (generalStage.aggregatesFrom ?? []).map((childId) => {
          const child = state.stages.find((s) => s.id === childId);
          return computeStandings(teamIds, state.matchesByStage[childId] ?? [], child?.points);
        }),
      )
    : computeStandings(teamIds, Object.values(state.matchesByStage).flat());

  if (rows.length < 4) throw new Error("Hacen falta al menos 4 equipos en la tabla para generar playoffs.");

  const [first, second, third, fourth] = rows;
  const now = new Date();

  await prisma.match.createMany({
    data: [
      {
        stageId,
        homeTeamId: first.teamId,
        awayTeamId: fourth.teamId,
        round: "Semifinal",
        status: "SCHEDULED",
        scheduledAt: now,
      },
      {
        stageId,
        homeTeamId: second.teamId,
        awayTeamId: third.teamId,
        round: "Semifinal",
        status: "SCHEDULED",
        scheduledAt: now,
      },
    ],
  });

  await prisma.competitionStage.update({ where: { id: stageId }, data: { status: "SCHEDULED" } });

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

  const winners = semifinals.map((m) => {
    const home = m.homeScore ?? 0;
    const away = m.awayScore ?? 0;
    if (home === away) throw new Error("Una semifinal quedó empatada; corregí el resultado antes de generar la final.");
    return home > away ? m.homeTeamId : m.awayTeamId;
  });

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
