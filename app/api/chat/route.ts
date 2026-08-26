import { searchRag, type DadaSource } from "../../../lib/rag";

export const runtime = "nodejs";
export const maxDuration = 90;

type Source = DadaSource;

const BASE = "https://madada.fr";
const FRENCH_STOP_WORDS = new Set([
  "avec", "dans", "demande", "demandes", "des", "document", "documents", "dont", "est", "font", "les", "leur", "mes", "moi", "pour", "plus", "quelles", "quel", "recherche", "sur", "sont", "trouve", "trouver", "une", "vous", "concernant", "concernent"
]);

function clean(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

async function searchMaDada(question: string): Promise<Source[]> {
  const keywords = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-zA-Z0-9]{3,}/g) || [];
  const terms = keywords.filter((word) => !FRENCH_STOP_WORDS.has(word)).slice(0, 5).join(" ") || question;
  const url = `${BASE}/list/?query=${encodeURIComponent(terms)}`;
  const response = await fetch(url, { headers: { "User-Agent": "Chat-DADA/1.0 (+https://madada.fr/)" }, next: { revalidate: 300 } });
  if (!response.ok) throw new Error("Ma Dada n’est pas accessible pour le moment.");
  const html = await response.text();
  const links = [...html.matchAll(/<a[^>]+href="(\/request\/[^"?#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  const results = new Map<string, Source>();
  for (const link of links) {
    const href = link[1];
    if (results.has(href)) continue;
    const title = clean(link[2]);
    const near = clean(html.slice(Math.max(0, link.index! - 180), link.index! + 900));
    const authority = near.match(/(?:Demande envoyée à|Réponse de)\s+(.+?)\s+(?:le|Il y a|En attente|$)/i)?.[1] || "Autorité non précisée";
    const status = near.match(/(En attente de réponse|Demande aboutie|Demande non aboutie|Erreur lors de l’envoi)/i)?.[1];
    results.set(href, { title, authority: clean(authority), status, excerpt: near.slice(0, 420), url: `${BASE}${href}` });
    if (results.size === 6) break;
  }
  return [...results.values()];
}

function sourceFallback(sources: Source[]) {
  const lines = sources.map((source, index) => {
    const status = source.status ? ` — ${source.status}` : "";
    return `${index + 1}. ${source.title} · ${source.authority}${status}`;
  });
  return `L’assistant IA est temporairement indisponible, mais voici les demandes Ma Dada trouvées pour votre recherche :\n\n${lines.join("\n")}\n\nOuvrez les sources ci-dessous pour consulter le contenu complet.`;
}

async function generateInferxText(system: string, prompt: string) {
  const apiKey = process.env.INFERX_API_KEY;
  if (!apiKey) throw new Error("InferX is not configured");
  const response = await fetch("https://model.inferx.net/endpoints/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-v4-flash-0731",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 400
    }),
    signal: AbortSignal.timeout(55_000)
  });
  if (!response.ok) throw new Error(`InferX request failed (${response.status})`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const rawText = body.choices?.[0]?.message?.content?.trim();
  const text = rawText?.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, "").trim();
  if (!text) throw new Error("InferX returned an empty response");
  return text;
}

export async function POST(request: Request) {
  let sources: Source[] = [];
  try {
    const { question, history = [] } = await request.json();
    if (typeof question !== "string" || question.trim().length < 2) return Response.json({ error: "Posez une question un peu plus précise." }, { status: 400 });
    sources = (await searchRag(question)) ?? await searchMaDada(question);
    if (!sources.length) return Response.json({ text: "Je n’ai pas trouvé de demande publiée correspondant à cette recherche. Essayez avec des mots-clés plus simples ou le nom d’une administration.", sources: [] });
    if (!process.env.INFERX_API_KEY) return Response.json({ error: "La clé InferX n’est pas configurée côté serveur." }, { status: 500 });
    const context = sources.map((s, i) => `[${i + 1}] ${s.title}\nAutorité : ${s.authority}\nStatut : ${s.status || "non précisé"}\nExtrait : ${s.excerpt}`).join("\n\n");
    const previous = Array.isArray(history) ? history.map((m: { role?: string; content?: string }) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${String(m.content || "")}`).join("\n") : "";
    const text = await generateInferxText(
      "Tu es Chat DADA, un assistant français de consultation des demandes publiques de Ma Dada. Réponds uniquement à partir des résultats fournis. Sois concis, factuel et nuancé. Ne prétends jamais avoir lu une page non fournie. Quand tu relies une affirmation à un résultat, indique [1], [2], etc. S'il manque une information, dis-le. N'invente ni statut, ni date, ni contenu.",
      `Historique récent:\n${previous}\n\nQuestion: ${question}\n\nRésultats Ma Dada:\n${context}`
    );
    return Response.json({ text, sources: sources.map(({ excerpt, ...source }) => source) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Chat DADA error", message || "unknown error");
    if (message.startsWith("InferX") || message === "InferX is not configured") {
      // La liste récupérée reste fiable et permet de consulter le service sans inventer de synthèse.
      return Response.json({ text: sourceFallback(sources), sources: sources.map(({ excerpt, ...source }) => source) });
    }
    return Response.json({ error: "Une erreur est survenue pendant la recherche. Réessayez dans un instant." }, { status: 500 });
  }
}
