"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPin, verifyPin } from "@/lib/pin";
import { setAdminSessionCookie, clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-session";
import type { NewsCategory } from "@/types/domain";

const NEWS_CATEGORIES: NewsCategory[] = ["BLOWOUT", "COMFORTABLE", "NARROW", "DRAW", "FORFEIT"];

function assertValidUsername(username: string) {
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
    throw new Error("El usuario debe tener entre 3 y 24 caracteres (letras, números, punto, guion o guion bajo).");
  }
}

function assertValidPassword(password: string) {
  if (password.length < 6) throw new Error("La contraseña necesita al menos 6 caracteres.");
}

/**
 * Crea la primera (y única forma normal de crear una) cuenta del panel de
 * noticias. Solo funciona mientras no exista ninguna todavía: evita que
 * cualquiera que entre a /admin se registre como admin.
 */
export async function bootstrapAdminUserAction(username: string, password: string): Promise<void> {
  const existing = await prisma.adminUser.count();
  if (existing > 0) throw new Error("Ya existe una cuenta de administrador de noticias.");

  assertValidUsername(username);
  assertValidPassword(password);

  await prisma.adminUser.create({
    data: { username: username.trim(), passwordHash: hashPin(password) },
  });
  await setAdminSessionCookie(username.trim());
  revalidatePath("/admin");
}

export async function loginAdminUserAction(username: string, password: string): Promise<void> {
  const user = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
  if (!user || !verifyPin(password, user.passwordHash)) {
    throw new Error("Usuario o contraseña incorrectos.");
  }
  await setAdminSessionCookie(user.username);
  revalidatePath("/admin");
}

export async function logoutAdminUserAction(): Promise<void> {
  await clearAdminSessionCookie();
  revalidatePath("/admin");
}

export async function changeAdminPasswordAction(currentPassword: string, newPassword: string): Promise<void> {
  const session = await requireAdminSession();
  assertValidPassword(newPassword);

  const user = await prisma.adminUser.findUnique({ where: { username: session.username } });
  if (!user || !verifyPin(currentPassword, user.passwordHash)) {
    throw new Error("La contraseña actual no es correcta.");
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: hashPin(newPassword) },
  });
}

// ============================================================
// Banco de frases (titulares) por categoría de resultado
// ============================================================

export async function createNewsPhraseAction(category: NewsCategory, template: string): Promise<void> {
  await requireAdminSession();

  if (!NEWS_CATEGORIES.includes(category)) throw new Error("Categoría inválida.");
  const trimmed = template.trim();
  if (!trimmed) throw new Error("La frase no puede estar vacía.");
  if (trimmed.length > 300) throw new Error("La frase es demasiado larga (máximo 300 caracteres).");

  await prisma.newsPhrase.create({ data: { category, template: trimmed } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteNewsPhraseAction(id: string): Promise<void> {
  await requireAdminSession();
  await prisma.newsPhrase.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}

// ============================================================
// Banco de fotos para las tarjetas de noticias
// ============================================================

export async function createNewsPhotoAction(imageDataUrl: string): Promise<void> {
  await requireAdminSession();

  if (!imageDataUrl.startsWith("data:image/")) throw new Error("La foto no tiene un formato válido.");

  await prisma.newsPhoto.create({ data: { imageData: imageDataUrl } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteNewsPhotoAction(id: string): Promise<void> {
  await requireAdminSession();
  await prisma.newsPhoto.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}
