"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Trophy } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { addChampionAction, deleteChampionAction } from "@/lib/actions";
import { EmptyState } from "@/components/ui/empty-state";
import type { Champion, Team } from "@/types/domain";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

export function PalmaresPanel({ champions, teams }: { champions: Champion[]; teams: Team[] }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [teamSlug, setTeamSlug] = useState(teams[0]?.slug ?? "");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!adminName) return;
    const team = teams.find((t) => t.slug === teamSlug);
    if (!team) {
      setError("Elegí un equipo.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await addChampionAction(adminName, { teamSlug: team.slug, teamName: team.name, year, title });
    if (result.success) {
      setTitle("");
      router.refresh();
    } else {
      setError(result.message);
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!adminName) return;
    await deleteChampionAction(adminName, id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAdmin && adminName && teams.length > 0 && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Equipo</label>
            <select value={teamSlug} onChange={(e) => setTeamSlug(e.target.value)} className={inputClass}>
              {teams.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Año</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={cn(inputClass, "w-24")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Apertura, Clausura, Supercopa, Playoffs…"
              className={cn(inputClass, "w-56")}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Guardando…" : "Agregar título"}
          </button>
          {error && <p className="w-full text-xs text-loss">{error}</p>}
        </form>
      )}

      {champions.length === 0 ? (
        <EmptyState icon={Trophy} title="Todavía no hay títulos cargados" />
      ) : (
        <ul className="space-y-2">
          {champions.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-semibold text-primary">{c.year}</span>
                <span className="mx-1.5 text-muted">·</span>
                <span className="text-foreground">{c.title}</span>
                <span className="mx-1.5 text-muted">—</span>
                <Link href={`/equipos/${c.teamSlug}`} className="font-medium text-foreground hover:underline">
                  {c.teamName}
                </Link>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(c.id)}
                  aria-label="Eliminar título"
                  className="shrink-0 text-muted hover:text-loss"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
