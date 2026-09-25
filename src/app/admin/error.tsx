"use client";

import { useEffect } from "react";

export default function AdminError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-loss/40 bg-loss/10 p-4 text-sm text-loss">
        <p className="font-semibold">No se pudo cargar el panel de noticias.</p>
        <p className="mt-1">{error.message}</p>
        {error.digest && <p className="mt-1 text-xs opacity-70">Código: {error.digest}</p>}
      </div>
    </div>
  );
}
