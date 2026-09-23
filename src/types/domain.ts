/**
 * Tipos de dominio compartidos por la capa de UI y la lógica de negocio
 * (src/lib). Reflejan el modelo de datos de prisma/schema.prisma pero se
 * mantienen independientes del cliente de Prisma: src/lib/data.ts convierte
 * los resultados de Prisma a esta forma antes de pasarlos a los componentes.
 */

export type StageType = "APERTURA" | "CLAUSURA" | "SUPERCOPA" | "GENERAL" | "OTRO";

export type StageFormat =
  | "ROUND_ROBIN_SINGLE"
  | "ROUND_ROBIN_DOUBLE"
  | "GROUP_STAGE"
  | "KNOCKOUT"
  | "DIRECT_MATCH";

export type StageStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "FINISHED";

export type MatchStatus =
  | "SCHEDULED"
  | "PLAYED"
  | "POSTPONED"
  | "CANCELLED"
  | "WALKOVER";

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
}

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
  scheduledAt?: string; // ISO date
  dayOfWeek?: DayOfWeek;
  venue?: string;
  round?: string;
  status: MatchStatus;
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
}

export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  APERTURA: "Apertura",
  CLAUSURA: "Clausura",
  SUPERCOPA: "Supercopa",
  GENERAL: "Tabla General",
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
