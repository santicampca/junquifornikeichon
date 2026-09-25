"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPin, verifyPin } from "@/lib/pin";
import { setAdminSessionCookie, clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import type { NewsCategory } from "@/types/domain";

const NEWS_CATEGORIES: NewsCategory[] = ["BLOWOUT", "COMFORTABLE", "NARROW", "DRAW", "FORFEIT"];

/**
 * Estas acciones devuelven { success, message } en vez de tirar un `throw`:
 * en producción, un error lanzado desde una Server Action que cruza al
 * cliente pierde su mensaje real (Next.js lo reemplaza por uno genérico
 * redactado, "Minified React error #441..."). Un valor de retorno es datos
 * comunes y corrientes — nunca se redacta — así que es la única forma de
 * que el usuario vea el motivo real de un error esperado (usuario
 * duplicado, contraseña corta, etc.). Errores realmente inesperados
 * también se capturan acá y se devuelven de la misma forma.
 */
export type ActionResult = { success: true } | { success: false; message: string };

function fail(message: string): ActionResult {
  return { success: false, message };
}

const ok: ActionResult = { success: true };

/**
 * Crea la primera (y única forma normal de crear una) cuenta del panel de
 * noticias. Solo funciona mientras no exista ninguna todavía: evita que
 * cualquiera que entre a /admin se registre como admin.
 */
export async function bootstrapAdminUserAction(username: string, password: string): Promise<ActionResult> {
  try {
    const existing = await prisma.adminUser.count();
    if (existing > 0) return fail("Ya existe una cuenta de administrador de noticias.");

    if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
      return fail("El usuario debe tener entre 3 y 24 caracteres (letras, números, punto, guion o guion bajo).");
    }
    if (password.length < 6) return fail("La contraseña necesita al menos 6 caracteres.");

    await prisma.adminUser.create({
      data: { username: username.trim(), passwordHash: hashPin(password) },
    });
    await setAdminSessionCookie(username.trim());
    revalidatePath("/admin");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
  }
}

export async function loginAdminUserAction(username: string, password: string): Promise<ActionResult> {
  try {
    const user = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
    if (!user || !verifyPin(password, user.passwordHash)) {
      return fail("Usuario o contraseña incorrectos.");
    }
    await setAdminSessionCookie(user.username);
    revalidatePath("/admin");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
  }
}

export async function logoutAdminUserAction(): Promise<ActionResult> {
  try {
    await clearAdminSessionCookie();
    revalidatePath("/admin");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo cerrar sesión.");
  }
}

export async function changeAdminPasswordAction(currentPassword: string, newPassword: string): Promise<ActionResult> {
  try {
    const session = await requireAdminSession();
    if (newPassword.length < 6) return fail("La contraseña necesita al menos 6 caracteres.");

    const user = await prisma.adminUser.findUnique({ where: { username: session.username } });
    if (!user || !verifyPin(currentPassword, user.passwordHash)) {
      return fail("La contraseña actual no es correcta.");
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: hashPin(newPassword) },
    });
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
  }
}

// ============================================================
// Banco de frases (titulares) por categoría de resultado
// ============================================================

export async function createNewsPhraseAction(category: NewsCategory, template: string): Promise<ActionResult> {
  try {
    await requireAdminSession();

    if (!NEWS_CATEGORIES.includes(category)) return fail("Categoría inválida.");
    const trimmed = template.trim();
    if (!trimmed) return fail("La frase no puede estar vacía.");
    if (trimmed.length > 300) return fail("La frase es demasiado larga (máximo 300 caracteres).");

    await prisma.newsPhrase.create({ data: { category, template: trimmed } });
    revalidatePath("/admin");
    revalidatePath("/");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo guardar la frase.");
  }
}

export async function deleteNewsPhraseAction(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await prisma.newsPhrase.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo eliminar la frase.");
  }
}

// ============================================================
// Banco de fotos para las tarjetas de noticias
// ============================================================

export async function createNewsPhotoAction(imageDataUrl: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    if (!imageDataUrl.startsWith("data:image/")) return fail("La foto no tiene un formato válido.");

    await prisma.newsPhoto.create({ data: { imageData: imageDataUrl } });
    revalidatePath("/admin");
    revalidatePath("/");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo subir la foto.");
  }
}

export async function deleteNewsPhotoAction(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession();
    await prisma.newsPhoto.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/");
    return ok;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No se pudo eliminar la foto.");
  }
}
