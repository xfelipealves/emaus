import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Emaús",
    short_name: "Emaús",
    description: "Acompanhamento de pessoas e vida comunitária da igreja.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf9f6",
    theme_color: "#b9532a",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Encontros", url: "/encontros" },
      { name: "Nova pessoa", url: "/pessoas?novo=1" },
    ],
  };
}
