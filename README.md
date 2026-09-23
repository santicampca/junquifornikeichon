# Torneos FC

Plataforma para crear, programar y seguir torneos de fútbol amateur entre
amigos: fases Apertura/Clausura, Supercopa, tabla general acumulada,
calendario con restricciones de días por equipo y estadísticas en tiempo
real.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — páginas como Server Components que leen directo de la base; los controles de admin son los únicos Client Components.
- **Tailwind CSS v4** — tema oscuro definido con tokens CSS (`src/app/globals.css`), sin `tailwind.config.js` (config inline vía `@theme`).
- **Prisma ORM + MongoDB Atlas (free tier)** — esquema en `prisma/schema.prisma`. Gratis, sin tarjeta.
- **Server Actions** (`src/lib/actions.ts`) para las mutaciones (reiniciar torneo, crear torneo), en vez de API routes separadas.

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env      # completá DATABASE_URL con tu connection string de Mongo
npm run db:push           # crea las colecciones/índices a partir del schema
npm run db:seed           # carga el torneo real (12 equipos) como torneo activo
npm run dev
```

Si no hay ningún torneo con `isActive = true` en la base, la UI lo dice
explícitamente (pantalla vacía con instrucciones) en vez de romper — correr
`npm run db:seed` lo soluciona.

MongoDB no tiene `migrate dev` (no versiona el esquema como SQL): cualquier
cambio a `prisma/schema.prisma` se aplica con `npm run db:push`.

## Arquitectura

```
prisma/
  schema.prisma       # modelo de datos (fuente de verdad del dominio)
  seed.ts             # carga el torneo real (12 equipos) como torneo activo

src/
  app/                # rutas (App Router), todas Server Components async
    page.tsx                    → dashboard de torneos
    torneos/[slug]/page.tsx     → detalle de torneo (tabs por fase, tabla, fixtures)
    equipos/page.tsx            → directorio de equipos
    equipos/[slug]/page.tsx     → perfil de equipo (stats, historial)

  components/
    ui/               # primitivas visuales (Card, Badge, EmptyState)
    layout/           # Navbar
    tournaments/      # TournamentCard, StageTabs (switch Apertura/Clausura/Supercopa/General)
    standings/        # StandingsTable
    teams/            # TeamCard, TeamBadge
    matches/          # MatchCard
    admin/            # Client Components: login de admin, reiniciar torneo, wizard de torneo nuevo

  lib/
    standings.ts       # computeStandings() y mergeStandings() — cálculo puro, sin DB
    fixtures.ts         # generateRoundRobin() y scheduleMatchdays() — fixture + calendario
    tournament-factory.ts # createTournamentState() — arma un torneo entero en memoria (equipos + fases + calendario)
    persist-tournament.ts # vuelca un TournamentState armado en memoria a Mongo (la usan el seed y el wizard)
    data.ts             # getActiveTournamentState() — lee el torneo activo de Mongo (cacheado por request con React.cache)
    actions.ts           # "use server": resetTournamentAction, createTournamentAction (validan admin del lado del servidor)
    prisma.ts            # singleton del cliente de Prisma
    app-store.tsx         # Context de "modo admin" (login por nombre, ver más abajo)
    utils.ts

  types/
    domain.ts          # tipos de dominio compartidos entre UI y lib (independientes de Prisma)
```

La regla general: **la lógica de negocio vive en `src/lib`, no en los
componentes**. `computeStandings`, `mergeStandings`, `generateRoundRobin` y
`scheduleMatchdays` son funciones puras (reciben datos, devuelven datos) para
poder testearlas sin base de datos ni Next.js.

### Cómo fluye una página

`getActiveTournamentState()` (`src/lib/data.ts`) busca el `Tournament` con
`isActive = true` y arma un `TournamentState` completo (equipos, fases,
partidos) con la misma forma en toda la app. Cada página es un Server
Component `async` que la llama directo — no hay fetch client-side ni
loading spinners para los datos de lectura.

### Modo admin (importante: no es seguridad real)

El botón "Admin" del navbar pide un nombre y lo compara contra una lista
fija (Santiago/Zenit's) — eso solo **muestra u oculta botones** en el
navegador. Las Server Actions (`resetTournamentAction`,
`createTournamentAction`) vuelven a validar ese mismo nombre del lado del
servidor antes de tocar la base, porque una Server Action es un endpoint
HTTP más: cualquiera que la llame directo (sin pasar por el botón) podría
saltearse un chequeo que solo viva en el cliente. Aun así, esto sigue sin
ser autenticación real (no hay contraseñas ni sesiones) — alcanza para que
tus amigos no te pisen el torneo sin querer, no para un uso serio/público.

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
- **Match** pertenece a una fase (el campo `matchdayId`/modelo `Matchday`
  existe en el schema para agrupar partidos por jornada, pero todavía no se
  usa: hoy alcanza con el campo `round`, de texto libre, ej. "Jornada 5").
- Las tablas de posiciones **no se persisten**: se calculan en el momento a
  partir de los partidos (`computeStandings`), así siempre están al día.
- **Reiniciar torneo** solo pone en `null` los marcadores y en `SCHEDULED`
  el estado de los partidos — calendario y equipos quedan igual.
- **Crear torneo** no borra el anterior: lo archiva (`isActive = false`) y
  el nuevo queda activo. El historial de torneos viejos se conserva en la base.

Ver `prisma/schema.prisma` para el detalle completo (comentarios inline en
cada modelo).

## Próximos pasos sugeridos

1. Autenticación real (por ejemplo con sesiones/cookies) si en algún
   momento cada mánager va a cargar sus propios resultados.
2. Módulo de plantilla/jugadores (el modelo `Player` ya existe en el schema).
3. Ajustar `scheduleMatchdays` de un algoritmo goloso a un solver más
   robusto si las restricciones de disponibilidad se vuelven complejas.
4. Un selector de "torneos archivados" en el dashboard (ya quedan
   guardados en la base con `isActive = false`, solo falta la UI).
