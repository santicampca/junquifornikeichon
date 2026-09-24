"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { updateTournamentNameAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function EditTournamentName({
  tournamentId,
  name,
  className,
}: {
  tournamentId: string;
  name: string;
  className?: string;
}) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !adminName) {
    return <h1 className={className}>{name}</h1>;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <h1 className={className}>{name}</h1>
        <button
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          className="text-muted hover:text-primary"
          aria-label="Editar nombre de la liga"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminName) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateTournamentNameAction(adminName, tournamentId, value);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el nombre.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className={cn(
          "rounded-md border border-primary bg-background px-2 py-1 text-lg font-bold text-foreground outline-none",
        )}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "…" : "Guardar"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-muted hover:text-foreground"
        aria-label="Cancelar"
      >
        <X className="size-4" />
      </button>
      {error && <span className="text-xs text-loss">{error}</span>}
    </form>
  );
}
