import type { DayOfWeek, TeamAvailability } from "@/types/domain";

export interface GeneratedMatch {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

const BYE = "__BYE__";

/**
 * Genera un fixture de todos-contra-todos usando el método del círculo
 * (tablas de Berger). Si `doubleRound` es true, agrega una segunda vuelta
 * con localía invertida (ida y vuelta). Con un número impar de equipos se
 * agrega un "descanso" (bye) por jornada. Garantiza que cada equipo juegue
 * como máximo una vez por ronda (sin duplicados dentro de una misma vuelta).
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

// ============================================================
// Calendario: asignación de fecha/día a un fixture ya generado
// ============================================================

export interface WeeklySlot {
  day: DayOfWeek;
  /** Cuántos partidos entran ese día dentro de la jornada. */
  matchesPerDay: number;
}

export interface ScheduledMatch extends GeneratedMatch {
  scheduledAt: Date;
  dayOfWeek: DayOfWeek;
  /**
   * True si este partido es el que cumple, dentro de su jornada, la regla
   * del "domingo obligatorio": todo domingo debe tener al menos un partido
   * de un equipo con disponibilidad restringida (ej: Alianza Lima, UD
   * Europollas). Ver `computeMandatorySundayMatches`.
   */
  isMandatorySundayMatch: boolean;
}

export interface SchedulingConflict extends GeneratedMatch {
  reason: string;
}

export interface SchedulingResult {
  scheduled: ScheduledMatch[];
  /**
   * Partidos que no se pudieron ubicar respetando restricciones y cupos.
   * En vez de violar una regla o pisar el cupo de otro día, quedan acá
   * para que se resuelvan a mano (ej: ampliar un cupo, mover a otra
   * jornada).
   */
  conflicts: SchedulingConflict[];
  /**
   * Jornadas que quedaron sin ningún partido dominical de un equipo con
   * disponibilidad restringida (ver `computeMandatorySundayMatches`). No
   * bloquea la generación —el calendario igual se arma— pero se reporta
   * para que el admin lo revise manualmente.
   */
  warnings: string[];
}

const DAY_INDEX: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const DAY_BY_INDEX: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

/** Días desde `anchorDay` hasta `day`, siempre en [0, 6]. */
function offsetFromAnchor(anchorDay: DayOfWeek, day: DayOfWeek): number {
  return (DAY_INDEX[day] - DAY_INDEX[anchorDay] + 7) % 7;
}

/**
 * Arma el calendario real (fecha + día) para un fixture ya generado
 * (`generateRoundRobin`), respetando:
 *
 *  - La plantilla semanal de la jornada: qué días se juega y cuántos
 *    partidos entran por día (`weeklySlots`, en orden cronológico —
 *    ej: jueves×1, viernes×1, sábado×2, domingo×1, lunes×1).
 *  - Las restricciones de disponibilidad por equipo (`availability`):
 *    lista blanca de días en los que un equipo puede jugar. Un equipo
 *    sin entrada en `availability` puede jugar cualquier día de la
 *    plantilla.
 *  - La regla del "domingo obligatorio": marca (`isMandatorySundayMatch`)
 *    los partidos de domingo que involucran a un equipo con disponibilidad
 *    restringida, y reporta en `warnings` las jornadas donde ninguno cumplió
 *    esa condición.
 *
 * Algoritmo (heurística de CSP — "minimum remaining values"):
 *  1. Para cada partido de la jornada se calculan sus días válidos:
 *     intersección de los días permitidos de ambos equipos con los
 *     días de la plantilla semanal.
 *  2. Los partidos se ordenan por cantidad de días válidos ascendente.
 *     Así, los partidos "condicionados" (con equipos restringidos, y
 *     por lo tanto pocas opciones) se colocan primero; los partidos
 *     libres —sin restricción, con todos los días como opción— quedan
 *     al final y rellenan los huecos que sobran. Resolver primero lo
 *     más restringido es lo que evita que un partido libre le gane el
 *     único día posible a un partido condicionado.
 *  3. Cada partido se asigna al día válido con más cupo disponible en
 *     ese momento, para repartir la carga entre los días de la
 *     plantilla en vez de amontonar todo en el primero.
 *  4. Si un partido se queda sin día válido con cupo, no se fuerza:
 *     se reporta en `conflicts`.
 */
