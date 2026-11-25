/**
 * Catalogo centralizado de fontes de dados.
 *
 * Cada fonte tem um estado:
 *   REAL         — dado oficial, com responsavel, licenca e metodologia
 *   SIMULADO     — base demonstrativa, sempre identificada na interface
 *   INDISPONIVEL — exige credencial/autorizacao do Estado
 */
import { caminhoDados } from "./data.js";

export const STATUS = {
  REAL: "REAL",
  SIMULADO: "SIMULADO",
  INDISPONIVEL: "INDISPONIVEL",
};

const catalogo = {
  fontes: [],
  carregado: false,
  erro: null,
};

/** Carrega o catalogo (data/fontes.json). */
export async function carregarFontes() {
  if (catalogo.carregado) return catalogo.fontes;
  try {
    const resposta = await fetch(caminhoDados("fontes.json"), { cache: "no-cache" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const json = await resposta.json();
    catalogo.fontes = json.fontes || [];
    catalogo.carregado = true;
  } catch (erro) {
    catalogo.erro = String(erro.message || erro);
    console.warn("[fontes] catalogo indisponivel:", erro);
  }
  return catalogo.fontes;
}

/** Lista as fontes (carrega se necessario). */
export async function listarFontes() {
  if (!catalogo.carregado) await carregarFontes();
  return catalogo.fontes;
}

/** Filtra por estado. */
export async function fontesPorStatus(status) {
  const fontes = await listarFontes();
  return fontes.filter((f) => f.status === status);
}

/** Busca uma fonte pelo identificador. */
export async function obterFonte(id) {
  const fontes = await listarFontes();
  return fontes.find((f) => f.id === id) || null;
}

/** Resumo por estado (usado no topo da pagina de catalogo). */
export async function resumoFontes() {
  const fontes = await listarFontes();
  return fontes.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    },
    { total: 0 }
  );
}

export default { carregarFontes, listarFontes, fontesPorStatus, obterFonte, resumoFontes, STATUS };
