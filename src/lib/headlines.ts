import type { Match, NewsCategory, Team } from "@/types/domain";

/**
 * Titulares con humor negro/picante para el resultado de un partido (liga
 * de amigos, sin filtro de "prensa deportiva seria"). La plantilla se elige
 * de forma determinística a partir del id del partido, para que el mismo
 * resultado no cambie de chiste en cada render.
 *
 * Las plantillas son texto plano con placeholders ({W}, {L}, {WS}, {LS} o
 * {A}, {B}, {S} para empates) en vez de funciones: así el banco de frases
 * que carga el admin desde /admin (ver src/lib/admin-cms-actions.ts) se
 * renderiza con el mismo motor que estas por defecto.
 */

const DEFAULT_POOLS: Record<NewsCategory, string[]> = {
  BLOWOUT: [
    "{W} se cogió a {L}, le hundió toda la pollita.",
    "{W} destrozó a {L} {WS}-{LS}: no fue partido, fue una masacre con nombre y apellido.",
    "A {L} lo hicieron mierda: {WS}-{LS} y todavía preguntan qué les pasó.",
    "{W} le bajó los pantalones a {L} en frente de todos, {WS}-{LS}.",
    "Vergüenza ajena total: {W} humilló a {L} {WS}-{LS} y ni se dignó a festejar.",
    "{L} se fue de la cancha con el orgullo hecho pomada: {W} goleó {WS}-{LS}.",
    "{W} le rompió el orto a {L}, {WS}-{LS}, para la casa a llorar con mamá.",
  ],
  // Incluye lo que antes eran las frases de "ajustada" (3-2): esa categoría
  // se sacó porque no se da en la práctica (el partido juega a 3), pero las
  // frases ya escritas para ese caso encajan igual de bien acá.
  COMFORTABLE: [
    "{W} le dio una paliza prolija a {L}: {WS}-{LS}, sin piedad ni vaselina.",
    "{L} salió a jugar y salió cagando: {W} lo pasó {WS}-{LS}.",
    "{W} no tuvo compasión: {WS}-{LS} y {L} a rezar el rosario.",
    "{L} quedó boqueando en la cancha: {W} se lo llevó puesto {WS}-{LS}.",
    "{W} sufrió pero se la llevó calentita: {WS}-{LS} sobre {L}.",
    "Infarto en cancha: {W} le ganó por la mínima a {L}, {WS}-{LS}, con lo puesto.",
    "{L} lo tuvo en la mano y lo dejó ir: {W} se lo robó {WS}-{LS}.",
  ],
  DRAW: [
    "{A} y {B} se sacaron los mocos y no rompieron nada: {S}-{S}, empate de siesta.",
    "Ni {A} ni {B} se animaron a jugar en serio: {S}-{S} y a otra cosa.",
    "{A} {S}-{S} {B}: un empate que no le sirve ni al que lo mira.",
  ],
  FORFEIT: [
    "{L} ni se apareció, el cagón: {W} se llevó los puntos gratis por walkover.",
    "{W} ganó sin mover un dedo: {L} se cagó y dejó plantada a la cancha.",
    "Ausencia que sale cara: {L} regaló el partido y {W} se lo llevó calentito, de arriba.",
  ],
};

/** Hash simple (djb2) para elegir algo de forma estable a partir de un id. */
export function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = (hash * 33) ^ value.charCodeAt(i);
  return Math.abs(hash);
}

function pick<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length];
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (raw, key: string) => (key in vars ? String(vars[key]) : raw));
}

/**
 * Los partidos juegan "a 3": el que gana llega justo a 3 goles, así que
 * 3-0 es goleada y cualquier otra cosa (3-1, y en teoría 3-2, que en la
 * práctica no se da) es cómoda. No hay categoría "ajustada": con este
 * formato nunca hay un resultado tan al filo como para justificarla.
 */
function classifyMarginCategory(winnerScore: number, loserScore: number): NewsCategory {
  if (winnerScore === 3 && loserScore === 0) return "BLOWOUT";
  const margin = winnerScore - loserScore;
  return margin >= 3 ? "BLOWOUT" : "COMFORTABLE";
}

export interface NewsPhraseEntry {
  id: string;
  template: string;
}

export interface MatchHeadline {
  matchId: string;
  text: string;
  /** Id de la frase del admin usada (si la hubo); ver getNewsPhotosByPhrase en src/lib/data.ts. */
  phraseId?: string;
}

/**
 * Devuelve un titular picante para el resultado, o null si el partido no
 * tiene marcador cerrado. `customPools` (banco de frases del admin, ver
 * getNewsPhrasePools en src/lib/data.ts) reemplaza por completo el pool por
 * defecto de una categoría en cuanto tiene al menos una fila cargada; solo
 * las frases del admin traen `id`, así la foto afiliada a esa frase concreta
 * se puede buscar después (las frases por defecto no tienen fotos propias).
 */
export function buildMatchHeadline(
  match: Match,
  homeTeam?: Team,
  awayTeam?: Team,
  customPools?: Partial<Record<NewsCategory, NewsPhraseEntry[]>>,
): MatchHeadline | null {
  if (!homeTeam || !awayTeam) return null;
  if (match.status !== "PLAYED" && match.status !== "WALKOVER") return null;
  if (match.homeScore === null || match.awayScore === null) return null;

  const poolFor = (category: NewsCategory): NewsPhraseEntry[] =>
    customPools?.[category]?.length
      ? (customPools[category] as NewsPhraseEntry[])
      : DEFAULT_POOLS[category].map((template) => ({ id: "", template }));

  const home = match.homeScore;
  const away = match.awayScore;
  const seed = hashString(match.id);

  if (match.isForfeit && home !== away) {
    const [winner, loser] = home > away ? [homeTeam.name, awayTeam.name] : [awayTeam.name, homeTeam.name];
    const phrase = pick(poolFor("FORFEIT"), seed);
    return {
      matchId: match.id,
      text: fillTemplate(phrase.template, { W: winner, L: loser }),
      phraseId: phrase.id || undefined,
    };
  }

  if (home === away) {
    const phrase = pick(poolFor("DRAW"), seed);
    return {
      matchId: match.id,
      text: fillTemplate(phrase.template, { A: homeTeam.name, B: awayTeam.name, S: home }),
      phraseId: phrase.id || undefined,
    };
  }

  const [winner, loser, winnerScore, loserScore] =
    home > away ? [homeTeam.name, awayTeam.name, home, away] : [awayTeam.name, homeTeam.name, away, home];
  const category = classifyMarginCategory(winnerScore, loserScore);
  const phrase = pick(poolFor(category), seed);

  return {
    matchId: match.id,
    text: fillTemplate(phrase.template, { W: winner, L: loser, WS: winnerScore, LS: loserScore }),
    phraseId: phrase.id || undefined,
  };
}
