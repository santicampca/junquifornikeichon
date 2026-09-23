import { TeamCard } from "@/components/teams/team-card";
import { teams } from "@/lib/mock-data";

export default function TeamsDirectoryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Equipos</h1>
        <p className="mt-1 text-sm text-muted">
          Directorio general de equipos registrados en la plataforma.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}
