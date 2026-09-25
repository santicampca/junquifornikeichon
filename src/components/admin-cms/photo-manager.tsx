"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { createNewsPhotoAction, deleteNewsPhotoAction, setNewsPhotoPhraseAction } from "@/lib/admin-cms-actions";
import { compressImageFile } from "@/lib/image";
import { NEWS_CATEGORY_LABEL, type NewsPhoto, type NewsPhrase } from "@/types/domain";
import { cn } from "@/lib/utils";

const selectClass =
  "w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary";

function phraseLabel(phrase: NewsPhrase): string {
  return `${NEWS_CATEGORY_LABEL[phrase.category]}: ${phrase.template.slice(0, 40)}${phrase.template.length > 40 ? "…" : ""}`;
}

export function PhotoManager({ photos, phrases }: { photos: NewsPhoto[]; phrases: NewsPhrase[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhraseId, setUploadPhraseId] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await compressImageFile(file);
      const result = await createNewsPhotoAction(dataUrl, uploadPhraseId || null);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.message);
      }
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

  async function handleAffiliate(photoId: string, phraseId: string) {
    await setNewsPhotoPhraseAction(photoId, phraseId || null);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">Fotos de las noticias</h2>
      <p className="mt-1 text-xs text-muted">
        Afiliá cada foto a una frase: cuando esa frase le toque a un resultado, se usa esa foto (no una al azar de
        todo el banco). Una foto sin afiliar queda de reserva general, y se usa solo si la frase elegida no tiene
        ninguna propia. Si no hay ninguna foto disponible, la tarjeta usa el comprobante real del partido.
      </p>

      <div className="mt-4 space-y-2">
        <select
          value={uploadPhraseId}
          onChange={(e) => setUploadPhraseId(e.target.value)}
          className={cn(selectClass, "text-sm")}
        >
          <option value="">Sin afiliar (reserva general)</option>
          {phrases.map((p) => (
            <option key={p.id} value={p.id}>
              {phraseLabel(p)}
            </option>
          ))}
        </select>
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-border">
              <div className="relative aspect-video">
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
              <select
                value={photo.phraseId ?? ""}
                onChange={(e) => handleAffiliate(photo.id, e.target.value)}
                className={cn(selectClass, "rounded-none border-x-0 border-b-0")}
              >
                <option value="">Sin afiliar (reserva general)</option>
                {phrases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {phraseLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
