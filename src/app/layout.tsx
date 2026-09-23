import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { AppStoreProvider } from "@/lib/app-store";
import { getActiveTournamentState } from "@/lib/data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Torneos FC | Gestión de torneos amateur",
  description:
    "Plataforma para crear, programar y seguir torneos de fútbol amateur entre amigos.",
};

// La app entera lee el torneo activo desde Mongo en cada request (admin
// puede reiniciar/crear un torneo en cualquier momento), así que no tiene
// sentido cachear/pre-renderizar nada de forma estática.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const activeTournament = await getActiveTournamentState();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppStoreProvider>
          <Navbar activeTournamentSlug={activeTournament?.tournament.slug} />
          <main className="flex-1">{children}</main>
        </AppStoreProvider>
      </body>
    </html>
  );
}
