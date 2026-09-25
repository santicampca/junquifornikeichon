import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión del panel /admin (login real de usuario/clave, separado del
 * nombre-admin liviano de src/lib/actions.ts). Cookie firmada con HMAC
 * (ADMIN_SESSION_SECRET): sin tabla de sesiones, el propio token lleva el
 * usuario y el vencimiento, y la firma evita que se pueda falsificar sin
 * conocer el secreto del server.
 */

const SESSION_COOKIE = "torneosfc:admin_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("Falta configurar ADMIN_SESSION_SECRET en el servidor.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(username: string): string {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): { username: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; exp: number };
    if (typeof data.u !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}

/** Solo se puede llamar desde una Server Action o Route Handler. */
export async function setAdminSessionCookie(username: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encode(username), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getAdminSession(): Promise<{ username: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? decode(token) : null;
}

/** Tira error si no hay sesión válida; usarlo al principio de cada acción del panel. */
export async function requireAdminSession(): Promise<{ username: string }> {
  const session = await getAdminSession();
  if (!session) throw new Error("Necesitás iniciar sesión como administrador de noticias.");
  return session;
}
