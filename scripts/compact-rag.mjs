#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve("data/dada-rag.json");
const temporaryPath = `${outputPath}.compact`;
const dimensions = 256;

const index = JSON.parse(await readFile(outputPath, "utf8"));
index.dimensions = dimensions;
index.documents = index.documents.map((document) => ({
  ...document,
  embedding: document.embedding.slice(0, dimensions)
}));

await writeFile(temporaryPath, JSON.stringify(index));
await rename(temporaryPath, outputPath);
console.log(`Index compacté : ${index.documents.length} demandes, ${dimensions} dimensions.`);
