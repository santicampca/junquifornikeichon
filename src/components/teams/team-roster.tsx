"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { createPlayerAction, deletePlayerAction, updatePlayerAction } from "@/lib/actions";
import type { Player } from "@/types/domain";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

interface PlayerFormState {
  name: string;
  number: string;
  position: string;
}

function emptyForm(): PlayerFormState {
  return { name: "", number: "", position: "" };
}

function toFormState(player: Player): PlayerFormState {
  return { name: player.name, number: player.number?.toString() ?? "", position: player.position ?? "" };
}

export function TeamRoster({ teamId, players }: { teamId: string; players: Player[] }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<PlayerFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PlayerFormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseInput(form: PlayerFormState) {
    return {
      name: form.name.trim(),
      number: form.number.trim() ? Number(form.number) : undefined,
      position: form.position.trim() || undefined,
    };
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!adminName) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPlayerAction(adminName, teamId, parseInput(addForm));
      setAddForm(emptyForm());
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el jugador.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: FormEvent, playerId: string) {
    e.preventDefault();
    if (!adminName) return;
    setSubmitting(true);
    setError(null);
    try {
      await updatePlayerAction(adminName, playerId, parseInput(editForm));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo editar el jugador.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(playerId: string) {
    if (!adminName) return;
    if (!window.confirm("¿Sacar a este jugador de la plantilla?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await deletePlayerAction(adminName, playerId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el jugador.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {players.length === 0 && !adding && (
        <p className="px-1 text-sm text-muted">Todavía no hay jugadores cargados.</p>
      )}

      <ul className="space-y-1.5">
        {players.map((player) =>
          editingId === player.id ? (
            <li key={player.id}>
              <form
                onSubmit={(e) => handleEdit(e, player.id)}
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/40 bg-surface-elevated p-2"
              >
                <input
                  value={editForm.number}
                  onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                  placeholder="#"
                  inputMode="numeric"
                  className={cn(inputClass, "w-14 text-center")}
                />
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre"
                  className={cn(inputClass, "min-w-0 flex-1")}
                />
                <input
                  value={editForm.position}
                  onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="Posición"
                  className={cn(inputClass, "w-32 shrink-0")}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-border px-2 py-1.5 text-muted hover:text-foreground"
                  aria-label="Cancelar"
                >
                  <X className="size-3.5" />
                </button>
              </form>
            </li>
          ) : (
            <li
              key={player.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-muted-strong">
                  {player.number ?? "-"}
                </span>
                <span className="truncate text-sm text-foreground">{player.name}</span>
                {player.position && (
                  <span className="shrink-0 text-xs text-muted">{player.position}</span>
                )}
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingId(player.id);
                      setEditForm(toFormState(player));
                    }}
                    className="text-muted hover:text-primary"
                    aria-label="Editar jugador"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(player.id)}
                    disabled={submitting}
                    className="text-muted hover:text-loss disabled:opacity-50"
                    aria-label="Eliminar jugador"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {error && <p className="text-xs text-loss">{error}</p>}

      {isAdmin &&
        (adding ? (
          <form
            onSubmit={handleAdd}
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/40 bg-surface-elevated p-2"
          >
            <input
              value={addForm.number}
              onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))}
              placeholder="#"
              inputMode="numeric"
              className={cn(inputClass, "w-14 text-center")}
            />
            <input
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre"
              autoFocus
              className={cn(inputClass, "min-w-0 flex-1")}
            />
            <input
              value={addForm.position}
              onChange={(e) => setAddForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="Posición"
              className={cn(inputClass, "w-32 shrink-0")}
            />
            <button
              type="submit"
              disabled={submitting || !addForm.name.trim()}
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddForm(emptyForm());
              }}
              className="rounded-md border border-border px-2 py-1.5 text-muted hover:text-foreground"
              aria-label="Cancelar"
            >
              <X className="size-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            Agregar jugador
          </button>
        ))}
    </div>
  );
}
