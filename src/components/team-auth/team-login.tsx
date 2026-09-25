"use client";

import { useState, type FormEvent } from "react";
import { UserCircle2 } from "lucide-react";
import { useTeamAuth } from "@/lib/app-store";
import { loginTeamAction, setTeamPinAction } from "@/lib/actions";
import type { Team } from "@/types/domain";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary";

export function TeamLogin({ teams }: { teams: Team[] }) {
  const { session, claimedTeamId, setSession, logout } = useTeamAuth();
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-muted-strong">
          <UserCircle2 className="size-3.5" />
          {session.teamName}
        </span>
        <button onClick={logout} className="text-xs text-muted hover:text-foreground">
          Salir
        </button>
      </div>
    );
  }

  if (teams.length === 0) return null;

  const selectedTeam = teams.find((t) => t.id === teamId);
  const needsPinCreation = selectedTeam ? !selectedTeam.hasPin : false;
  // Este navegador ya reclamó un equipo antes (aunque haya hecho "Salir"):
  // no lo deja crear el PIN de uno distinto, para que un mismo
  // participante no termine "teniendo" dos equipos.
  const blockedByOtherClaim = needsPinCreation && claimedTeamId !== null && teamId !== claimedTeamId;

  function resetForm() {
    setTeamId("");
    setPin("");
    setConfirmPin("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setError("Elegí tu equipo.");
      return;
    }
    if (blockedByOtherClaim) {
      setError("Este dispositivo ya está asociado a otro equipo; no podés crear el PIN de uno nuevo acá.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (needsPinCreation) {
        if (pin !== confirmPin) throw new Error("Los PIN no coinciden.");
        const result = await setTeamPinAction(teamId, pin, claimedTeamId);
        setSession(result);
      } else {
        const result = await loginTeamAction(teamId, pin);
        setSession(result);
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-strong transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <UserCircle2 className="size-4" />
        Mi equipo
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-surface-elevated p-3 shadow-xl">
          <p className="mb-2 text-xs text-muted">
            Elegí tu equipo/DT. Si es la primera vez, creás un PIN de 3 números; si ya lo tenés, lo ingresás.
          </p>
          <form onSubmit={handleSubmit} className="space-y-2">
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setPin("");
                setConfirmPin("");
                setError(null);
              }}
              className={cn(inputClass, "w-full")}
            >
              <option value="">Equipo o DT…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.managerName})
                </option>
              ))}
            </select>

            {teamId && blockedByOtherClaim && (
              <p className="text-xs text-loss">
                Este dispositivo ya está asociado a otro equipo; no podés crear el PIN de uno nuevo acá.
              </p>
            )}

            {teamId && !blockedByOtherClaim && (
              <>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={3}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder={needsPinCreation ? "Creá tu PIN (3 números)" : "Tu PIN (3 números)"}
                  autoFocus
                  className={cn(inputClass, "w-full")}
                />
                {needsPinCreation && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={3}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="Repetí el PIN"
                    className={cn(inputClass, "w-full")}
                  />
                )}
              </>
            )}

            <button
              type="submit"
              disabled={submitting || !teamId || pin.length !== 3 || blockedByOtherClaim}
              className="w-full rounded-md bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "…" : needsPinCreation ? "Crear PIN y entrar" : "Entrar"}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-loss">{error}</p>}
        </div>
      )}
    </div>
  );
}
