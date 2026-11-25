/**
 * Servico de dados — carrega as bases (reais e simuladas), normaliza os
 * registros e calcula recortes/indicadores a partir dos proprios registros.
 *
 * Regra do projeto: nunca misturar dado real e simulado sem sinalizacao.
 * Cada dataset carregado expoe `status` (REAL | SIMULADO).
 */
import { config } from "../config.js";
import { normalizar } from "../utils/format.js";

const BASE = import.meta.env.BASE_URL || "/";

/** Caminho absoluto do dataset dentro de `data/`. */
export function caminhoDados(nome) {
  return `${BASE.replace(/\/$/, "")}/data/${nome}`;
}

async function buscarJson(nome) {
  const resposta = await fetch(caminhoDados(nome), { cache: "no-cache" });
  if (!resposta.ok) throw new Error(`Falha ao carregar ${nome} (HTTP ${resposta.status})`);
  return resposta.json();
}

export const dados = {
  municipios: [],
  indicadoresMunicipais: {},
  anoPopulacao: null,
  anoPib: null,
  obras: [],
  contratos: [],
  ativos: [],
  convenios: [],
  maquinas: [],
  vistorias: [],
  serieInvestimento: [],
  viasEstaduais: [],
  rodovias: [],
  rodoviasExtensaoKm: null,
  ambiente: [],
  fontes: [],
  estado: "vazio",
};

/** Rastreia o carregamento para reportar falhas parciais com clareza. */
const relatorio = { ok: [], falhas: [] };

async function carregar(nome, aplicador) {
  try {
    const bruto = await buscarJson(nome);
    aplicador(bruto);
    relatorio.ok.push(nome);
  } catch (erro) {
    relatorio.falhas.push({ arquivo: nome, erro: String(erro.message || erro) });
    console.warn(`[dados] falha ao carregar ${nome}:`, erro);
  }
}

/** Carrega todas as bases necessarias para o funcionamento da plataforma. */
export async function carregarDados() {
  relatorio.ok = [];
  relatorio.falhas = [];

  await carregar("municipios.geojson", (geojson) => {
    dados.municipios = (geojson.features || []).map((f) => ({
      ...f.properties,
      geometria: f.geometry,
    }));
  });

  await carregar("indicadores-municipais.json", (json) => {
    dados.indicadoresMunicipais = json.municipios || {};
    dados.anoPopulacao = json.ano_populacao;
    dados.anoPib = json.ano_pib;
  });

  await carregar("obras-demo.geojson", (geojson) => {
    dados.obras = (geojson.features || []).map((f) => ({
      ...f.properties,
      geometria: f.geometry,
      status: "SIMULADO",
    }));
  });

  await carregar("contratos-demo.json", (json) => {
    dados.contratos = (json.contratos || []).map((c) => ({ ...c, status: "SIMULADO" }));
  });

  await carregar("ativos-demo.geojson", (geojson) => {
    dados.ativos = (geojson.features || []).map((f) => ({
      ...f.properties,
      geometria: f.geometry,
      status: "SIMULADO",
    }));
  });

  await carregar("convenios-demo.json", (json) => {
    dados.convenios = (json.convenios || []).map((c) => ({ ...c, status: "SIMULADO" }));
  });

  await carregar("maquinas-demo.json", (json) => {
    dados.maquinas = (json.maquinas || []).map((m) => ({ ...m, status: "SIMULADO" }));
  });

  await carregar("vistorias-demo.json", (json) => {
    dados.vistorias = (json.vistorias || []).map((v) => ({ ...v, status: "SIMULADO" }));
  });

  await carregar("serie-investimento-demo.json", (json) => {
    dados.serieInvestimento = json.serie || [];
  });

  await carregar("vias-estaduais.geojson", (geojson) => {
    dados.viasEstaduais = geojson.features || [];
  });

  // Malha rodoviaria federal (SNV/DNIT) — mantida como features GeoJSON
  // porque os modulos leem `f.properties` e `f.geometry` diretamente.
  await carregar("rodovias.geojson", (geojson) => {
    dados.rodovias = geojson.features || [];
    dados.rodoviasExtensaoKm = dados.rodovias.reduce(
      (soma, f) => soma + Number(f.properties?.extensao_km || 0),
      0
    );
  });

  // Areas de protecao e uso restrito (geometria oficial).
  await carregar("ambiente.geojson", (geojson) => {
    dados.ambiente = geojson.features || [];
  });

  await carregar("fontes.json", (json) => {
    dados.fontes = json.fontes || [];
  });

  dados.estado = relatorio.falhas.length ? "parcial" : "completo";
  return { relatorio: { ...relatorio }, estado: dados.estado };
}

/* ------------------------------------------------------------------ filtros */

function anoDe(registro) {
  const ref = registro.data_inicio || registro.vigencia_inicio || registro.data;
  if (!ref) return null;
  return Number(String(ref).slice(0, 4));
}

