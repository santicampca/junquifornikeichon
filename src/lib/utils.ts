import { type ClassValue, clsx } from "clsx";

/** Combina clases condicionalmente (wrapper fino sobre clsx). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
