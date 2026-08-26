#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://madada.fr";
const outputPath = path.resolve("data/dada-rag.json");
const progressPath = path.resolve("data/dada-rag-progress.json");
const apiKey = process.env.OPENROUTER_API_KEY;
const all = process.argv.includes("--all");
const pagesArgument = process.argv.indexOf("--pages");
const maxPages = Math.max(1, Number(process.argv[pagesArgument + 1] || 10));
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const vectorDimensions = 256;

if (!apiKey) throw new Error("OPENROUTER_API_KEY is required. Load .env.local before running this command.");

async function fetchWithRetry(url, options, attempts = 4) {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status === 404 || (response.status >= 400 && response.status < 500)) return response;
      failure = new Error(`${url} failed (${response.status})`);
    } catch (error) {
      failure = error;
    }
    if (attempt < attempts) await delay(1_000 * attempt);
  }
  throw failure;
}

function clean(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function parsePage(html) {
  const links = [...html.matchAll(/<a[^>]+href="(\/request\/[^"?#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  const results = new Map();
  for (const link of links) {
    const href = link[1];
    if (results.has(href)) continue;
    const title = clean(link[2]);
    const near = clean(html.slice(Math.max(0, link.index - 180), link.index + 1_100));
    const authority = near.match(/(?:Demande envoyée à|Réponse de)\s+(.+?)\s+(?:le|Il y a|En attente|$)/i)?.[1] || "Autorité non précisée";
    const status = near.match(/(En attente de réponse|Demande aboutie|Demande non aboutie|Erreur lors de l’envoi)/i)?.[1];
    results.set(href, { title, authority: clean(authority), url: `${baseUrl}${href}`, status, excerpt: near.slice(0, 800) });
  }
  return [...results.values()];
}

async function embeddings(texts) {
  const response = await fetchWithRetry("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "qwen/qwen3-embedding-8b", input: texts }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`OpenRouter embeddings failed (${response.status}): ${await response.text()}`);
  const body = await response.json();
  return body.data?.sort((a, b) => a.index - b.index).map((item) => item.embedding) || [];
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthRanges() {
  const ranges = [];
  const current = new Date(Date.UTC(2010, 0, 1));
  const today = new Date();
  while (current <= today) {
    const after = new Date(current);
    const before = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    ranges.push({ id: isoDate(after).slice(0, 7), after: isoDate(after), before: isoDate(before) });
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return ranges;
}

function listUrl(page, range) {
  const params = new URLSearchParams({ page: String(page) });
  if (range) {
    params.set("request_date_after", range.after);
    params.set("request_date_before", range.before);
  }
  return `${baseUrl}/list/?${params}`;
}

let existing = { version: 1, embeddingModel: "qwen/qwen3-embedding-8b", dimensions: vectorDimensions, indexedAt: null, documents: [] };
try { existing = JSON.parse(await readFile(outputPath, "utf8")); } catch { /* first index */ }
let progress = null;
try { progress = JSON.parse(await readFile(progressPath, "utf8")); } catch { /* first complete import */ }
const knownUrls = new Set(existing.documents.map((document) => document.url));
let added = 0;

const ranges = all ? monthRanges() : [null];
for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
  const range = ranges[rangeIndex];
  if (range && progress) {
    const checkpointIndex = ranges.findIndex((item) => item.id === progress.rangeId);
    if (checkpointIndex >= 0 && rangeIndex < checkpointIndex) continue;
  }
  if (range) console.log(`Période ${range.after} → ${range.before}`);
  // Ma Dada expose au plus 20 pages par résultat de recherche. Les tranches mensuelles
  // évitent donc le plafond de 500 résultats de la liste générale.
  const firstPage = range && progress?.rangeId === range.id ? progress.nextPage : 1;
  const lastPage = all ? 20 : maxPages;
  let page = firstPage;
  while (page <= lastPage) {
    const pages = Array.from({ length: Math.min(4, lastPage - page + 1) }, (_, index) => page + index);
    const responses = await Promise.all(pages.map(async (pageNumber) => {
      const response = await fetchWithRetry(listUrl(pageNumber, range), { headers: { "User-Agent": "Chat-DADA RAG indexer/1.0" } });
      if (response.status === 404) return { pageNumber, documents: null };
      if (!response.ok) throw new Error(`Ma Dada page ${pageNumber} failed (${response.status})`);
      return { pageNumber, documents: parsePage(await response.text()) };
    }));
    const completed = responses.filter((result) => result.documents?.length);
    if (!completed.length) break;
    const batches = completed
      .map((result) => result.documents.filter((document) => !knownUrls.has(document.url)))
      .filter((batch) => batch.length);
    const vectorBatches = await Promise.all(batches.map((batch) => embeddings(batch.map((document) => `Titre : ${document.title}\nAutorité : ${document.authority}\nStatut : ${document.status || "non précisé"}\n${document.excerpt}`))));
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      const vectors = vectorBatches[batchIndex];
      existing.documents.push(...batch.map((document, index) => ({ ...document, embedding: vectors[index].slice(0, vectorDimensions) })));
      batch.forEach((document) => knownUrls.add(document.url));
      added += batch.length;
    }
    const documents = batches.flat();
    if (documents.length) {
      existing.indexedAt = new Date().toISOString();
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(existing));
    }
    const lastCompletedPage = completed.at(-1).pageNumber;
    if (range) {
      progress = { rangeId: range.id, nextPage: lastCompletedPage + 1, updatedAt: new Date().toISOString() };
      await writeFile(progressPath, JSON.stringify(progress, null, 2));
    }
    console.log(`  Pages ${page}–${lastCompletedPage} traitées — ${added} nouvelles demandes.`);
    if (completed.length < pages.length) break;
    page += pages.length;
    await delay(350);
  }
  if (range) {
    const nextRange = ranges[rangeIndex + 1];
    progress = nextRange ? { rangeId: nextRange.id, nextPage: 1, updatedAt: new Date().toISOString() } : null;
    if (progress) await writeFile(progressPath, JSON.stringify(progress, null, 2));
  }
}

console.log(`Index terminé : ${existing.documents.length} demandes au total.`);
