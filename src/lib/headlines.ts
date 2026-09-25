import type { Match, Team } from "@/types/domain";

/**
 * Titulares con humor negro/picante para el resultado de un partido (liga
 * de amigos, sin filtro de "prensa deportiva seria"). Se elige la plantilla
 * de forma determinística a partir del id del partido, para que el mismo
 * resultado no cambie de chiste en cada render.
 */

type Template2 = (winner: string, loser: string, winnerScore: number, loserScore: number) => string;
type DrawTemplate = (home: string, away: string, score: number) => string;

const BLOWOUT_TEMPLATES: Template2[] = [
  (w, l) => `${w} se cogió a ${l}, le hundió toda la pollita.`,
  (w, l, ws, ls) => `${w} pasó por encima de ${l} como una topadora: ${ws}-${ls} y ni las gracias dio.`,
  (w, l, ws, ls) => `Masacre total: ${w} humilló a ${l} ${ws}-${ls}, hasta el árbitro sintió pena.`,
  (w, l, ws, ls) => `${w} le rompió el traste a ${l}, ${ws}-${ls} y para la casa llorando.`,
  (w, l, ws, ls) => `A ${l} lo mandaron a webear temprano: ${w} goleó ${ws}-${ls} sin despeinarse.`,
  (w, l, ws, ls) => `${l} quedó con el orgullo en el piso: ${w} le metió un baile de ${ws}-${ls}.`,
];

const COMFORTABLE_TEMPLATES: Template2[] = [
  (w, l, ws, ls) => `${w} le dio una paliza prolija a ${l}: ${ws}-${ls}, sin piedad.`,
  (w, l, ws, ls) => `${l} se fue cabizbajo después de que ${w} lo pasara ${ws}-${ls}.`,
  (w, l, ws, ls) => `${w} no tuvo compasión: ${ws}-${ls} y ${l} a llorar a la iglesia.`,
  (w, l, ws, ls) => `${l} salió a jugar y salió jugado: ${w} ganó ${ws}-${ls}.`,
];

const NARROW_TEMPLATES: Template2[] = [
  (w, l, ws, ls) => `${w} sufrió pero se la llevó: ${ws}-${ls} sobre ${l}, con lo justo.`,
  (w, l, ws, ls) => `Partidazo de infarto: ${w} le ganó por la mínima a ${l}, ${ws}-${ls}.`,
  (w, l, ws, ls) => `${l} lo tuvo cerquita pero ${w} se lo robó al final, ${ws}-${ls}.`,
  (w, l, ws, ls) => `Ajustadísimo: ${w} ${ws}-${ls} ${l}, un gol que va a doler toda la semana.`,
];

const DRAW_TEMPLATES: DrawTemplate[] = [
  (a, b, s) => `${a} y ${b} se sacaron los mocos y terminaron ${s}-${s}, empate aburrido.`,
  (a, b, s) => `Ni ${a} ni ${b} se animaron: ${s}-${s} y todos contentos a medias.`,
  (a, b, s) => `${a} ${s}-${s} ${b}: un empate que no le sirve a nadie.`,
];

const FORFEIT_TEMPLATES: ((winner: string, loser: string) => string)[] = [
  (w, l) => `${l} ni se apareció: ${w} se llevó los puntos gratis por walkover.`,
  (w, l) => `${w} ganó sin mover un dedo: ${l} dejó plantada a la cancha.`,
  (w, l) => `Ausencia que sale cara: ${l} regaló el partido y ${w} se lo llevó calentito.`,
];

/** Hash simple (djb2) para elegir plantilla de forma estable por partido. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = (hash * 33) ^ value.charCodeAt(i);
  return Math.abs(hash);
}

function pick<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length];
}

export interface MatchHeadline {
  matchId: string;
  text: string;
}

/** Devuelve un titular picante para el resultado, o null si el partido no tiene marcador cerrado. */
export function buildMatchHeadline(match: Match, homeTeam?: Team, awayTeam?: Team): MatchHeadline | null {
  if (!homeTeam || !awayTeam) return null;
  if (match.status !== "PLAYED" && match.status !== "WALKOVER") return null;
  if (match.homeScore === null || match.homeScore === undefined) return null;
  if (match.awayScore === null || match.awayScore === undefined) return null;

  const home = match.homeScore;
  const away = match.awayScore;
  const seed = hashString(match.id);

  if (match.isForfeit && home !== away) {
    const [winner, loser] = home > away ? [homeTeam.name, awayTeam.name] : [awayTeam.name, homeTeam.name];
    return { matchId: match.id, text: pick(FORFEIT_TEMPLATES, seed)(winner, loser) };
  }

  if (home === away) {
    return { matchId: match.id, text: pick(DRAW_TEMPLATES, seed)(homeTeam.name, awayTeam.name, home) };
  }

  const [winner, loser, winnerScore, loserScore] =
    home > away ? [homeTeam.name, awayTeam.name, home, away] : [awayTeam.name, homeTeam.name, away, home];
  const margin = winnerScore - loserScore;
  const pool = margin >= 3 ? BLOWOUT_TEMPLATES : margin === 2 ? COMFORTABLE_TEMPLATES : NARROW_TEMPLATES;

  return { matchId: match.id, text: pick(pool, seed)(winner, loser, winnerScore, loserScore) };
}
