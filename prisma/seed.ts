import { PrismaClient, StageType, StageFormat, StageStatus, DayOfWeek } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed de ejemplo: una liga de amigos con 6 equipos, fase Apertura (en
 * curso), Clausura (programada), Tabla General (agrega ambas) y Supercopa
 * (aún sin definir). Pensado como punto de partida para probar el esquema
 * contra una base de datos real; los datos de demo que ve la UI sin base de
 * datos viven en src/lib/mock-data.ts.
 */
async function main() {
  const tournament = await prisma.tournament.create({
    data: {
      name: "Liga de Amigos JMC",
      slug: "liga-de-amigos",
      description: "Torneo amateur entre amigos, con fases Apertura, Clausura y Supercopa.",
    },
  });

  const season = await prisma.season.create({
    data: {
      tournamentId: tournament.id,
      name: "Temporada 2026",
      year: 2026,
      isCurrent: true,
    },
  });

  const teamsData = [
    { name: "Los Tigres FC", shortName: "TIG", slug: "los-tigres-fc", managerName: "Carlos Ramírez", primaryColor: "#f59e0b" },
    { name: "Atlético Barrio", shortName: "ATB", slug: "atletico-barrio", managerName: "Marcos Díaz", primaryColor: "#3b82f6" },
    { name: "Real Amigos", shortName: "REA", slug: "real-amigos", managerName: "Diego Torres", primaryColor: "#ef4444" },
    { name: "Deportivo Junco", shortName: "JUN", slug: "deportivo-junco", managerName: "Santiago Campos", primaryColor: "#22c55e" },
    { name: "FC Vecinos", shortName: "VEC", slug: "fc-vecinos", managerName: "Andrés López", primaryColor: "#a855f7" },
    { name: "Unidos SC", shortName: "UNI", slug: "unidos-sc", managerName: "Pablo Herrera", primaryColor: "#06b6d4" },
  ];

  const teams = await Promise.all(
    teamsData.map((data) => prisma.team.create({ data: { ...data, tournamentId: tournament.id } })),
  );

  const junco = teams.find((t) => t.slug === "deportivo-junco")!;
  const vecinos = teams.find((t) => t.slug === "fc-vecinos")!;

  await prisma.teamAvailability.createMany({
    data: [
      {
        teamId: junco.id,
        tournamentId: tournament.id,
        allowedDays: [DayOfWeek.THURSDAY, DayOfWeek.SUNDAY],
        notes: "Solo puede jugar jueves o domingo.",
      },
      {
        teamId: vecinos.id,
        tournamentId: tournament.id,
        allowedDays: [DayOfWeek.SUNDAY, DayOfWeek.MONDAY],
        notes: "No disponible los jueves.",
      },
    ],
  });

  const apertura = await prisma.competitionStage.create({
    data: {
      seasonId: season.id,
      name: "Torneo Apertura 2026",
      type: StageType.APERTURA,
      format: StageFormat.ROUND_ROBIN_DOUBLE,
      status: StageStatus.IN_PROGRESS,
      participants: { create: teams.map((t) => ({ teamId: t.id })) },
    },
  });

  const clausura = await prisma.competitionStage.create({
    data: {
      seasonId: season.id,
      name: "Torneo Clausura 2026",
      type: StageType.CLAUSURA,
      format: StageFormat.ROUND_ROBIN_DOUBLE,
      status: StageStatus.SCHEDULED,
      participants: { create: teams.map((t) => ({ teamId: t.id })) },
    },
  });

  await prisma.competitionStage.create({
    data: {
      seasonId: season.id,
      name: "Tabla General 2026",
      type: StageType.GENERAL,
      format: StageFormat.ROUND_ROBIN_DOUBLE,
      status: StageStatus.IN_PROGRESS,
      aggregatesFrom: {
        create: [{ childStageId: apertura.id }, { childStageId: clausura.id }],
      },
    },
  });

  await prisma.competitionStage.create({
    data: {
      seasonId: season.id,
      name: "Supercopa 2026",
      type: StageType.SUPERCOPA,
      format: StageFormat.DIRECT_MATCH,
      status: StageStatus.DRAFT,
    },
  });

  console.log(`Seed completo: torneo "${tournament.name}" con ${teams.length} equipos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
