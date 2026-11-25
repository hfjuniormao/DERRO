#!/usr/bin/env node
/**
 * Verificacao estrutural do CENTRAL INFRA RO 360.
 *
 * Confere, sem depender do navegador:
 *  1. se todas as rotas declaradas em src/main.js têm módulo correspondente;
 *  2. se todos os datasets referenciados existem em data/;
 *  3. se nenhum módulo importa um arquivo inexistente;
 *  4. se os arquivos do catálogo de fontes existem.
 *
 * Uso: npm run lint
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const DATA = join(RAIZ, "data");
const problemas = [];
const avisos = [];

/* --------------------------------------------------- 1. rotas x módulos */
const main = readFileSync(join(SRC, "main.js"), "utf8");
const rotas = [...main.matchAll(/id:\s*"([^"]+)"[\s\S]*?carga:\s*\(\)\s*=>\s*import\("\.\/modules\/([^"]+)"\)/g)].map(
  (m) => ({ id: m[1], arquivo: m[2] })
);

if (!rotas.length) problemas.push("Nenhuma rota encontrada em src/main.js.");

for (const rota of rotas) {
  const caminho = join(SRC, "modules", rota.arquivo);
  if (!existsSync(caminho)) {
    problemas.push(`Rota "${rota.id}" aponta para módulo inexistente: src/modules/${rota.arquivo}`);
  }
}

/* --------------------------------------------- 2. datasets obrigatórios */
const datasetsObrigatorios = [
  "municipios.geojson",
  "indicadores-municipais.json",
  "obras-demo.geojson",
  "contratos-demo.json",
  "ativos-demo.geojson",
  "convenios-demo.json",
  "maquinas-demo.json",
  "vistorias-demo.json",
  "serie-investimento-demo.json",
  "vias-estaduais.geojson",
  "rodovias.geojson",
  "ambiente.geojson",
  "convenios-demo.geojson",
  "maquinas-demo.geojson",
  "fontes.json",
];

for (const arquivo of datasetsObrigatorios) {
  const caminho = join(DATA, arquivo);
  if (!existsSync(caminho)) {
    problemas.push(`Dataset ausente em data/: ${arquivo}`);
    continue;
  }
  const tamanho = statSync(caminho).size;
  if (tamanho < 50) problemas.push(`Dataset vazio ou corrompido: data/${arquivo}`);
}

/* ------------------------------------- 3. imports resolvem dentro de src */
function listarJs(diretorio) {
  const saida = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...listarJs(caminho));
    else if (entrada.endsWith(".js")) saida.push(caminho);
  }
  return saida;
}

for (const arquivo of listarJs(SRC)) {
  const conteudo = readFileSync(arquivo, "utf8");
  const imports = [...conteudo.matchAll(/from\s+"(\.[^"]+)"/g)].map((m) => m[1]);
  for (const spec of imports) {
    const destino = resolve(dirname(arquivo), spec);
    if (!existsSync(destino)) {
      problemas.push(`Import inválido em ${arquivo.replace(`${RAIZ}/`, "")}: "${spec}"`);
    }
  }
}

/* ------------------- 3b. todo módulo com `montar` precisa montar no container */
/*
 * Um modulo que cria a pagina mas nunca a anexa ao container abre uma rota
 * VAZIA — sem erro no console e sem quebra do build. Esta verificacao impede
 * a regressao.
 */
for (const arquivo of listarJs(join(SRC, "modules"))) {
  const nome = arquivo.replace(`${RAIZ}/`, "");
  if (nome.includes("/_")) continue; // auxiliares sem `montar`
  const conteudo = readFileSync(arquivo, "utf8");
  if (!/export\s+async\s+function\s+montar\s*\(/.test(conteudo)) continue;
  if (!/container\.append\s*\(/.test(conteudo)) {
    problemas.push(`Módulo ${nome} exporta "montar" mas nunca anexa a página ao container (rota abriria vazia).`);
  }
}

/* ------------------------------------------------ 4. catálogo de fontes */
const fontesPath = join(DATA, "fontes.json");
if (existsSync(fontesPath)) {
  const fontes = JSON.parse(readFileSync(fontesPath, "utf8")).fontes || [];
  const validos = new Set(["REAL", "SIMULADO", "INDISPONIVEL"]);
  for (const fonte of fontes) {
    if (!validos.has(fonte.status)) {
      problemas.push(`Fonte "${fonte.id}" com status inválido: ${fonte.status}`);
    }
    for (const campo of ["titulo", "descricao", "orgao", "fonte", "metodologia", "qualidade"]) {
      if (!fonte[campo]) avisos.push(`Fonte "${fonte.id}" sem o campo "${campo}".`);
    }
  }
  const contagem = fontes.reduce((acc, f) => ({ ...acc, [f.status]: (acc[f.status] || 0) + 1 }), {});
  console.log(`Fontes catalogadas: ${contagem.REAL || 0} real, ${contagem.SIMULADO || 0} simuladas, ${contagem.INDISPONIVEL || 0} indisponíveis.`);
}

/* ------------------------------------------------------ 5. segredos */
const padroesSegredo = [/client_secret\s*[:=]\s*["'][^"']{8,}/i, /api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{20,}/i];
for (const arquivo of [...listarJs(SRC), ...listarJs(join(RAIZ, "backend"))]) {
  const conteudo = readFileSync(arquivo, "utf8");
  for (const padrao of padroesSegredo) {
    if (padrao.test(conteudo)) {
      problemas.push(`Possível segredo embutido em ${arquivo.replace(`${RAIZ}/`, "")}`);
    }
  }
}

/* -------------------------------------------------------- resultado */
console.log(`Rotas verificadas: ${rotas.length}.`);
avisos.forEach((aviso) => console.log(`AVISO: ${aviso}`));
problemas.forEach((problema) => console.log(`PROBLEMA: ${problema}`));

if (problemas.length) {
  console.error(`\nEstrutura inválida: ${problemas.length} problema(s).`);
  process.exit(1);
}
console.log("\nEstrutura válida.");
