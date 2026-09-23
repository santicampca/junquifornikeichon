import { generateRoundRobin, scheduleMatchdays, type WeeklySlot } from "@/lib/fixtures";
import type {
  CompetitionStage,
  Match,
  Team,
  TeamAvailability,
  Tournament,
  TournamentState,
} from "@/types/domain";

/**
 * Datos de demostración para poder navegar la plataforma sin una base de
 * datos conectada. La forma de estos datos es intencionalmente compatible
 * con lo que devolvería Prisma, para que reemplazarlos por consultas reales
 * (ver src/lib/prisma.ts) sea un cambio acotado a esta capa.
 */

// PRNG determinista (mulberry32) para que los resultados de demo sean
// siempre los mismos entre renders, sin depender de Math.random().
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260926);
const randomGoals = () => Math.floor(rng() * 4);

export const tournament: Tournament = {
  id: "trn_liga_amigos",
  name: "Liga de Amigos JMC",
  slug: "liga-de-amigos",
  description: "Torneo amateur entre amigos, con fases Apertura, Clausura y Supercopa.",
};

export const teams: Team[] = [
  { id: "team_zenits", tournamentId: tournament.id, name: "Zenit's", shortName: "ZEN", slug: "zenits", managerName: "Santiago", primaryColor: "#f59e0b" },
  { id: "team_snorlax", tournamentId: tournament.id, name: "Snorlax FC", shortName: "SNO", slug: "snorlax-fc", managerName: "Yenderson", primaryColor: "#3b82f6" },
  { id: "team_tipetiripe", tournamentId: tournament.id, name: "C.F Tipetiripe", shortName: "TIP", slug: "cf-tipetiripe", managerName: "Isaac", primaryColor: "#ef4444" },
  { id: "team_europollas", tournamentId: tournament.id, name: "UD Europollas", shortName: "EUR", slug: "ud-europollas", managerName: "Diego", primaryColor: "#a855f7" },
  { id: "team_conocolo", tournamentId: tournament.id, name: "Coño colo juniors", shortName: "CCJ", slug: "cono-colo-juniors", managerName: "Yojhan", primaryColor: "#ec4899" },
  { id: "team_lacota", tournamentId: tournament.id, name: "UD La cota 1000", shortName: "UDL", slug: "ud-la-cota-1000", managerName: "Miguel", primaryColor: "#06b6d4" },
  { id: "team_respeta", tournamentId: tournament.id, name: "Respeta la justicia pape", shortName: "RJP", slug: "respeta-la-justicia-pape", managerName: "Argenis", primaryColor: "#eab308" },
  { id: "team_vehement", tournamentId: tournament.id, name: "Vehement", shortName: "VEH", slug: "vehement", managerName: "Nicko", primaryColor: "#14b8a6" },
  { id: "team_teparto", tournamentId: tournament.id, name: "Te parto el Culo Efe c", shortName: "TPC", slug: "te-parto-el-culo-efe-c", managerName: "Angel", primaryColor: "#f97316" },
  { id: "team_alvos", tournamentId: tournament.id, name: "©aªlVos Fc", shortName: "ALV", slug: "alvos-fc", managerName: "Luis", primaryColor: "#8b5cf6" },
  { id: "team_alianza", tournamentId: tournament.id, name: "Alianza lima", shortName: "ALI", slug: "alianza-lima", managerName: "Javier", primaryColor: "#22c55e" },
  { id: "team_ak47", tournamentId: tournament.id, name: "ak memeten la 47", shortName: "AK4", slug: "ak-memeten-la-47", managerName: "Henry", primaryColor: "#84cc16" },
];

// Restricciones reales del torneo: cada equipo solo puede jugar los días
// que declara acá. El generador de fixtures (`scheduleMatchdays`) las
// respeta como restricción dura.
export const teamAvailability: TeamAvailability[] = [
  { teamId: "team_alianza", tournamentId: tournament.id, allowedDays: ["THURSDAY", "SUNDAY"], notes: "Solo puede jugar jueves o domingo." },
  { teamId: "team_europollas", tournamentId: tournament.id, allowedDays: ["SUNDAY", "MONDAY"], notes: "Solo puede jugar domingo o lunes." },
];

