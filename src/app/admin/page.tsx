import { ShieldCheck } from "lucide-react";
import { getAdminSession } from "@/lib/admin-session";
import { hasAdminUser, getNewsPhrasesForAdmin, getNewsPhotosForAdmin } from "@/lib/data";
import { BootstrapForm, AdminLoginPanelForm } from "@/components/admin-cms/auth-forms";
import { AccountPanel } from "@/components/admin-cms/account-panel";
import { PhraseManager } from "@/components/admin-cms/phrase-manager";
import { PhotoManager } from "@/components/admin-cms/photo-manager";

export default async function AdminPage() {
  const [bootstrapped, session] = await Promise.all([hasAdminUser(), getAdminSession()]);

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

      {!bootstrapped ? (
        <BootstrapForm />
      ) : !session ? (
        <AdminLoginPanelForm />
      ) : (
        <PanelContent username={session.username} />
      )}
    </div>
  );
}

async function PanelContent({ username }: { username: string }) {
  const [phrases, photos] = await Promise.all([getNewsPhrasesForAdmin(), getNewsPhotosForAdmin()]);

  return (
    <div className="space-y-4">
      <AccountPanel username={username} />
      <PhraseManager phrases={phrases} />
      <PhotoManager photos={photos} />
    </div>
  );
}
