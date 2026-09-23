import { generateRoundRobin, scheduleMatchdays } from "@/lib/fixtures";
import type {
  CompetitionStage,
  Match,
  Team,
  TeamAvailability,
  Tournament,
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
  { id: "team_tigres", tournamentId: tournament.id, name: "Los Tigres FC", shortName: "TIG", slug: "los-tigres-fc", managerName: "Carlos Ramírez", primaryColor: "#f59e0b" },
  { id: "team_atletico", tournamentId: tournament.id, name: "Atlético Barrio", shortName: "ATB", slug: "atletico-barrio", managerName: "Marcos Díaz", primaryColor: "#3b82f6" },
  { id: "team_real", tournamentId: tournament.id, name: "Real Amigos", shortName: "REA", slug: "real-amigos", managerName: "Diego Torres", primaryColor: "#ef4444" },
  { id: "team_junco", tournamentId: tournament.id, name: "Deportivo Junco", shortName: "JUN", slug: "deportivo-junco", managerName: "Santiago Campos", primaryColor: "#22c55e" },
  { id: "team_vecinos", tournamentId: tournament.id, name: "FC Vecinos", shortName: "VEC", slug: "fc-vecinos", managerName: "Andrés López", primaryColor: "#a855f7" },
  { id: "team_unidos", tournamentId: tournament.id, name: "Unidos SC", shortName: "UNI", slug: "unidos-sc", managerName: "Pablo Herrera", primaryColor: "#06b6d4" },
];

export const teamAvailability: TeamAvailability[] = [
  { teamId: "team_junco", tournamentId: tournament.id, allowedDays: ["THURSDAY", "SUNDAY"], notes: "Solo puede jugar jueves o domingo." },
  { teamId: "team_vecinos", tournamentId: tournament.id, allowedDays: ["SUNDAY", "MONDAY"], notes: "No disponible los jueves." },
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
  const scheduled = scheduleMatchdays(fixture, {
    seasonStart,
    candidateDays: ["THURSDAY", "SUNDAY", "MONDAY"],
    availability: teamAvailability,
  });

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
  stage_apertura: buildStageMatches("stage_apertura", 6, new Date("2026-03-05")), // jueves
  stage_clausura: buildStageMatches("stage_clausura", 0, new Date("2026-08-06")), // jueves, tras el receso
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
