import { generateRoundRobin, scheduleMatchdays, type SchedulingConflict, type WeeklySlot } from "@/lib/fixtures";
import { generateId, slugify } from "@/lib/utils";
import type {
  CompetitionStage,
  DayOfWeek,
  Match,
  Team,
  TeamAvailability,
  TournamentState,
} from "@/types/domain";

const DAY_INDEX: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** Adelanta `date` hasta la próxima ocurrencia (inclusive) de `day`. */
function alignToWeekday(date: Date, day: DayOfWeek): Date {
  const result = new Date(date);
  const diff = (DAY_INDEX[day] - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}

export interface NewTeamInput {
  name: string;
  managerName: string;
  primaryColor?: string;
  /** Días permitidos; vacío/undefined = sin restricción. */
  allowedDays?: DayOfWeek[];
}

export interface CreateTournamentInput {
  name: string;
  description?: string;
  teams: NewTeamInput[];
  doubleRound: boolean;
  weeklySlots: WeeklySlot[];
  /** Fecha (yyyy-mm-dd) desde la que arranca el Apertura; se ajusta al próximo día válido de `weeklySlots`. */
  seasonStart: string;
  /** Semanas de receso entre el fin del Apertura y el inicio del Clausura. */
  breakWeeksBetweenStages?: number;
  includeSupercopa?: boolean;
}

export interface CreateTournamentConflict extends SchedulingConflict {
  stageId: string;
  stageName: string;
}

export interface CreateTournamentResult {
  state: TournamentState;
  /** Partidos que el motor de calendario no pudo ubicar; requieren ajuste manual. */
  conflicts: CreateTournamentConflict[];
}

function buildStageFixture(
  stageId: string,
  stageName: string,
  teamIds: string[],
  input: Pick<CreateTournamentInput, "doubleRound" | "weeklySlots">,
  availability: TeamAvailability[],
  seasonStart: Date,
): { matches: Match[]; conflicts: CreateTournamentConflict[]; roundsCount: number } {
  const fixture = generateRoundRobin(teamIds, { doubleRound: input.doubleRound });
  const { scheduled, conflicts } = scheduleMatchdays(fixture, {
    seasonStart,
    weeklySlots: input.weeklySlots,
    availability,
  });

  const matches: Match[] = scheduled.map((m) => ({
    id: generateId("match"),
    stageId,
    matchdayId: `${stageId}_jornada_${m.round}`,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeScore: null,
    awayScore: null,
    scheduledAt: m.scheduledAt.toISOString(),
    dayOfWeek: m.dayOfWeek,
    round: `Jornada ${m.round}`,
    status: "SCHEDULED",
  }));

  const roundsCount = input.doubleRound ? (teamIds.length - 1) * 2 : teamIds.length - 1;

  return {
    matches,
    conflicts: conflicts.map((c) => ({ ...c, stageId, stageName })),
    roundsCount,
  };
}

/**
 * Arma un torneo nuevo desde cero: equipos, restricciones, fases
 * (Apertura, Clausura, General y opcionalmente Supercopa) y su calendario
 * completo (sin resultados cargados). Usa el mismo motor de fixtures que
 * los datos de demo (`generateRoundRobin` + `scheduleMatchdays`).
 */
export function createTournamentState(input: CreateTournamentInput): CreateTournamentResult {
  if (input.teams.length < 2) {
    throw new Error("Un torneo necesita al menos 2 equipos.");
  }
  if (input.weeklySlots.length === 0) {
    throw new Error("Definí al menos un día de juego en la plantilla semanal.");
  }

  const tournamentId = generateId("trn");
  const tournament = {
    id: tournamentId,
    name: input.name.trim() || "Torneo sin nombre",
    slug: slugify(input.name) || generateId("torneo"),
    description: input.description?.trim() || undefined,
  };

  const usedSlugs = new Set<string>();
  const teams: Team[] = input.teams.map((t) => {
    let slug = slugify(t.name) || "equipo";
    while (usedSlugs.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    usedSlugs.add(slug);

    return {
      id: generateId("team"),
      tournamentId,
      name: t.name.trim(),
      slug,
      managerName: t.managerName.trim(),
      primaryColor: t.primaryColor,
    };
  });

  const teamAvailability: TeamAvailability[] = input.teams.flatMap((t, i) =>
    t.allowedDays && t.allowedDays.length > 0
      ? [{ teamId: teams[i].id, tournamentId, allowedDays: t.allowedDays }]
      : [],
  );

  const teamIds = teams.map((t) => t.id);
  const points = { win: 3, draw: 1, loss: 0 };
  const format = input.doubleRound ? "ROUND_ROBIN_DOUBLE" : "ROUND_ROBIN_SINGLE";

  const aperturaStart = alignToWeekday(new Date(input.seasonStart), input.weeklySlots[0].day);
  const aperturaId = generateId("stage");
  const apertura = buildStageFixture(aperturaId, "Apertura", teamIds, input, teamAvailability, aperturaStart);

  const breakWeeks = input.breakWeeksBetweenStages ?? 3;
  const clausuraStart = new Date(aperturaStart);
  clausuraStart.setDate(clausuraStart.getDate() + (apertura.roundsCount - 1) * 7 + breakWeeks * 7);
  const clausuraId = generateId("stage");
  const clausura = buildStageFixture(clausuraId, "Clausura", teamIds, input, teamAvailability, clausuraStart);

  const generalId = generateId("stage");
  const stages: CompetitionStage[] = [
    {
      id: aperturaId,
      seasonId: tournamentId,
      name: `Torneo Apertura`,
      type: "APERTURA",
      format,
      status: "SCHEDULED",
      points,
    },
    {
      id: clausuraId,
      seasonId: tournamentId,
      name: `Torneo Clausura`,
      type: "CLAUSURA",
      format,
      status: "SCHEDULED",
      points,
    },
    {
      id: generalId,
      seasonId: tournamentId,
      name: "Tabla General",
      type: "GENERAL",
      format,
      status: "SCHEDULED",
      points,
      aggregatesFrom: [aperturaId, clausuraId],
    },
  ];

  const matchesByStage: Record<string, Match[]> = {
    [aperturaId]: apertura.matches,
    [clausuraId]: clausura.matches,
    [generalId]: [],
  };

  if (input.includeSupercopa ?? true) {
    const supercopaId = generateId("stage");
    stages.push({
      id: supercopaId,
      seasonId: tournamentId,
      name: "Supercopa",
      type: "SUPERCOPA",
      format: "DIRECT_MATCH",
      status: "DRAFT",
      points,
    });
    matchesByStage[supercopaId] = [];
  }

  return {
    state: { tournament, teams, teamAvailability, stages, matchesByStage },
    conflicts: [...apertura.conflicts, ...clausura.conflicts],
  };
}

/**
 * Vuelve un torneo a su estado inicial: borra todos los marcadores (vuelven
 * a null) y el estado de cada partido pasa a SCHEDULED, pero el calendario
 * (fechas, rivales, jornadas) y los equipos quedan exactamente igual.
 */
export function resetTournamentState(state: TournamentState): TournamentState {
  const matchesByStage = Object.fromEntries(
    Object.entries(state.matchesByStage).map(([stageId, matches]) => [
      stageId,
      matches.map((m) => ({ ...m, homeScore: null, awayScore: null, status: "SCHEDULED" as const })),
    ]),
  );

  const stages = state.stages.map((stage) => ({
    ...stage,
    status: stage.status === "DRAFT" ? ("DRAFT" as const) : ("SCHEDULED" as const),
  }));

  return { ...state, stages, matchesByStage };
}
