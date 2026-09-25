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

/**
 * Categoría de resultado para el banco de titulares (ver src/lib/headlines.ts).
 * No hay categoría "ajustada" a propósito: el partido juega a 3 goles, así
 * que 3-2 (la única forma de que fuera "ajustado") no se da en la práctica
 * — cualquier victoria que no sea 3-0 cuenta como COMFORTABLE.
 */
export type NewsCategory = "BLOWOUT" | "COMFORTABLE" | "DRAW" | "FORFEIT";

export interface NewsPhrase {
  id: string;
  category: NewsCategory;
  template: string;
}

export interface NewsPhoto {
  id: string;
  imageData: string;
  /** Frase a la que está afiliada esta foto; undefined = pool general de reserva. */
  phraseId?: string;
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
  /** Reglamento en texto libre, editable por el admin. Ver src/lib/actions.ts. */
  rules?: string;
}

/**
 * Entrada de palmarés: un equipo campeón de una fase concreta en un año
 * concreto (ej: "Apertura" 2026). Identificado por slug/nombre (snapshot),
 * no por relación a un Team._id concreto: ver comentario en
 * prisma/schema.prisma sobre por qué (los equipos se recrean con cada
 * torneo nuevo).
 */
export interface Champion {
  id: string;
  teamSlug: string;
  teamName: string;
  year: number;
  title: string;
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
  /** Modo de alineación de la fase ("fútbol de plato"): ver LineupMode. */
  lineupMode?: LineupMode;
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
  /** Total de goles en la temporada (contador manual). Ver pestaña "Goleadores". */
  goals: number;
}

/** Fila de la pestaña "Goleadores": un jugador con su equipo, para no tener que unir por separado. */
export interface TopScorer {
  playerId: string;
  playerName: string;
  goals: number;
  teamSlug: string;
  teamName: string;
}

/** Canción subida por el admin para la pestaña "Playlist" (ver PlaylistTrack en prisma/schema.prisma). */
export interface PlaylistTrack {
  id: string;
  title: string;
  audioData: string;
  /** A lo sumo una canción tiene esto en true: es la que suena sola al entrar a un torneo. */
  isAnthem: boolean;
}

/**
 * Modo de alineación ("fútbol de plato"): PASIVO juega con arquero, ACTIVO
 * no tiene arquero (un defensa ocupa ese lugar). Cada fase del torneo se
 * marca con uno de los dos (ver CompetitionStage.lineupMode) y cada equipo
 * mantiene una alineación titular fija por modo (ver TeamLineup).
 */
export type LineupMode = "PASIVO" | "ACTIVO";

/** Cantidad de titulares por modo: PASIVO = arquero + 5, ACTIVO = 4 (sin arquero). */
export const LINEUP_SIZE: Record<LineupMode, number> = { PASIVO: 6, ACTIVO: 4 };

/**
 * Formas tácticas disponibles para el modo ACTIVO (4 titulares, sin
 * arquero): cada una define en qué punto de la cancha va cada uno de los 4
 * puestos, en el mismo orden que `TeamLineup.playerIds`. `y` va de 0 (arco
 * rival) a 100 (arco propio); `x` de 0 (izquierda) a 100 (derecha).
 */
export const ACTIVE_FORMATIONS = ["1-3", "1-2-1", "1-1-2", "3-1"] as const;
export type ActiveFormation = (typeof ACTIVE_FORMATIONS)[number];

export const FORMATION_SLOTS: Record<ActiveFormation, { x: number; y: number }[]> = {
  "1-3": [
    { x: 50, y: 78 },
    { x: 22, y: 38 },
    { x: 50, y: 28 },
    { x: 78, y: 38 },
  ],
  "1-2-1": [
    { x: 50, y: 78 },
    { x: 30, y: 52 },
    { x: 70, y: 52 },
    { x: 50, y: 24 },
  ],
  "1-1-2": [
    { x: 50, y: 78 },
    { x: 50, y: 55 },
    { x: 30, y: 26 },
    { x: 70, y: 26 },
  ],
  "3-1": [
    { x: 22, y: 62 },
    { x: 50, y: 58 },
    { x: 78, y: 62 },
    { x: 50, y: 22 },
  ],
};

