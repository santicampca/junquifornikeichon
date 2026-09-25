"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Music, Trash2, Upload } from "lucide-react";
import { useAdmin } from "@/lib/app-store";
import { addPlaylistTrackAction, deletePlaylistTrackAction } from "@/lib/actions";
import { readFileAsDataUrl } from "@/lib/file";
import { EmptyState } from "@/components/ui/empty-state";
import type { PlaylistTrack } from "@/types/domain";
import { cn } from "@/lib/utils";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function PlaylistPanel({ tracks }: { tracks: PlaylistTrack[] }) {
  const router = useRouter();
  const { isAdmin, adminName } = useAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !adminName) return;
    if (!title.trim()) {
      setError("Poné un título antes de elegir el archivo.");
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError("El archivo es demasiado pesado (máx. ~15MB); probá un mp3 más liviano.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await addPlaylistTrackAction(adminName, title, dataUrl);
      if (result.success) {
        setTitle("");
        router.refresh();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la canción.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!adminName) return;
    await deletePlaylistTrackAction(adminName, id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAdmin && adminName && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la canción"
            className={cn(
              "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary",
            )}
          />
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !title.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {uploading ? "Subiendo…" : "Subir canción"}
          </button>
          {error && <p className="text-xs text-loss">{error}</p>}
        </div>
      )}

      {tracks.length === 0 ? (
        <EmptyState icon={Music} title="Todavía no hay canciones en la playlist" />
      ) : (
        <ul className="space-y-2">
          {tracks.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{t.title}</span>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    aria-label="Eliminar canción"
                    className="shrink-0 text-muted hover:text-loss"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <audio controls preload="none" src={t.audioData} className="w-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