function dentroDoPeriodo(registro, filtros) {
  const ano = anoDe(registro);
  if (!ano) return true;
  return ano >= filtros.anoInicio && ano <= filtros.anoFim;
}

/** Aplica o conjunto de filtros globais a uma colecao de registros. */
export function aplicarFiltros(registros, filtros, tipo) {
  const busca = normalizar(filtros.busca);
  return registros.filter((r) => {
    if (filtros.municipio && r.municipio_codigo !== filtros.municipio && r.municipio !== filtros.municipioNome)
      return false;
    if (filtros.categoria && r.categoria !== filtros.categoria) return false;
    if (filtros.situacao && r.situacao !== filtros.situacao) return false;
    if (filtros.rodovia && r.rodovia !== filtros.rodovia) return false;
    if (filtros.orgao && r.orgao_responsavel !== filtros.orgao && r.orgao !== filtros.orgao) return false;
    if (filtros.fonteRecurso && r.fonte_recurso !== filtros.fonteRecurso) return false;
    if (!dentroDoPeriodo(r, filtros)) return false;
    if (filtros.apenasAtrasados) {
      const atrasado =
        r.situacao === "atrasada" ||
        r.situacao === "atrasado" ||
        r.situacao === "paralisada" ||
        r.situacao === "paralisado" ||
        (r.dias_atraso ?? 0) > 0;
      if (!atrasado) return false;
    }
    if (filtros.apenasCriticos) {
      const critico = r.criticidade === "critica" || r.criticidade === "alta" || r.condicao === "critica";
      if (!critico) return false;
    }
    if (busca) {
      const alvo = normalizar(
        [r.id, r.titulo, r.objeto, r.municipio, r.rodovia, r.empresa, r.contratada, r.tipo_nome, r.categoria_nome]
          .filter(Boolean)
          .join(" ")
      );
      if (!alvo.includes(busca)) return false;
    }
    if (tipo === "obras" && filtros.municipio && r.municipio_codigo !== filtros.municipio) return false;
    return true;
  });
}

/** Recorte completo: obras, contratos, ativos, convenios e maquinas filtrados. */
export function recortar(filtros) {
  return {
    obras: aplicarFiltros(dados.obras, filtros, "obras"),
    contratos: aplicarFiltros(dados.contratos, filtros, "contratos"),
    ativos: aplicarFiltros(dados.ativos, filtros, "ativos"),
    convenios: aplicarFiltros(dados.convenios, filtros, "convenios"),
    maquinas: aplicarFiltros(dados.maquinas, filtros, "maquinas"),
    vistorias: aplicarFiltros(dados.vistorias, filtros, "vistorias"),
  };
}

/* -------------------------------------------------------------- indicadores */

/** Consolida indicadores do painel executivo a partir dos registros. */
export function calcularIndicadores(recorte, filtros) {
  const obras = recorte.obras;
  const contratos = recorte.contratos;
  const ativos = recorte.ativos;
  const convenios = recorte.convenios;

  const valorObras = obras.reduce((acc, o) => acc + (o.valor_atualizado || 0), 0);
  const valorContratado = contratos.reduce((acc, c) => acc + (c.valor_atualizado || 0), 0);
  const valorPago = contratos.reduce((acc, c) => acc + (c.valor_pago || 0), 0);
  const valorEmpenhado = contratos.reduce((acc, c) => acc + (c.valor_empenhado || 0), 0);
  const valorLiquidado = contratos.reduce((acc, c) => acc + (c.valor_liquidado || 0), 0);
  const municipiosAtendidos = new Set(obras.map((o) => o.municipio_codigo)).size;

  const situacoes = {};
  config.situacoes.obra.forEach((s) => {
    situacoes[s.id] = obras.filter((o) => o.situacao === s.id).length;
  });

  const atrasoMedio = obras
    .filter((o) => (o.dias_atraso ?? 0) > 0)
    .reduce((acc, o) => acc + o.dias_atraso, 0) / Math.max(1, obras.filter((o) => (o.dias_atraso ?? 0) > 0).length);

  const execucaoMedia =
    obras.reduce((acc, o) => acc + (o.percentual_execucao_fisica || 0), 0) / Math.max(1, obras.length);

  const contratosAtrasados = contratos.filter(
    (c) => c.situacao === "atrasado" || c.situacao === "paralisado"
  ).length;
  const contratosVencendo = contratos.filter(
    (c) => c.situacao === "a_vencer" || (c.dias_para_vencer ?? 9999) <= 90
  ).length;

  const ativosCriticos = ativos.filter((a) => a.criticidade === "critica" || a.criticidade === "alta").length;

  const extensaoRodoviaria = dados.rodoviasExtensaoKm || null;

  return {
    obras: obras.length,
    contratos: contratos.length,
    ativos: ativos.length,
    convenios: convenios.length,
    maquinas: recorte.maquinas.length,
    municipiosAtendidos,
    totalMunicipios: dados.municipios.length,
    valorObras,
    valorContratado,
    valorEmpenhado,
    valorLiquidado,
    valorPago,
    saldoContratos: valorContratado - valorPago,
    situacoes,
    atrasoMedio,
    execucaoMedia,
    contratosAtrasados,
    contratosVencendo,
    ativosCriticos,
    extensaoRodoviaria,
    populacaoAtendida: [...new Set(obras.map((o) => o.municipio_codigo))].reduce(
      (acc, cod) => acc + (dados.indicadoresMunicipais[cod]?.populacao || 0),
      0
    ),
    filtros,
  };
}

