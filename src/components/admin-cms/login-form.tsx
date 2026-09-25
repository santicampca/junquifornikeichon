"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAdminUserAction } from "@/lib/admin-cms-actions";

const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary";

export function AdminLoginPanelForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAdminUserAction(username, password);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-sm space-y-3 rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="text-base font-semibold text-foreground">Panel de noticias</h2>
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
        autoComplete="current-password"
        className={inputClass}
      />
      {error && <p className="text-xs text-loss">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !username.trim() || !password}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
