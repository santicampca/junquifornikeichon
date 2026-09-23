"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { demoTournamentState } from "@/lib/mock-data";
import {
  createTournamentState,
  resetTournamentState,
  type CreateTournamentConflict,
  type CreateTournamentInput,
} from "@/lib/tournament-factory";
import type { TournamentState } from "@/types/domain";

const STATE_STORAGE_KEY = "torneosfc:state:v1";
const ADMIN_STORAGE_KEY = "torneosfc:admin:v1";

// Nombres aceptados para entrar en modo admin (sin distinguir
// mayúsculas/acentos/apóstrofes). Esto es una traba de conveniencia del
// lado del cliente, no autenticación real: no hay backend que la valide.
const ADMIN_ALLOWLIST = ["santiago", "zenits", "zenit s"];

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Torneo activo: estado en memoria + persistido en localStorage
// ---------------------------------------------------------------------------

export interface CreateTournamentOutcome {
  tournamentSlug: string;
  conflicts: CreateTournamentConflict[];
}

interface TournamentStoreValue {
  state: TournamentState;
  resetTournament: () => void;
  createTournament: (input: CreateTournamentInput) => CreateTournamentOutcome;
}

const TournamentStoreContext = createContext<TournamentStoreValue | null>(null);

function TournamentStoreProvider({ children }: { children: ReactNode }) {
  // El primer render (servidor y cliente) siempre parte de los datos de
  // demo para que coincidan y no haya mismatch de hidratación; la versión
  // guardada en localStorage se carga después, en el efecto de abajo.
  const [state, setState] = useState<TournamentState>(demoTournamentState);
  // `isHydrated` viaja en el mismo setState que la carga desde localStorage
  // (no en un ref) para que ambos cambios lleguen juntos en un solo re-render.
  // Si no fuera así, el efecto de persistencia de abajo podría ejecutarse
  // entre medio con el estado de demo todavía en su closure y pisar lo que
  // se acababa de guardar (bug real que se dio así en pruebas manuales).
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
      // Hidratación intencional desde localStorage al montar: el valor solo
      // existe en el navegador, así que no se puede evitar este segundo
      // render (mismo patrón que next-themes/zustand persist).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw) as TournamentState);
    } catch {
      // localStorage corrupto/inaccesible (modo privado, etc.): seguimos con la demo.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return; // evita pisar localStorage antes de haber intentado leerlo
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Cuota excedida o storage bloqueado: no es crítico, se sigue viendo la app.
    }
  }, [state, isHydrated]);

  const resetTournament = useCallback(() => {
    setState((current) => resetTournamentState(current));
  }, []);

  const createTournament = useCallback((input: CreateTournamentInput) => {
    const { state: nextState, conflicts } = createTournamentState(input);
    setState(nextState);
    return { tournamentSlug: nextState.tournament.slug, conflicts };
  }, []);

  return (
    <TournamentStoreContext.Provider value={{ state, resetTournament, createTournament }}>
      {children}
    </TournamentStoreContext.Provider>
  );
}

export function useTournamentStore(): TournamentStoreValue {
  const ctx = useContext(TournamentStoreContext);
  if (!ctx) throw new Error("useTournamentStore debe usarse dentro de <AppStoreProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Modo admin (traba de conveniencia, no seguridad real)
// ---------------------------------------------------------------------------

interface AdminStoreValue {
  isAdmin: boolean;
  adminName: string | null;
  login: (name: string) => boolean;
  logout: () => void;
}

const AdminStoreContext = createContext<AdminStoreValue | null>(null);

function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage al montar, ver comentario equivalente arriba
      if (raw) setAdminName(raw);
    } catch {
      // ignorar
    }
  }, []);

  const login = useCallback((name: string) => {
    const ok = ADMIN_ALLOWLIST.includes(normalizeName(name));
    if (ok) {
      const trimmed = name.trim();
      setAdminName(trimmed);
      try {
        window.localStorage.setItem(ADMIN_STORAGE_KEY, trimmed);
      } catch {
        // ignorar
      }
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    setAdminName(null);
    try {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // ignorar
    }
  }, []);

  return (
    <AdminStoreContext.Provider value={{ isAdmin: adminName !== null, adminName, login, logout }}>
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdmin(): AdminStoreValue {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) throw new Error("useAdmin debe usarse dentro de <AppStoreProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------

export function AppStoreProvider({ children }: { children: ReactNode }) {
  return (
    <AdminStoreProvider>
      <TournamentStoreProvider>{children}</TournamentStoreProvider>
    </AdminStoreProvider>
  );
}
