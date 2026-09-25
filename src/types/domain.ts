/**
 * Tipos de dominio compartidos por la capa de UI y la lógica de negocio
 * (src/lib). Reflejan el modelo de datos de prisma/schema.prisma pero se
 * mantienen independientes del cliente de Prisma: src/lib/data.ts convierte
 * los resultados de Prisma a esta forma antes de pasarlos a los componentes.
 */

export type StageType = "APERTURA" | "CLAUSURA" | "SUPERCOPA" | "GENERAL" | "PLAYOFFS" | "OTRO";

export type StageFormat =
  | "ROUND_ROBIN_SINGLE"
  | "ROUND_ROBIN_DOUBLE"
  | "GROUP_STAGE"
  | "KNOCKOUT"
  | "DIRECT_MATCH";

export type StageStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "FINISHED";

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "PLAYED"
  | "POSTPONED"
  | "CANCELLED"
  | "WALKOVER";

/** Categoría de resultado para el banco de titulares (ver src/lib/headlines.ts). */
export type NewsCategory = "BLOWOUT" | "COMFORTABLE" | "NARROW" | "DRAW" | "FORFEIT";

export interface NewsPhrase {
  id: string;
  category: NewsCategory;
  template: string;
}

export interface NewsPhoto {
  id: string;
  imageData: string;
}

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
}

export interface Season {
  id: string;
  tournamentId: string;
  name: string;
  year: number;
  isCurrent: boolean;
}

export interface PointsConfig {
  win: number;
  draw: number;
  loss: number;
}

export interface CompetitionStage {
  id: string;
  seasonId: string;
  name: string;
  type: StageType;
  format: StageFormat;
  status: StageStatus;
  points: PointsConfig;
  /** Solo para fases GENERAL: ids de las fases cuyos puntos se suman. */
  aggregatesFrom?: string[];
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  shortName?: string;
  slug: string;
  logoUrl?: string;
  managerName: string;
  primaryColor?: string;
  foundedYear?: number;
  /** True si ya configuró su PIN de 3 dígitos (login de equipo). Nunca se expone el hash al cliente. */
  hasPin: boolean;
}

/** Inscripción de un equipo en una fase; acá vive el ajuste manual de puntos. */
export interface StageParticipant {
  stageId: string;
  teamId: string;
  pointsAdjustment: number;
}

/** Posiciones válidas de jugador; ver MAX_ROSTER_SIZE/MAX_PLAYERS_PER_POSITION. */
export const PLAYER_POSITIONS = ["Portero", "Defensa", "Mediocampista", "Delantero"] as const;
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

/** Tamaño de plantel por equipo: entre 5 y 8 jugadores, máximo 2 por posición. */
export const MIN_ROSTER_SIZE = 5;
export const MAX_ROSTER_SIZE = 8;
export const MAX_PLAYERS_PER_POSITION = 2;

export interface Player {
  id: string;
  teamId: string;
  name: string;
  number?: number;
  position?: string;
}

export interface TeamAvailability {
  teamId: string;
  tournamentId: string;
  allowedDays: DayOfWeek[];
  notes?: string;
}

export interface Matchday {
  id: string;
  stageId: string;
  number: number;
  label?: string;
}

export interface Match {
  id: string;
  stageId: string;
  matchdayId?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  scheduledAt?: string; // ISO date
  dayOfWeek?: DayOfWeek;
  venue?: string;
  round?: string;
  status: MatchStatus;
  /** Ver comentario del campo homónimo en prisma/schema.prisma. */
  isMandatorySundayMatch: boolean;
  /** Foto de comprobante como data URL (base64); requerida para cerrar PLAYED salvo forfeit. */
  proofImageData?: string;
  /** True si se cerró como forfeit (WALKOVER) en vez de con comprobante. */
  isForfeit: boolean;
}

/**
 * Snapshot completo de un torneo: lo que arma `createTournamentState`
 * (`src/lib/tournament-factory.ts`) en memoria y lo que devuelve
 * `getActiveTournamentState` (`src/lib/data.ts`) leyendo Mongo.
 */
export interface TournamentState {
  tournament: Tournament;
  teams: Team[];
  teamAvailability: TeamAvailability[];
  stages: CompetitionStage[];
  matchesByStage: Record<string, Match[]>;
  stageParticipants: StageParticipant[];
}

export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  APERTURA: "Apertura",
  CLAUSURA: "Clausura",
  SUPERCOPA: "Supercopa",
  GENERAL: "Tabla General",
  PLAYOFFS: "Playoffs",
  OTRO: "Otro",
};

export const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};
