import { ShieldCheck } from "lucide-react";
import { getAdminSession } from "@/lib/admin-session";
import { hasAdminUser, getNewsPhrasesForAdmin, getNewsPhotosForAdmin } from "@/lib/data";
import { BootstrapForm } from "@/components/admin-cms/bootstrap-form";
import { AdminLoginPanelForm } from "@/components/admin-cms/login-form";
import { AccountPanel } from "@/components/admin-cms/account-panel";
import { PhraseManager } from "@/components/admin-cms/phrase-manager";
import { PhotoManager } from "@/components/admin-cms/photo-manager";
import type { NewsPhoto, NewsPhrase } from "@/types/domain";

export default async function AdminPage() {
  let loadError: string | null = null;
  let bootstrapped = false;
  let session: { username: string } | null = null;
  let phrases: NewsPhrase[] = [];
  let photos: NewsPhoto[] = [];

  try {
    bootstrapped = await hasAdminUser();
    session = bootstrapped ? await getAdminSession() : null;
    if (session) {
      [phrases, photos] = await Promise.all([getNewsPhrasesForAdmin(), getNewsPhotosForAdmin()]);
    }
  } catch (err) {
    // Capturado a propósito: sin esto, Next.js reemplaza cualquier error acá
    // por un mensaje genérico redactado en producción ("Minified React error
    // #441"), sin dar ninguna pista de qué falló. Mostrarlo directo en la
    // página es temporal, solo para diagnosticar.
    loadError = err instanceof Error ? `${err.name}: ${err.message}\n\n${err.stack ?? ""}` : String(err);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Panel de noticias</h1>
          <p className="text-sm text-muted">Frases y fotos que arman los titulares del dashboard.</p>
        </div>
      </div>

      {loadError ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-loss/40 bg-loss/10 p-4 text-xs text-loss">
          {loadError}
        </pre>
      ) : (
        <>
          {!bootstrapped && <BootstrapForm />}
          {bootstrapped && !session && <AdminLoginPanelForm />}
          {bootstrapped && session && (
            <div className="space-y-4">
              <AccountPanel username={session.username} />
              <PhraseManager phrases={phrases} />
              <PhotoManager photos={photos} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
