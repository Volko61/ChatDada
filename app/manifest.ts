import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chat DADA — Explorer les demandes publiques",
    short_name: "Chat DADA",
    description: "Explorez les demandes administratives françaises publiées sur Ma Dada avec l’aide de l’intelligence artificielle.",
    lang: "fr-FR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2e9",
    theme_color: "#143a30",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}
