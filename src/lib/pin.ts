import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash de un PIN de 3 dígitos (login de equipo/DT). No es para proteger
 * nada sensible en serio —un PIN de 3 dígitos tiene 1000 combinaciones—,
 * es solo para no guardarlo en texto plano. Formato guardado: "salt:hash",
 * ambos en hex.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(8).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function isValidPin(pin: string): boolean {
  return /^\d{3}$/.test(pin);
}
