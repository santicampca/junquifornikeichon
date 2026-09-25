"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { updateTournamentRulesAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function EditTournamentRules({ tournamentId, rules }: { tournamentId: string; rules?: string }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rules ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) {
    return rules ? (
      <p className="whitespace-pre-wrap text-sm text-muted-strong">{rules}</p>
    ) : (
      <p className="text-sm text-muted">Todavía no hay reglamento cargado.</p>
    );
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        {rules ? (
          <p className="whitespace-pre-wrap text-sm text-muted-strong">{rules}</p>
        ) : (
          <p className="text-sm text-muted">Todavía no hay reglamento cargado.</p>
        )}
        <button
          onClick={() => {
            setValue(rules ?? "");
            setEditing(true);
          }}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Pencil className="size-3.5" />
          {rules ? "Editar reglamento" : "Cargar reglamento"}
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminName) return;
    setSubmitting(true);
    setError(null);
    const result = await updateTournamentRulesAction(adminName, tournamentId, value);
    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={10}
        autoFocus
        placeholder="Escribí acá el reglamento del torneo…"
        className={cn(
          "w-full resize-y rounded-md border border-primary bg-background px-2.5 py-1.5 text-sm text-foreground outline-none",
        )}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <X className="size-3.5" />
          Cancelar
        </button>
        {error && <span className="text-xs text-loss">{error}</span>}
      </div>
    </form>
  );
}
