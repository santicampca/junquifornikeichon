"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { createNewsPhotoAction, deleteNewsPhotoAction } from "@/lib/admin-cms-actions";
import { compressImageFile } from "@/lib/image";
import type { NewsPhoto } from "@/types/domain";

export function PhotoManager({ photos }: { photos: NewsPhoto[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await compressImageFile(file);
      await createNewsPhotoAction(dataUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteNewsPhotoAction(id);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">Fotos de las noticias</h2>
      <p className="mt-1 text-xs text-muted">
        Banco general: para cada resultado se elige una foto al azar (siempre la misma para el mismo partido). Si
        no subís ninguna, la tarjeta usa el comprobante real del partido.
      </p>

      <div className="mt-4">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Upload className="size-3.5" />
          {uploading ? "Subiendo…" : "Subir foto"}
        </button>
        {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      </div>

      {photos.length === 0 ? (
        <p className="mt-4 text-xs text-muted">Todavía no subiste ninguna foto.</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-video overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, no CDN que optimizar */}
              <img src={photo.imageData} alt="" className="size-full object-cover" />
              <button
                onClick={() => handleDelete(photo.id)}
                aria-label="Eliminar foto"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/80 text-muted opacity-0 transition-opacity hover:text-loss group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
