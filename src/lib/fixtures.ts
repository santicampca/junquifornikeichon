import type { DayOfWeek, TeamAvailability } from "@/types/domain";

export interface GeneratedMatch {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

const BYE = "__BYE__";

/**
 * Genera un fixture de todos-contra-todos usando el método del círculo.
 * Si `doubleRound` es true, agrega una segunda vuelta con localía invertida
 * (ida y vuelta). Con un número impar de equipos se agrega un "descanso"
 * (bye) por jornada.
 */
export function generateRoundRobin(
  teamIds: string[],
  { doubleRound = false }: { doubleRound?: boolean } = {},
): GeneratedMatch[] {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(BYE);

  const n = teams.length;
  const roundsCount = n - 1;
  const half = n / 2;
  const rotating = teams.slice(1); // el primer equipo queda fijo

  const firstLeg: GeneratedMatch[] = [];

  for (let round = 0; round < roundsCount; round++) {
    const roundTeams = [teams[0], ...rotating];

    for (let i = 0; i < half; i++) {
      const home = roundTeams[i];
      const away = roundTeams[n - 1 - i];
      if (home === BYE || away === BYE) continue;

      // Alterna localía por ronda para repartir partidos en casa/visita.
      const [homeTeamId, awayTeamId] = round % 2 === 0 ? [home, away] : [away, home];
      firstLeg.push({ round: round + 1, homeTeamId, awayTeamId });
    }

    rotating.unshift(rotating.pop() as string);
  }

  if (!doubleRound) return firstLeg;

  const secondLeg: GeneratedMatch[] = firstLeg.map((m) => ({
    round: roundsCount + m.round,
    homeTeamId: m.awayTeamId,
    awayTeamId: m.homeTeamId,
  }));

  return [...firstLeg, ...secondLeg];
}

export interface ScheduledMatch extends GeneratedMatch {
  scheduledAt: Date;
  dayOfWeek: DayOfWeek;
}

const DAY_TO_INDEX: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function nextDateForDay(from: Date, day: DayOfWeek): Date {
  const target = DAY_TO_INDEX[day];
  const date = new Date(from);
  const diff = (target - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Asigna fecha y día de la semana a cada partido de un fixture ya generado,
 * respetando los días candidatos de la jornada (ej: jueves, domingo, lunes)
 * y las restricciones de disponibilidad por equipo. Distribuye los partidos
 * de cada jornada entre los días candidatos de forma equilibrada; si ningún
 * día candidato es válido para ambos equipos, se asigna el primer día de la
 * lista como mejor esfuerzo (revisar manualmente ese caso).
 *
 * Nota: es un algoritmo goloso pensado para dar el primer resultado
 * razonable rápido, no un solver de restricciones exhaustivo.
 */
export function scheduleMatchdays(
  matches: GeneratedMatch[],
  {
    seasonStart,
    candidateDays,
    availability = [],
    daysBetweenMatchdays = 7,
  }: {
    seasonStart: Date;
    candidateDays: DayOfWeek[];
    availability?: TeamAvailability[];
    daysBetweenMatchdays?: number;
  },
): ScheduledMatch[] {
  const allowedByTeam = new Map<string, Set<DayOfWeek>>();
  for (const a of availability) {
    if (a.allowedDays.length > 0) {
      allowedByTeam.set(a.teamId, new Set(a.allowedDays));
    }
  }

  function isAllowed(teamId: string, day: DayOfWeek): boolean {
    const allowed = allowedByTeam.get(teamId);
    return !allowed || allowed.has(day);
  }

  const rounds = new Map<number, GeneratedMatch[]>();
  for (const match of matches) {
    const bucket = rounds.get(match.round) ?? [];
    bucket.push(match);
    rounds.set(match.round, bucket);
  }

  const result: ScheduledMatch[] = [];

  for (const [round, roundMatches] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
    const weekStart = new Date(seasonStart);
    weekStart.setDate(weekStart.getDate() + (round - 1) * daysBetweenMatchdays);

    // Reparte los partidos de la jornada entre los días candidatos.
    let dayCursor = 0;
    for (const match of roundMatches) {
      let chosenDay = candidateDays[dayCursor % candidateDays.length];

      const validDay = candidateDays.find(
        (day) => isAllowed(match.homeTeamId, day) && isAllowed(match.awayTeamId, day),
      );
      if (validDay) chosenDay = validDay;

      result.push({
        ...match,
        dayOfWeek: chosenDay,
        scheduledAt: nextDateForDay(weekStart, chosenDay),
      });
      dayCursor++;
    }
  }

  return result;
}
