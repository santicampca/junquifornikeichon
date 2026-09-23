import { type ClassValue, clsx } from "clsx";

/** Combina clases condicionalmente (wrapper fino sobre clsx). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Convierte un texto libre en un slug URL-safe (minúsculas, sin acentos/símbolos). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Genera un id corto y razonablemente único para entidades creadas en el cliente. */
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
