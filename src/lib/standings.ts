import type { Match, PointsConfig } from "@/types/domain";

export type MatchResult = "W" | "D" | "L";

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Últimos resultados, del más antiguo al más reciente. */
  form: MatchResult[];
}

const DEFAULT_POINTS: PointsConfig = { win: 3, draw: 1, loss: 0 };

function emptyRow(teamId: string): StandingRow {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  };
}

/**
 * Calcula la tabla de posiciones a partir de una lista de partidos.
 * Solo se contabilizan los partidos con estado PLAYED y marcador definido.
 * Los WALKOVER se tratan como victoria/derrota sin goles adicionales.
 */
export function computeStandings(
  teamIds: string[],
  matches: Match[],
  points: PointsConfig = DEFAULT_POINTS,
  formSize = 5,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of teamIds) rows.set(id, emptyRow(id));

  const countable = matches.filter(
    (m) =>
      (m.status === "PLAYED" || m.status === "WALKOVER") &&
      m.homeScore !== null &&
      m.awayScore !== null,
  );

  for (const match of countable) {
    const home = rows.get(match.homeTeamId) ?? emptyRow(match.homeTeamId);
    const away = rows.get(match.awayTeamId) ?? emptyRow(match.awayTeamId);
    const homeScore = match.homeScore as number;
    const awayScore = match.awayScore as number;

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      home.points += points.win;
      away.lost += 1;
      away.points += points.loss;
      home.form.push("W");
      away.form.push("L");
    } else if (homeScore < awayScore) {
      away.won += 1;
      away.points += points.win;
      home.lost += 1;
      home.points += points.loss;
      away.form.push("W");
      home.form.push("L");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += points.draw;
      away.points += points.draw;
      home.form.push("D");
      away.form.push("D");
    }

    rows.set(match.homeTeamId, home);
    rows.set(match.awayTeamId, away);
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-formSize);
  }

  return sortStandings([...rows.values()]);
}

/** Orden estándar: puntos, diferencia de gol, goles a favor, luego por id. */
export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
  });
}

/**
 * Combina las tablas de varias fases (ej: Apertura + Clausura) sumando sus
 * estadísticas, útil para construir la Tabla General / Acumulada. Permite
 * que cada fase de origen tenga su propia configuración de puntos, ya que
 * recibe las filas ya calculadas en vez de recalcular desde los partidos.
 */
export function mergeStandings(rowsList: StandingRow[][]): StandingRow[] {
  const merged = new Map<string, StandingRow>();

  for (const rows of rowsList) {
    for (const row of rows) {
      const current = merged.get(row.teamId) ?? emptyRow(row.teamId);
      current.played += row.played;
      current.won += row.won;
      current.drawn += row.drawn;
      current.lost += row.lost;
      current.goalsFor += row.goalsFor;
      current.goalsAgainst += row.goalsAgainst;
      current.points += row.points;
      current.form = [...current.form, ...row.form];
      merged.set(row.teamId, current);
    }
  }

  for (const row of merged.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-5);
  }

  return sortStandings([...merged.values()]);
}