// Plantilla semanal de cada jornada: de jueves a lunes, con cupos por día.
const WEEKLY_SLOTS: WeeklySlot[] = [
  { day: "THURSDAY", matchesPerDay: 1 },
  { day: "FRIDAY", matchesPerDay: 1 },
  { day: "SATURDAY", matchesPerDay: 2 },
  { day: "SUNDAY", matchesPerDay: 1 },
  { day: "MONDAY", matchesPerDay: 1 },
];

export const stages: CompetitionStage[] = [
  {
    id: "stage_apertura",
    seasonId: "season_2026",
    name: "Torneo Apertura 2026",
    type: "APERTURA",
    format: "ROUND_ROBIN_DOUBLE",
    status: "IN_PROGRESS",
    points: { win: 3, draw: 1, loss: 0 },
  },
  {
    id: "stage_clausura",
    seasonId: "season_2026",
    name: "Torneo Clausura 2026",
    type: "CLAUSURA",
    format: "ROUND_ROBIN_DOUBLE",
    status: "SCHEDULED",
    points: { win: 3, draw: 1, loss: 0 },
  },
  {
    id: "stage_general",
    seasonId: "season_2026",
    name: "Tabla General 2026",
    type: "GENERAL",
    format: "ROUND_ROBIN_DOUBLE",
    status: "IN_PROGRESS",
    points: { win: 3, draw: 1, loss: 0 },
    aggregatesFrom: ["stage_apertura", "stage_clausura"],
  },
  {
    id: "stage_supercopa",
    seasonId: "season_2026",
    name: "Supercopa 2026",
    type: "SUPERCOPA",
    format: "DIRECT_MATCH",
    status: "DRAFT",
    points: { win: 3, draw: 1, loss: 0 },
  },
];

const teamIds = teams.map((t) => t.id);

function buildStageMatches(
  stageId: string,
  playThroughRound: number,
  seasonStart: Date,
): Match[] {
  const fixture = generateRoundRobin(teamIds, { doubleRound: true });
  const { scheduled, conflicts } = scheduleMatchdays(fixture, {
    seasonStart,
    weeklySlots: WEEKLY_SLOTS,
    availability: teamAvailability,
  });

  if (conflicts.length > 0) {
    // Con los datos de demo no debería pasar; si aparece, hay que revisar
    // la plantilla semanal o las restricciones de disponibilidad.
    console.warn(`[mock-data] ${stageId}: ${conflicts.length} partido(s) sin poder programar`, conflicts);
  }

  return scheduled.map((m, i) => {
    const isPlayed = m.round <= playThroughRound;
    return {
      id: `${stageId}_m${i + 1}`,
      stageId,
      matchdayId: `${stageId}_jornada_${m.round}`,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: isPlayed ? randomGoals() : null,
      awayScore: isPlayed ? randomGoals() : null,
      scheduledAt: m.scheduledAt.toISOString(),
      dayOfWeek: m.dayOfWeek,
      round: `Jornada ${m.round}`,
      status: isPlayed ? "PLAYED" : "SCHEDULED",
    };
  });
}

export const matchesByStage: Record<string, Match[]> = {
  stage_apertura: buildStageMatches("stage_apertura", 8, new Date("2026-03-05")), // jueves
  stage_clausura: buildStageMatches("stage_clausura", 0, new Date("2026-09-10")), // jueves, tras el receso (22 jornadas de por medio)
  stage_supercopa: [],
};
// La Tabla General no tiene partidos propios: agrega Apertura + Clausura.
matchesByStage.stage_general = [];

export function getStageById(id: string) {
  return stages.find((s) => s.id === id);
}

export function getTeamById(id: string) {
  return teams.find((t) => t.id === id);
}

/** Snapshot inicial que usa el store del cliente (`src/lib/app-store.tsx`) la primera vez que se abre la app. */
export const demoTournamentState: TournamentState = {
  tournament,
  teams,
  teamAvailability,
  stages,
  matchesByStage,
};