/** Agregacao por municipio (para graficos e rankings). */
export function porMunicipio(registros, valorChave = "valor_atualizado") {
  const mapa = new Map();
  registros.forEach((r) => {
    const chave = r.municipio_codigo || r.municipio;
    if (!chave) return;
    const atual = mapa.get(chave) || {
      codigo: r.municipio_codigo,
      municipio: r.municipio,
      quantidade: 0,
      valor: 0,
    };
    atual.quantidade += 1;
    atual.valor += r[valorChave] || 0;
    mapa.set(chave, atual);
  });
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

/** Agregacao por chave generica (categoria, situacao, orgao...). */
export function agrupar(registros, chave, rotuloChave = null) {
  const mapa = new Map();
  registros.forEach((r) => {
    const k = r[chave];
    if (k === null || k === undefined) return;
    const atual = mapa.get(k) || { id: k, nome: rotuloChave ? r[rotuloChave] || k : k, quantidade: 0, valor: 0 };
    atual.quantidade += 1;
    atual.valor += r.valor_atualizado || r.valor || 0;
    mapa.set(k, atual);
  });
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
}

/** Distribuicao geografica dos registros por municipio (para mapa tematico). */
export function distribuicaoPorMunicipio(registros) {
  return porMunicipio(registros).map((m) => ({
    ...m,
    populacao: dados.indicadoresMunicipais[m.codigo]?.populacao || null,
    pib: dados.indicadoresMunicipais[m.codigo]?.pib_milhoes || null,
  }));
}

/* ------------------------------------------------------------------ busca */

/** Pesquisa global sobre as bases locais. */
export function buscar(term, limite = 12) {
  const alvo = normalizar(term);
  if (!alvo || alvo.length < 2) return [];
  const resultados = [];

  dados.municipios.forEach((m) => {
    if (normalizar(m.nome).includes(alvo)) {
      resultados.push({ tipo: "municipio", id: m.codigo_ibge, titulo: m.nome, detalhe: "Município de RO", rota: "#/municipios" });
    }
  });

  (dados.rodovias || []).forEach((r) => {
    const codigo = r.properties?.codigo_rodovia || r.codigo_rodovia;
    if (codigo && normalizar(codigo).includes(alvo)) {
      resultados.push({
        tipo: "rodovia",
        id: codigo,
        titulo: codigo,
        detalhe: `${r.properties?.jurisdicao || "Federal"} — ${r.properties?.extensao_km ?? "?"} km`,
        rota: "#/rodovias",
      });
    }
  });

  dados.obras.forEach((o) => {
    if (normalizar(`${o.id} ${o.titulo} ${o.municipio}`).includes(alvo)) {
      resultados.push({ tipo: "obra", id: o.id, titulo: o.titulo, detalhe: `${o.municipio} — ${o.situacao_nome}`, rota: "#/obras" });
    }
  });

  dados.contratos.forEach((c) => {
    if (normalizar(`${c.id} ${c.objeto} ${c.contratada}`).includes(alvo)) {
      resultados.push({ tipo: "contrato", id: c.id, titulo: `${c.id} — ${c.objeto}`, detalhe: c.contratada, rota: "#/contratos" });
    }
  });

  return resultados.slice(0, limite);
}

/** Registro por identificador (usado nas fichas). */
export function obterRegistro(tipo, id) {
  const colecoes = {
    obra: dados.obras,
    contrato: dados.contratos,
    ativo: dados.ativos,
    convenio: dados.convenios,
    maquina: dados.maquinas,
    vistoria: dados.vistorias,
    municipio: dados.municipios,
  };
  const colecao = colecoes[tipo] || [];
  return colecao.find((r) => r.id === id || r.codigo_ibge === id) || null;
}

/** Ficha completa de um municipio (indicadores + obras + contratos). */
export function fichaMunicipio(codigo) {
  const municipio = dados.municipios.find((m) => m.codigo_ibge === codigo);
  if (!municipio) return null;
  const indicadores = dados.indicadoresMunicipais[codigo] || {};
  const obras = dados.obras.filter((o) => o.municipio_codigo === codigo);
  const contratos = dados.contratos.filter((c) => c.municipio === municipio.nome);
  const ativos = dados.ativos.filter((a) => a.municipio_codigo === codigo);
  const convenios = dados.convenios.filter((c) => c.municipio_codigo === codigo);
  return { municipio, indicadores, obras, contratos, ativos, convenios };
}

export default dados;
