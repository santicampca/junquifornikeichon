"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createNewsPhraseAction, deleteNewsPhraseAction } from "@/lib/admin-cms-actions";
import type { NewsCategory, NewsPhrase } from "@/types/domain";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

const CATEGORIES: NewsCategory[] = ["BLOWOUT", "COMFORTABLE", "NARROW", "DRAW", "FORFEIT"];

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  BLOWOUT: "Goleada",
  COMFORTABLE: "Victoria cómoda",
  NARROW: "Victoria ajustada",
  DRAW: "Empate",
  FORFEIT: "Walkover",
};

const CATEGORY_HELP: Record<NewsCategory, string> = {
  BLOWOUT: "Variables: {W} ganador, {L} perdedor, {WS} goles del ganador, {LS} goles del perdedor.",
  COMFORTABLE: "Variables: {W} ganador, {L} perdedor, {WS} goles del ganador, {LS} goles del perdedor.",
  NARROW: "Variables: {W} ganador, {L} perdedor, {WS} goles del ganador, {LS} goles del perdedor.",
  DRAW: "Variables: {A} y {B} equipos, {S} goles (mismo para ambos).",
  FORFEIT: "Variables: {W} el que ganó por walkover, {L} el que no se presentó.",
};

export function PhraseManager({ phrases }: { phrases: NewsPhrase[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<NewsCategory>("BLOWOUT");
  const [template, setTemplate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createNewsPhraseAction(category, template);
      setTemplate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la frase.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteNewsPhraseAction(id);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">Frases de las noticias</h2>
      <p className="mt-1 text-xs text-muted">
        Apenas una categoría tiene una frase propia acá, reemplaza por completo a las frases por defecto de esa
        categoría. Para cada resultado se elige una al azar (siempre la misma para el mismo partido).
      </p>

      <form onSubmit={handleAdd} className="mt-4 space-y-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as NewsCategory)}
          className={cn(inputClass, "w-full")}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted">{CATEGORY_HELP[category]}</p>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={2}
          placeholder="Escribí la frase usando las variables de arriba…"
          className={cn(inputClass, "w-full resize-none")}
        />
        {error && <p className="text-xs text-loss">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !template.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Guardando…" : "Agregar frase"}
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {phrases.length === 0 && (
          <p className="text-xs text-muted">Todavía no cargaste ninguna frase propia; se están usando las de por defecto.</p>
        )}
        {phrases.map((p) => (
          <li
            key={p.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                {CATEGORY_LABEL[p.category]}
              </span>
              <p className="text-sm text-foreground">{p.template}</p>
            </div>
            <button
              onClick={() => handleDelete(p.id)}
              className="shrink-0 text-muted hover:text-loss"
              aria-label="Eliminar frase"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
