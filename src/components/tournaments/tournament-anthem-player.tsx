"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Intenta reproducir el himno solo con el navegador (autoplay); casi todos
 * los navegadores lo bloquean si todavía no hubo ninguna interacción del
 * usuario en el sitio, así que si `.play()` rechaza queda un botón
 * flotante para arrancarlo con un solo toque.
 */
export function TournamentAnthemPlayer({ audioData }: { audioData: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.5;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setNeedsTap(true));
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setNeedsTap(false);
        })
        .catch(() => setNeedsTap(true));
    }
  }

  return (
    <>
      <audio ref={audioRef} src={audioData} loop onEnded={() => setPlaying(false)} />
      <button
        onClick={toggle}
        aria-label={playing ? "Silenciar himno" : "Reproducir himno"}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-2 text-xs font-medium text-muted-strong shadow-lg transition-colors hover:text-foreground",
          needsTap && !playing && "border-primary/50 text-primary",
        )}
      >
        {playing ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        {needsTap && !playing ? "Reproducir himno" : "Himno"}
      </button>
    </>
  );
}
