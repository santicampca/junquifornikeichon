"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { bootstrapAdminUserAction } from "@/lib/admin-cms-actions";

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

export function BootstrapForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    const result = await bootstrapAdminUserAction(username, password);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.message);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-sm space-y-3 rounded-xl border border-border bg-surface p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">Crear cuenta de administrador</h2>
        <p className="mt-1 text-xs text-muted">
          Es la primera vez que se abre este panel: elegí tu usuario y contraseña. Después de esto nadie más va a
          poder crear una cuenta nueva.
        </p>
      </div>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Usuario"
        autoComplete="username"
        className={inputClass}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="Contraseña"
        autoComplete="new-password"
        className={inputClass}
      />
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        type="password"
        placeholder="Repetir contraseña"
        autoComplete="new-password"
        className={inputClass}
      />
      {error && <p className="text-xs text-loss">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !username.trim() || !password}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
