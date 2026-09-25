import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las canciones de la Playlist se suben como data URL (base64) a
    // través de una Server Action (ver addPlaylistTrackAction), que por
    // default limita el body a 1MB — muy poco para un audio. Subido a un
    // techo cómodo por debajo del límite duro de Vercel para requests
    // (~4.5MB en Hobby, no configurable): ver MAX_AUDIO_BYTES en
    // playlist-panel.tsx para el tope real que ve el usuario.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
