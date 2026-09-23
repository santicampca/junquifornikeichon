import { prisma } from "../src/lib/prisma";
import { createTournamentState } from "../src/lib/tournament-factory";
import { persistTournamentState } from "../src/lib/persist-tournament";
import type { WeeklySlot } from "../src/lib/fixtures";
import type { DayOfWeek } from "../src/types/domain";

/**
 * Seed real del torneo: los 12 equipos oficiales, con las restricciones de
 * disponibilidad conocidas (Alianza lima solo jueves/domingo, UD Europollas
 * solo domingo/lunes) y la plantilla semanal jueves-a-lunes.
 *
 * Arma todo en memoria con `createTournamentState` (el mismo motor que usa
 * el asistente "Nuevo torneo" de la UI) y lo persiste con
 * `persistTournamentState` (la misma función que usa la Server Action de
 * creación de torneos).
 */

const WEEKLY_SLOTS: WeeklySlot[] = [
  { day: "THURSDAY", matchesPerDay: 1 },
  { day: "FRIDAY", matchesPerDay: 1 },
  { day: "SATURDAY", matchesPerDay: 2 },
  { day: "SUNDAY", matchesPerDay: 1 },
  { day: "MONDAY", matchesPerDay: 1 },
];

const TEAMS: { name: string; managerName: string; primaryColor: string; allowedDays?: DayOfWeek[] }[] = [
  { name: "Zenit's", managerName: "Santiago", primaryColor: "#f59e0b" },
  { name: "Snorlax FC", managerName: "Yenderson", primaryColor: "#3b82f6" },
  { name: "C.F Tipetiripe", managerName: "Isaac", primaryColor: "#ef4444" },
  { name: "UD Europollas", managerName: "Diego", primaryColor: "#a855f7", allowedDays: ["SUNDAY", "MONDAY"] },
  { name: "Coño colo juniors", managerName: "Yojhan", primaryColor: "#ec4899" },
  { name: "UD La cota 1000", managerName: "Miguel", primaryColor: "#06b6d4" },
  { name: "Respeta la justicia pape", managerName: "Argenis", primaryColor: "#eab308" },
  { name: "Vehement", managerName: "Nicko", primaryColor: "#14b8a6" },
  { name: "Te parto el Culo Efe c", managerName: "Angel", primaryColor: "#f97316" },
  { name: "©aªlVos Fc", managerName: "Luis", primaryColor: "#8b5cf6" },
  { name: "Alianza lima", managerName: "Javier", primaryColor: "#22c55e", allowedDays: ["THURSDAY", "SUNDAY"] },
  { name: "ak memeten la 47", managerName: "Henry", primaryColor: "#84cc16" },
];

async function main() {
  const { state, conflicts } = createTournamentState({
    name: "Liga de Amigos JMC",
    description: "Torneo amateur entre amigos, con fases Apertura, Clausura y Supercopa.",
    teams: TEAMS,
    doubleRound: true,
    weeklySlots: WEEKLY_SLOTS,
    seasonStart: "2026-03-05", // jueves
    includeSupercopa: true,
  });

  if (conflicts.length > 0) {
    console.warn(`Aviso: ${conflicts.length} partido(s) no se pudieron programar automáticamente:`, conflicts);
  }

  const { tournamentSlug } = await persistTournamentState(state, { isActive: true });

  const totalMatches = Object.values(state.matchesByStage).reduce((sum, ms) => sum + ms.length, 0);
  console.log(
    `Seed completo: "${state.tournament.name}" (/torneos/${tournamentSlug}) con ${state.teams.length} equipos, ${state.stages.length} fases y ${totalMatches} partidos.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
