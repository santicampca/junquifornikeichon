"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changeAdminPasswordAction, logoutAdminUserAction } from "@/lib/admin-cms-actions";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

export function AccountPanel({ username }: { username: string }) {
  const router = useRouter();
  const [changingPassword, setChangingPassword] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleLogout() {
    await logoutAdminUserAction();
    router.refresh();
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setSubmitting(true);
    try {
      await changeAdminPasswordAction(current, next);
      setCurrent("");
      setNext("");
      setChangingPassword(false);
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Conectado como {username}</p>
        {ok && <p className="text-xs text-win">Contraseña actualizada.</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setChangingPassword((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-strong hover:bg-surface-elevated"
        >
          Cambiar contraseña
        </button>
        <button
          onClick={handleLogout}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-strong hover:bg-surface-elevated"
        >
          Cerrar sesión
        </button>
      </div>

      {changingPassword && (
        <form onSubmit={handleChangePassword} className="flex w-full flex-wrap items-center gap-2 pt-2">
          <input
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            type="password"
            placeholder="Contraseña actual"
            className={cn(inputClass, "flex-1")}
          />
          <input
            value={next}
            onChange={(e) => setNext(e.target.value)}
            type="password"
            placeholder="Contraseña nueva"
            className={cn(inputClass, "flex-1")}
          />
          <button
            type="submit"
            disabled={submitting || !current || !next}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Guardar
          </button>
          {error && <p className="w-full text-xs text-loss">{error}</p>}
        </form>
      )}
    </div>
  );
}
