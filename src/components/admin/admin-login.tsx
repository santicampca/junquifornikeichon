"use client";

import { useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { useAdmin } from "@/lib/app-store";

export function AdminLogin() {
  const { isAdmin, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="size-3.5" />
          Modo administrador
        </span>
        <button onClick={logout} className="text-xs text-muted hover:text-foreground">
          Salir
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(secret);
    setSubmitting(false);
    setError(!ok);
    if (ok) {
      setOpen(false);
      setSecret("");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-strong transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <Shield className="size-4" />
        Admin
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-border bg-surface-elevated p-3 shadow-xl">
          <p className="mb-2 text-xs text-muted">Ingresá la clave de administrador del sitio.</p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              autoFocus
              type="password"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setError(false);
              }}
              placeholder="Clave de administrador"
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={submitting || !secret}
              className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "…" : "Entrar"}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-loss">Clave incorrecta.</p>}
        </div>
      )}
    </div>
  );
}
