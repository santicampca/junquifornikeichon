# Torneos FC

Plataforma para crear, programar y seguir torneos de fútbol amateur entre
amigos: fases Apertura/Clausura, Supercopa, tabla general acumulada,
calendario con restricciones de días por equipo y estadísticas en tiempo
real.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — SPA/SSR moderna, componentes de servidor por defecto.
- **Tailwind CSS v4** — tema oscuro definido con tokens CSS (`src/app/globals.css`), sin `tailwind.config.js` (config inline vía `@theme`).
- **Prisma ORM + PostgreSQL** — esquema en `prisma/schema.prisma`. Compatible con cualquier Postgres (Supabase, Neon, Railway, RDS...).
- **Zod** — validación de datos en el borde (formularios, server actions) cuando se conecte la capa de escritura.

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env      # y completá DATABASE_URL
npm run db:push           # crea las tablas a partir del schema (o db:migrate)
npm run db:seed           # carga un torneo de ejemplo
npm run dev
```

Sin base de datos conectada, la app igual funciona: las páginas leen de
`src/lib/mock-data.ts`, un set de datos de demostración con la misma forma
que usaría Prisma. Esto permite ver la UI completa (tablas, fixtures,
perfiles de equipo) desde el primer `npm run dev`.

## Arquitectura

```
prisma/
  schema.prisma       # modelo de datos (fuente de verdad del dominio)
  seed.ts             # datos de ejemplo para una base real

src/
  app/                # rutas (App Router)
    page.tsx                    → dashboard de torneos
    torneos/[slug]/page.tsx     → detalle de torneo (tabs por fase, tabla, fixtures)
    equipos/page.tsx            → directorio de equipos
    equipos/[slug]/page.tsx     → perfil de equipo (stats, historial)

  components/
    ui/               # primitivas visuales (Card, Badge, EmptyState)
    layout/           # Navbar y layout compartido
    tournaments/      # TournamentCard, StageTabs (switch Apertura/Clausura/Supercopa/General)
    standings/        # StandingsTable
    teams/            # TeamCard, TeamBadge
    matches/          # MatchCard

  lib/
    standings.ts      # computeStandings() y mergeStandings() — cálculo puro, sin DB
    fixtures.ts        # generateRoundRobin() y scheduleMatchdays() — fixture + calendario
    prisma.ts          # singleton del cliente de Prisma
    mock-data.ts       # datos de demo (misma forma que Prisma) para desarrollar sin DB
    utils.ts

  types/
    domain.ts          # tipos de dominio compartidos entre UI y lib (independientes de Prisma)
```

La regla general: **la lógica de negocio vive en `src/lib`, no en los
componentes**. `computeStandings`, `mergeStandings`, `generateRoundRobin` y
`scheduleMatchdays` son funciones puras (reciben datos, devuelven datos) para
poder testearlas sin base de datos ni Next.js.

## Modelo de datos (resumen)

- **Tournament** → **Season** → **CompetitionStage** (Apertura, Clausura, Supercopa, General).
  - Una fase `GENERAL` no tiene partidos propios: agrega los puntos de otras
    fases vía `StageAggregation` (ver `mergeStandings`).
  - Cada fase define su propio puntaje (`pointsForWin/Draw/Loss`), formato
    (`ROUND_ROBIN_SINGLE/DOUBLE`, `GROUP_STAGE`, `KNOCKOUT`, `DIRECT_MATCH`) y
    estado (`DRAFT → SCHEDULED → IN_PROGRESS → FINISHED`).
- **Team** pertenece a un `Tournament` (directorio general) y se inscribe a
  fases puntuales vía `StageParticipant` (para admitir, por ejemplo, que
  solo los campeones jueguen la Supercopa).
- **TeamAvailability** guarda los días de la semana en que un equipo puede
  jugar; `scheduleMatchdays()` la usa para armar el calendario.
- **Match** pertenece a una fase y opcionalmente a un `Matchday` (jornada).
- Las tablas de posiciones **no se persisten**: se calculan en el momento a
  partir de los partidos (`computeStandings`), así siempre están al día.

Ver `prisma/schema.prisma` para el detalle completo (comentarios inline en
cada modelo).

## Próximos pasos sugeridos

1. Conectar `src/app` a Prisma en vez de `mock-data.ts` (reemplazar los
   imports de `@/lib/mock-data` por consultas con `@/lib/prisma`).
2. Server actions / API routes para crear torneos, cargar resultados y
   generar fixtures desde la UI (hoy `generateRoundRobin` y
   `scheduleMatchdays` están listos para usarse desde un formulario).
3. Autenticación básica para que cada mánager cargue resultados de su equipo.
4. Módulo de plantilla/jugadores (el modelo `Player` ya existe en el schema).
5. Ajustar `scheduleMatchdays` de un algoritmo goloso a un solver más
   robusto si las restricciones de disponibilidad se vuelven complejas.
