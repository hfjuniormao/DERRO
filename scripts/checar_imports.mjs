#!/usr/bin/env node
/**
 * Verificador de importacoes nomeadas.
 *
 * Para cada `import { a, b } from "./x.js"` em src/ confirma que o modulo de
 * destino realmente exporta os nomes solicitados. Erros de digitacao em nomes
 * (ex.: `cardaoIndicador` x `cartaoIndicador`) quebram em runtime e nao em
 * tempo de compilacao quando o binding nao e usado.
 *
 * Uso: node scripts/checar_imports.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");

function listarArquivos(dir, acc = []) {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) listarArquivos(caminho, acc);
    else if (entrada.endsWith(".js")) acc.push(caminho);
  }
  return acc;
}

/** Coleta os nomes exportados por um modulo ESM. */
function exportsDo(caminho) {
  const src = readFileSync(caminho, "utf8");
  const nomes = new Set();

  // export function nome / export async function nome / export class nome
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    nomes.add(m[1]);
  }
  // export { a, b as c }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const parte of m[1].split(",")) {
      const limpo = parte.trim();
      if (!limpo) continue;
      const as = limpo.split(/\s+as\s+/);
      nomes.add((as[1] || as[0]).trim());
    }
  }
  // export default
  if (/export\s+default\b/.test(src)) nomes.add("default");
  return nomes;
}

const arquivos = listarArquivos(SRC);
const cache = new Map();
const problemas = [];

for (const arquivo of arquivos) {
  const src = readFileSync(arquivo, "utf8");
  const re = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    const [nomesCru, especificador] = [m[1], m[2]];
    if (!especificador.startsWith(".")) continue; // pacotes externos

    const destino = resolve(dirname(arquivo), especificador);
    if (!cache.has(destino)) cache.set(destino, exportsDo(destino));
    const disponiveis = cache.get(destino);

    for (const parte of nomesCru.split(",")) {
      const bruto = parte.trim();
      if (!bruto) continue;
      const as = bruto.split(/\s+as\s+/);
      const original = as[0].trim();
      if (!original) continue;
      if (!disponiveis.has(original)) {
        problemas.push({
          arquivo: arquivo.replace(`${RAIZ}/`, ""),
          especificador,
          nome: original,
          disponiveis: [...disponiveis].sort().join(", ") || "(nenhum)",
        });
      }
    }
  }
}

if (!problemas.length) {
  console.log(`Imports verificados em ${arquivos.length} arquivos: todos os nomes exportados existem.`);
  process.exit(0);
}

console.log(`Imports quebrados: ${problemas.length}`);
for (const p of problemas) {
  console.log(`  ${p.arquivo} -> ${p.especificador}: "${p.nome}" nao e exportado.`);
  console.log(`     exports disponiveis: ${p.disponiveis}`);
}
process.exit(1);
