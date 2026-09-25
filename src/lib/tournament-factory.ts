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
  /**
   * Fecha exacta (yyyy-mm-dd) en la que arranca el Apertura: la Jornada 1
   * cae ese mismo día si su día de semana está habilitado en `weeklySlots`,
   * o en el primer día habilitado de esa misma semana si no. Nunca se corre
   * a la semana siguiente.
   */
  seasonStart: string;
  /** Semanas de receso entre el fin del Apertura y el inicio del Clausura. */
  breakWeeksBetweenStages?: number;
  includeSupercopa?: boolean;
  /**
   * Agrega una fase de Playoffs (DRAFT, sin partidos): eliminación directa
   * top-8 sobre la Tabla General, que el admin genera a mano una vez
   * terminada la liga (ver generatePlayoffsAction/generatePlayoffsSemifinalsAction/
   * generatePlayoffsFinalAction en src/lib/actions.ts) porque los rivales
   * dependen de la tabla final.
   */
  includePlayoffs?: boolean;
}

export interface CreateTournamentConflict extends SchedulingConflict {
  stageId: string;
  stageName: string;
}

export interface CreateTournamentResult {
  state: TournamentState;
  /** Partidos que el motor de calendario no pudo ubicar; requieren ajuste manual. */
  conflicts: CreateTournamentConflict[];
  /** Jornadas sin partido dominical obligatorio; ver fixtures.ts. */
  warnings: string[];
}

function buildStageFixture(
  stageId: string,
  stageName: string,
  teamIds: string[],
  input: Pick<CreateTournamentInput, "doubleRound" | "weeklySlots">,
  availability: TeamAvailability[],
  seasonStart: Date,
): { matches: Match[]; conflicts: CreateTournamentConflict[]; warnings: string[]; roundsCount: number } {
  const fixture = generateRoundRobin(teamIds, { doubleRound: input.doubleRound });
  const { scheduled, conflicts, warnings } = scheduleMatchdays(fixture, {
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
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
    scheduledAt: m.scheduledAt.toISOString(),
    dayOfWeek: m.dayOfWeek,
    round: `Jornada ${m.round}`,
    status: "SCHEDULED",
    isMandatorySundayMatch: m.isMandatorySundayMatch,
    isForfeit: false,
  }));

  const roundsCount = input.doubleRound ? (teamIds.length - 1) * 2 : teamIds.length - 1;

  return {
    matches,
    conflicts: conflicts.map((c) => ({ ...c, stageId, stageName })),
    warnings: warnings.map((w) => `${stageName} · ${w}`),
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
      hasPin: false,
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

  // Arranca exactamente el día que se eligió: scheduleMatchdays ancla la
  // Jornada 1 al día de semana real de esta fecha (ver fixtures.ts), no al
  // primer día de `weeklySlots`.
  const aperturaStart = new Date(input.seasonStart);
  const aperturaId = generateId("stage");
  const apertura = buildStageFixture(aperturaId, "Apertura", teamIds, input, teamAvailability, aperturaStart);

  const breakWeeks = input.breakWeeksBetweenStages ?? 3;
  const clausuraStart = new Date(aperturaStart);
  clausuraStart.setUTCDate(clausuraStart.getUTCDate() + (apertura.roundsCount - 1) * 7 + breakWeeks * 7);
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

  if (input.includePlayoffs) {
    const playoffsId = generateId("stage");
    stages.push({
      id: playoffsId,
      seasonId: tournamentId,
      name: "Playoffs",
      type: "PLAYOFFS",
      format: "KNOCKOUT",
      status: "DRAFT",
      points,
    });
    matchesByStage[playoffsId] = [];
  }

  return {
    // Sin ajustes de puntos todavía: recién se crea el torneo. persist-tournament.ts
    // arma los StageParticipant reales (en 0) directo desde `teams`/`stages`.
    state: { tournament, teams, teamAvailability, stages, matchesByStage, stageParticipants: [] },
    conflicts: [...apertura.conflicts, ...clausura.conflicts],
    warnings: [...apertura.warnings, ...clausura.warnings],
  };
}
