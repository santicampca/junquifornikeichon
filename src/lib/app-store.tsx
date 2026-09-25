"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { verifyAdminAccessAction } from "@/lib/actions";

const ADMIN_STORAGE_KEY = "torneosfc:admin:v1";

interface AdminStoreValue {
  isAdmin: boolean;
  adminName: string | null;
  login: (secret: string) => Promise<boolean>;
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

  // La verificación real pasa siempre por el servidor (ver
  // verifyAdminAccessAction en src/lib/actions.ts): antes esto comparaba
  // contra una lista de nombres públicos y adivinables en el propio
  // navegador; ahora hace falta la clave real, que nunca viaja al bundle
  // del cliente.
  const login = useCallback(async (secret: string) => {
    const trimmed = secret.trim();
    const result = await verifyAdminAccessAction(trimmed);
    if (result.success) {
      setAdminName(trimmed);
      try {
        window.localStorage.setItem(ADMIN_STORAGE_KEY, trimmed);
      } catch {
        // ignorar
      }
    }
    return result.success;
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

// Separado de TEAM_STORAGE_KEY a propósito: la sesión activa se borra al
// hacer "Salir", pero este marcador NO —así, aunque el participante cierre
// sesión, este navegador sigue "sabiendo" qué equipo ya reclamó y no lo deja
// crear un PIN para un segundo equipo (ver claimedTeamId más abajo).
const CLAIMED_TEAM_STORAGE_KEY = "torneosfc:team:claimed:v1";

interface TeamSessionValue {
  teamId: string;
  teamName: string;
}

interface TeamAuthValue {
  session: TeamSessionValue | null;
  /** Equipo que este navegador ya reclamó alguna vez (sobrevive al "Salir"). */
  claimedTeamId: string | null;
  setSession: (session: TeamSessionValue) => void;
  logout: () => void;
}

const TeamAuthContext = createContext<TeamAuthValue | null>(null);

function TeamAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<TeamSessionValue | null>(null);
  const [claimedTeamId, setClaimedTeamId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEAM_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSessionState(JSON.parse(raw));
    } catch {
      // ignorar
    }
    try {
      const claimed = window.localStorage.getItem(CLAIMED_TEAM_STORAGE_KEY);
      if (claimed) setClaimedTeamId(claimed);
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
    // Primera vez que este navegador queda logueado como algún equipo: lo
    // marca como "reclamado" para siempre (hasta que se borre el storage),
    // así después de un "Salir" no puede crear el PIN de otro equipo.
    setClaimedTeamId((prev) => {
      if (prev) return prev;
      try {
        window.localStorage.setItem(CLAIMED_TEAM_STORAGE_KEY, next.teamId);
      } catch {
        // ignorar
      }
      return next.teamId;
    });
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
    <TeamAuthContext.Provider value={{ session, claimedTeamId, setSession, logout }}>
      {children}
    </TeamAuthContext.Provider>
  );
}

export function useTeamAuth(): TeamAuthValue {
  const ctx = useContext(TeamAuthContext);
  if (!ctx) throw new Error("useTeamAuth debe usarse dentro de <AppStoreProvider>");
  return ctx;
}
