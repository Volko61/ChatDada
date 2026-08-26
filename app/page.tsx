import { Chat } from "./ui/chat";
import { siteUrl } from "../lib/site";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl.toString(),
      name: "Chat DADA",
      description: "Explorez les demandes administratives françaises publiées sur Ma Dada avec l’aide de l’intelligence artificielle.",
      inLanguage: "fr-FR"
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#application`,
      url: siteUrl.toString(),
      name: "Chat DADA",
      description: "Un assistant pour rechercher et comprendre les demandes administratives publiques françaises.",
      applicationCategory: "SearchApplication",
      operatingSystem: "Web",
      inLanguage: "fr-FR",
      isPartOf: { "@id": `${siteUrl}/#website` }
    }
  ]
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <main>
        <section className="hero">
          <h1>Chat <em>DADA</em></h1>
          <p>Parcourez les documents administratifs français par IA.</p>
        </section>
        <Chat />
        <footer>Les données affichées proviennent de <a href="https://madada.fr/" target="_blank" rel="noreferrer">Ma Dada</a>. Chat DADA est un outil indépendant et ne remplace pas la source originale.</footer>
      </main>
    </>
  );
}