/** Nombre corto de cada puesto (mismo orden que FORMATION_SLOTS), para los selectores del editor de alineación. */
export const FORMATION_SLOT_LABELS: Record<ActiveFormation, string[]> = {
  "1-3": ["Atrás", "Adelante izquierda", "Adelante centro", "Adelante derecha"],
  "1-2-1": ["Atrás", "Medio izquierda", "Medio derecha", "Adelante"],
  "1-1-2": ["Atrás", "Medio", "Adelante izquierda", "Adelante derecha"],
  "3-1": ["Atrás izquierda", "Atrás centro", "Atrás derecha", "Adelante"],
};

/**
 * Formas tácticas para el modo PASIVO (6 titulares: 1 arquero + 5 de
 * campo). El puesto 0 es siempre el arquero (ver PASSIVE_FORMATION_SLOTS);
 * el "1" inicial del nombre de cada formación lo representa.
 */
export const PASSIVE_FORMATIONS = ["1-3-2", "1-2-3", "1-4-1", "1-2-1-2"] as const;
export type PassiveFormation = (typeof PASSIVE_FORMATIONS)[number];

export const PASSIVE_FORMATION_SLOTS: Record<PassiveFormation, { x: number; y: number }[]> = {
  "1-3-2": [
    { x: 50, y: 88 },
    { x: 20, y: 70 },
    { x: 50, y: 72 },
    { x: 80, y: 70 },
    { x: 35, y: 30 },
    { x: 65, y: 30 },
  ],
  "1-2-3": [
    { x: 50, y: 88 },
    { x: 30, y: 70 },
    { x: 70, y: 70 },
    { x: 20, y: 30 },
    { x: 50, y: 26 },
    { x: 80, y: 30 },
  ],
  "1-4-1": [
    { x: 50, y: 88 },
    { x: 15, y: 68 },
    { x: 38, y: 70 },
    { x: 62, y: 70 },
    { x: 85, y: 68 },
    { x: 50, y: 26 },
  ],
  "1-2-1-2": [
    { x: 50, y: 88 },
    { x: 30, y: 72 },
    { x: 70, y: 72 },
    { x: 50, y: 50 },
    { x: 35, y: 26 },
    { x: 65, y: 26 },
  ],
};

/** Nombre corto de cada puesto (mismo orden que PASSIVE_FORMATION_SLOTS). El puesto 0 siempre es "Arquero". */
export const PASSIVE_FORMATION_SLOT_LABELS: Record<PassiveFormation, string[]> = {
  "1-3-2": ["Arquero", "Defensa izquierda", "Defensa centro", "Defensa derecha", "Adelante izquierda", "Adelante derecha"],
  "1-2-3": ["Arquero", "Defensa izquierda", "Defensa derecha", "Adelante izquierda", "Adelante centro", "Adelante derecha"],
  "1-4-1": ["Arquero", "Defensa izquierda", "Defensa centro-izquierda", "Defensa centro-derecha", "Defensa derecha", "Adelante"],
  "1-2-1-2": ["Arquero", "Defensa izquierda", "Defensa derecha", "Medio", "Adelante izquierda", "Adelante derecha"],
};

export interface TeamLineup {
  teamId: string;
  mode: LineupMode;
  playerIds: string[];
  /** Ver ACTIVE_FORMATIONS (modo ACTIVO) / PASSIVE_FORMATIONS (modo PASIVO). */
  formation?: ActiveFormation | PassiveFormation;
}

/** Resultado de una Server Action: nunca se redacta en producción (a diferencia de un `throw`). */
export type ActionResult = { success: true } | { success: false; message: string };

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

export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  BLOWOUT: "Goleada",
  COMFORTABLE: "Victoria cómoda",
  DRAW: "Empate",
  FORFEIT: "Walkover",
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