export function scheduleMatchdays(
  matches: GeneratedMatch[],
  {
    seasonStart,
    weeklySlots,
    availability = [],
    weeksBetweenMatchdays = 1,
  }: {
    /**
     * Fecha exacta en la que arranca la Jornada 1 (en UTC). El día de la
     * semana de esta fecha es el ancla de todas las ventanas de jornada: no
     * hace falta que coincida con ningún día de `weeklySlots` en particular.
     */
    seasonStart: Date;
    weeklySlots: WeeklySlot[];
    availability?: TeamAvailability[];
    /** Separación entre el inicio de una ventana de jornada y la siguiente. */
    weeksBetweenMatchdays?: number;
  },
): SchedulingResult {
  if (weeklySlots.length === 0) {
    throw new Error("scheduleMatchdays: weeklySlots no puede estar vacío");
  }

  const allowedByTeam = new Map<string, Set<DayOfWeek>>();
  for (const a of availability) {
    if (a.allowedDays.length > 0) allowedByTeam.set(a.teamId, new Set(a.allowedDays));
  }

  // El ancla es el día de la semana real de `seasonStart` (en UTC, para no
  // depender de la zona horaria del server) — no el primer día de
  // `weeklySlots`, que podía no tener nada que ver con la fecha elegida y
  // corría el inicio del torneo varios días para adelante sin que nadie lo
  // pidiera.
  const anchorDay = DAY_BY_INDEX[seasonStart.getUTCDay()];
  const windowLengthDays = 7 * weeksBetweenMatchdays;

  const byRound = new Map<number, GeneratedMatch[]>();
  for (const match of matches) {
    const bucket = byRound.get(match.round) ?? [];
    bucket.push(match);
    byRound.set(match.round, bucket);
  }

  const scheduled: ScheduledMatch[] = [];
  const conflicts: SchedulingConflict[] = [];
  const warnings: string[] = [];

  for (const [round, roundMatches] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
    const roundScheduled: ScheduledMatch[] = [];
    const windowStart = new Date(seasonStart);
    windowStart.setUTCDate(windowStart.getUTCDate() + (round - 1) * windowLengthDays);

    const remainingCapacity = new Map<DayOfWeek, number>(
      weeklySlots.map((slot) => [slot.day, slot.matchesPerDay]),
    );

    // Paso 1: calcular días válidos por partido (intersección de
    // disponibilidad de ambos equipos con la plantilla semanal).
    const withValidDays = roundMatches.map((match) => {
      const homeDays = allowedByTeam.get(match.homeTeamId);
      const awayDays = allowedByTeam.get(match.awayTeamId);
      const validDays = weeklySlots
        .map((slot) => slot.day)
        .filter((day) => (!homeDays || homeDays.has(day)) && (!awayDays || awayDays.has(day)));
      return { match, validDays };
    });

    // Paso 2: los más restringidos (menos días válidos) se resuelven primero.
    withValidDays.sort((a, b) => a.validDays.length - b.validDays.length);

    for (const { match, validDays } of withValidDays) {
      if (validDays.length === 0) {
        conflicts.push({
          ...match,
          reason:
            "Los días permitidos de los equipos no se solapan con ningún día de la plantilla semanal.",
        });
        continue;
      }

      // Paso 3: entre los días válidos, el que tenga más cupo libre.
      let bestDay: DayOfWeek | null = null;
      let bestCapacity = -1;
      for (const day of validDays) {
        const capacity = remainingCapacity.get(day) ?? 0;
        if (capacity > bestCapacity) {
          bestCapacity = capacity;
          bestDay = day;
        }
      }

      if (!bestDay || bestCapacity <= 0) {
        conflicts.push({
          ...match,
          reason: "No quedaba cupo disponible en ninguno de los días permitidos para este partido.",
        });
        continue;
      }

      remainingCapacity.set(bestDay, bestCapacity - 1);

      const scheduledAt = new Date(windowStart);
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() + offsetFromAnchor(anchorDay, bestDay));

      roundScheduled.push({ ...match, dayOfWeek: bestDay, scheduledAt, isMandatorySundayMatch: false });
    }

    // Regla del domingo obligatorio: un equipo con disponibilidad
    // restringida (`allowedByTeam`, ej: Alianza Lima, UD Europollas) es
    // "sunday-constrained". Si el domingo de la plantilla semanal no tiene
    // ningún partido de esos equipos, se reporta como warning (no bloquea).
    const sundayInSlots = weeklySlots.some((s) => s.day === "SUNDAY");
    if (sundayInSlots) {
      let hasMandatorySundayMatch = false;
      for (const m of roundScheduled) {
        if (
          m.dayOfWeek === "SUNDAY" &&
          (allowedByTeam.has(m.homeTeamId) || allowedByTeam.has(m.awayTeamId))
        ) {
          m.isMandatorySundayMatch = true;
          hasMandatorySundayMatch = true;
        }
      }
      if (!hasMandatorySundayMatch) {
        warnings.push(
          `Jornada ${round}: no quedó ningún partido dominical de un equipo con disponibilidad restringida.`,
        );
      }
    }

    scheduled.push(...roundScheduled);
  }

  return { scheduled, conflicts, warnings };
}
