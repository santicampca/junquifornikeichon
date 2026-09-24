"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const ADMIN_STORAGE_KEY = "torneosfc:admin:v1";

// Nombres aceptados para entrar en modo admin (sin distinguir
// mayúsculas/acentos/apóstrofes). Esto es una traba de conveniencia para la
// UI (oculta/muestra los botones); la Server Action del lado del servidor
// (src/lib/actions.ts) vuelve a validar el nombre antes de tocar la base,
// así que no alcanza con manipular el localStorage del navegador.
const ADMIN_ALLOWLIST = ["santiago", "zenits", "zenit s"];

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

interface AdminStoreValue {
  isAdmin: boolean;
  adminName: string | null;
  login: (name: string) => boolean;
  logout: () => void;
}

const AdminStoreContext = createContext<AdminStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
      // Hidratación intencional desde localStorage al montar: el valor solo
      // existe en el navegador, no se puede evitar este segundo render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setAdminName(raw);
    } catch {
      // ignorar (modo privado, storage bloqueado, etc.)
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
      <TeamAuthProvider>{children}</TeamAuthProvider>
    </AdminStoreContext.Provider>
  );
}

export function useAdmin(): AdminStoreValue {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) throw new Error("useAdmin debe usarse dentro de <AppStoreProvider>");
  return ctx;
}

// ============================================================
// SESIÓN DE EQUIPO (PIN de 3 dígitos)
// ============================================================

const TEAM_STORAGE_KEY = "torneosfc:team:v1";

interface TeamSessionValue {
  teamId: string;
  teamName: string;
}

interface TeamAuthValue {
  session: TeamSessionValue | null;
  setSession: (session: TeamSessionValue) => void;
  logout: () => void;
}

const TeamAuthContext = createContext<TeamAuthValue | null>(null);

function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<TeamSessionValue | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSessionState(JSON.parse(raw));
    } catch {
      // ignorar
    }
  }, []);

  const setSession = useCallback((next: TeamSessionValue) => {
    setSessionState(next);
    try {
      window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignorar
    }
  }, []);

  const logout = useCallback(() => {
    setSessionState(null);
    try {
      window.localStorage.removeItem(TEAM_STORAGE_KEY);
    } catch {
      // ignorar
    }
  }, []);

  return (
    <TeamAuthContext.Provider value={{ session, setSession, logout }}>{children}</TeamAuthContext.Provider>
  );
}

export function useTeamAuth(): TeamAuthValue {
  const ctx = useContext(TeamAuthContext);
  if (!ctx) throw new Error("useTeamAuth debe usarse dentro de <AppStoreProvider>");
  return ctx;
}
