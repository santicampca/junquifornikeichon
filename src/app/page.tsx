import { TournamentCard } from "@/components/tournaments/tournament-card";
import { NewTournamentButton } from "@/components/admin/new-tournament-button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getActiveTournamentState,
  getLastTeamRoster,
  getMatchProofImage,
  getNewsPhotoPool,
  getNewsPhotosByPhrase,
  getNewsPhrasePools,
} from "@/lib/data";
import { buildMatchHeadline, hashString } from "@/lib/headlines";
import { Camera, Flame, Trophy } from "lucide-react";

export default async function DashboardPage() {
  const state = await getActiveTournamentState();
  // No depende de que haya torneo activo: si se borró la liga, sigue
  // teniendo los últimos equipos conocidos para precargar en el asistente.
  const lastRoster = await getLastTeamRoster();

  const allMatches = state ? Object.values(state.matchesByStage).flat() : [];
  const playedMatches = allMatches.filter((m) => m.status === "PLAYED").length;
  const activeStages = state ? state.stages.filter((s) => s.status !== "DRAFT").length : 0;

  const teamsById = new Map((state?.teams ?? []).map((t) => [t.id, t]));
  const customPhrasePools = await getNewsPhrasePools();
  const headlines = allMatches
    .filter((m) => m.status === "PLAYED" || m.status === "WALKOVER")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
    .map((m) => buildMatchHeadline(m, teamsById.get(m.homeTeamId), teamsById.get(m.awayTeamId), customPhrasePools))
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .slice(0, 6);

  // La foto de cada noticia sale primero de las fotos afiliadas a la frase
  // elegida (subidas en /admin apuntando a esa frase concreta); si esa
  // frase no tiene ninguna, cae al pool general sin afiliar; si tampoco hay
  // nada ahí, cae de nuevo al comprobante real que subió el equipo al
  // cerrar el partido. La elección dentro de cada pool es al azar pero
  // determinística por partido.
  const [newsPhotoPool, photosByPhrase] = await Promise.all([getNewsPhotoPool(), getNewsPhotosByPhrase()]);
  const photosByMatchId = new Map(
    await Promise.all(
      headlines.map(async (h) => {
        const affiliated = h.phraseId ? photosByPhrase[h.phraseId] : undefined;
        if (affiliated && affiliated.length > 0) {
          return [h.matchId, affiliated[hashString(h.matchId) % affiliated.length]] as const;
        }
        if (newsPhotoPool.length > 0) {
          return [h.matchId, newsPhotoPool[hashString(h.matchId) % newsPhotoPool.length]] as const;
        }
        return [h.matchId, await getMatchProofImage(h.matchId)] as const;
      }),
    ),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tus torneos</h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona ligas de amigos: Apertura, Clausura, Supercopa y tabla general.
          </p>
        </div>
        <NewTournamentButton currentTeams={lastRoster.teams} currentTeamAvailability={lastRoster.teamAvailability} />
      </div>

      {!state ? (
        <EmptyState
          icon={Trophy}
          title="Todavía no hay ningún torneo"
          description="Creá el primero con el botón de arriba, o corré el seed (npm run db:seed) para cargar el torneo de ejemplo."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <TournamentCard tournament={state.tournament} />
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Equipos" value={state.teams.length} />
            <StatTile label="Fases" value={state.stages.length} />
            <StatTile label="Fases activas" value={activeStages} />
            <StatTile label="Partidos jugados" value={playedMatches} />
          </div>

          {headlines.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight text-foreground">Noticias</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {headlines.map((h) => {
                  const photo = photosByMatchId.get(h.matchId);
                  return (
                    <article
                      key={h.matchId}
                      className="overflow-hidden rounded-xl border border-border bg-surface"
                    >
                      <div className="flex aspect-video w-full items-center justify-center bg-surface-elevated">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URL, no CDN que optimizar
                          <img src={photo} alt="" className="size-full object-cover" />
                        ) : (
                          <Camera className="size-8 text-muted" strokeWidth={1.5} />
                        )}
                      </div>
                      <p className="p-3 text-sm font-medium text-foreground">{h.text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
