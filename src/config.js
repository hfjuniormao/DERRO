/**
 * CENTRAL INFRA RO 360 — Configuracao central.
 *
 * Toda a configuracao vem de variaveis de ambiente (prefixo VITE_) para que
 * nenhuma credencial fique gravada no codigo. Ver .env.example.
 */

const env = import.meta.env || {};

/** Chave da API ArcGIS (opcional). Sem chave, os mapas basepublicos do Esri continuam funcionando. */
export const ARCGIS_API_KEY = env.VITE_ARCGIS_API_KEY || "";

/** Portal ArcGIS usado para OAuth 2.0 (producao). */
export const ARCGIS_PORTAL_ID = env.VITE_ARCGIS_PORTAL_ID || "";

/** Client ID do aplicativo ArcGIS (apenas frontend publico — nunca segredos). */
export const ARCGIS_CLIENT_ID = env.VITE_ARCGIS_CLIENT_ID || "";

/** URL do backend de producao (FastAPI). Vazio = modo demonstracao local. */
export const API_BASE_URL = env.VITE_API_BASE_URL || "";

/** Modo de operacao dos dados. */
export const MODO_DADOS = env.VITE_MODO_DADOS || "demonstracao"; // "demonstracao" | "producao"

/** Ativa o service worker (PWA). */
export const PWA_ATIVO = env.VITE_PWA_ATIVO !== "false";

export const APP = {
  nome: "CENTRAL INFRA RO 360",
  nomeCurto: "Central INFRA RO",
  subtitulo: "Plataforma de Inteligencia Geografica de Infraestrutura e Logistica",
  uf: "Rondonia",
  sigla: "RO",
  orgao: "Governo do Estado de Rondonia",
  orgaoSecundario: "DER-RO / DEOSP",
};

/** Centro e zoom iniciais do Estado de Rondonia (SIRGAS 2000 / WGS84). */
export const VIEW_INICIAL = {
  center: [-63.0, -11.0],
  zoom: 7,
  padding: { top: 60, bottom: 60 },
};

/** Servicos geoespaciaispublicos utilizados. */
export const SERVICOS = {
  geocodificador: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
  sugestao: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest",
  localizador: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
  snvRodovias: "https://services8.arcgis.com/WnoZVgMq9I8Pjaoc/arcgis/rest/services/Rodovias/FeatureServer/0",
  viasRodarias: "https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/Rondonia_Roads/FeatureServer/0",
  areasProtegidas: "https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/Rondonia_Protected_Forests/FeatureServer/0",
  sedesMunicipais:
    "https://services2.arcgis.com/j80Jz20at6Bi0thr/arcgis/rest/services/Rondonia_Cities/FeatureServer/0",
  // A malha municipal usada na plataforma NAO vem de FeatureServer: as camadas
  // "Municipios de Rondonia" publicadas no ArcGIS Online tem geometria
  // inflada. A base adotada e a oficial do IBGE (2020) via geoBoundaries.
  malhaMunicipal: "https://www.geoboundaries.org/",
};

/**
 * Mapas base oficiais da Esri (galeria ArcGIS Online).
 *
 * Cada entrada traz o endpoint do servico (`url`) e o caminho do tile
 * (`tiles`) — os MapServer do Esri servem tiles em `{url}/tile/{z}/{y}/{x}`.
 * Todos os enderecos abaixo foram verificados contra o catalogo publico
 * `https://services.arcgisonline.com/ArcGIS/rest/services`.
 */
export const BASEMAPS = [
  {
    id: "streets",
    nome: "Ruas",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    id: "satellite",
    nome: "Satelite",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    id: "hybrid",
    nome: "Hibrido",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    id: "topographic",
    nome: "Topografico",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    id: "gray",
    nome: "Cartografia cinza",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    id: "dark",
    nome: "Cartografia escura",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    id: "terrain",
    nome: "Terreno",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer",
    tiles: "/tile/{z}/{y}/{x}",
  },
  {
    // Tiles do proprio OpenStreetMap (nao e servico Esri) — template {z}/{x}/{y}
    id: "osm",
    nome: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tiles: "{z}/{x}/{y}.png",
  },
];

/** Rotulos (reference labels) do Esri — exibidos acima da basemap. */
export const ROTULOS = {
  ref: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer",
  trn: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
  tiles: "/tile/{z}/{y}/{x}",
};

/** Endpoints REST de dados abertos (nunca inventar URLs — todos verificados). */
export const ENDPOINTS_ABERTOS = [
  { id: "snv", titulo: "Sistema Nacional de Viaria (SNV)", formato: "GeoJSON/CSV", url: SERVICOS.snvRodovias, status: "REAL" },
  { id: "vias", titulo: "Malha viaria de Rondonia", formato: "GeoJSON", url: SERVICOS.viasRodarias, status: "REAL" },
  { id: "areas", titulo: "Areas de protecao e uso restrito", formato: "GeoJSON", url: SERVICOS.areasProtegidas, status: "REAL" },
  { id: "municipios", titulo: "Limites municipais (IBGE 2020, via geoBoundaries)", formato: "GeoJSON", url: SERVICOS.malhaMunicipal, status: "REAL" },
  { id: "sedes", titulo: "Sedes municipais", formato: "GeoJSON/CSV", url: SERVICOS.sedesMunicipais, status: "REAL" },
  { id: "ibge", titulo: "IBGE — localidades, populacao e PIB", formato: "JSON", url: "https://servicodados.ibge.gov.br/api/v1/localidades/municipios", status: "REAL" },
  { id: "geocode", titulo: "Esri — geocodificacao mundial", formato: "JSON", url: SERVICOS.geocodificador, status: "REAL" },
];

/** Perfis de acesso (controle real e feito no backend; aqui apenas a apresentacao). */
export const PERFIS = [
  { id: "cidadao", nome: "Cidadao", descricao: "Consulta publica de dados e indicadores." },
  { id: "gestor", nome: "Gestor executivo", descricao: "Indicadores consolidados e comparacoes." },
  { id: "analista", nome: "Analista GIS", descricao: "Camadas, consultas espaciais e exportacoes." },
  { id: "fiscal", nome: "Fiscal de campo", descricao: "Vistorias, evidencias e checklists." },
  { id: "contratos", nome: "Gestor de contratos", descricao: "Contratos, aditivos e pagamentos." },
  { id: "admin", nome: "Administrador", descricao: "Usuarios, perfis e trilha de auditoria." },
];

/** Rotulos de situacao — usados em filtros, tabelas e fichas. */
export const SITUACOES = {
  obra: [
    { id: "planejada", nome: "Planejada" },
    { id: "em_execucao", nome: "Em execucao" },
    { id: "atrasada", nome: "Atrasada" },
    { id: "paralisada", nome: "Paralisada" },
    { id: "concluida", nome: "Concluida" },
    { id: "cancelada", nome: "Cancelada" },
  ],
  contrato: [
    { id: "vigente", nome: "Vigente" },
    { id: "a_vencer", nome: "A vencer" },
    { id: "atrasado", nome: "Atrasado" },
    { id: "paralisado", nome: "Paralisado" },
    { id: "encerrado", nome: "Encerrado" },
    { id: "rescindido", nome: "Rescindido" },
  ],
  convenio: [
    { id: "vigente", nome: "Vigente" },
    { id: "execucao", nome: "Em execucao" },
    { id: "atrasado", nome: "Atrasado" },
    { id: "concluido", nome: "Concluido" },
    { id: "cancelado", nome: "Cancelado" },
  ],
  maquina: [
    { id: "operacional", nome: "Operacional" },
    { id: "manutencao", nome: "Em manutencao" },
    { id: "inoperante", nome: "Inoperante" },
    { id: "afastada", nome: "Afastada" },
  ],
};

/** Categorias do APP 03. */
export const CATEGORIAS_OBRA = [
  { id: "pavimentacao", nome: "Pavimentacao", cor: "#0B6E4F" },
  { id: "recuperacao_rodoviaria", nome: "Recuperacao rodoviaria", cor: "#1F8A70" },
  { id: "pontes", nome: "Pontes", cor: "#0B2545" },
  { id: "drenagem", nome: "Drenagem", cor: "#2E7DAF" },
  { id: "escolas", nome: "Escolas", cor: "#C9A227" },
  { id: "hospitais", nome: "Hospitais", cor: "#B23A48" },
  { id: "predios_publicos", nome: "Predios publicos", cor: "#5B4B8A" },
  { id: "infraestrutura_urbana", nome: "Infraestrutura urbana", cor: "#3A7D44" },
  { id: "outras_obras", nome: "Outras obras", cor: "#6B7280" },
];

/** Criticidade dos ativos (APP 05). */
export const CRITICIDADE = {
  baixa: { nome: "Baixa", cor: "#2E7DAF" },
  media: { nome: "Media", cor: "#C9A227" },
  alta: { nome: "Alta", cor: "#D97A1F" },
  critica: { nome: "Critica", cor: "#B23A48" },
};

/** Criterios da matriz multicriterio (APP 12). */
export const CRITERIOS_PLANEJAMENTO = [
  { id: "populacao", nome: "Populacao beneficiada", peso: 20, sentido: "maior" },
  { id: "impacto", nome: "Impacto economico", peso: 15, sentido: "maior" },
  { id: "criticidade", nome: "Criticidade da infraestrutura", peso: 20, sentido: "maior" },
  { id: "acessibilidade", nome: "Acessibilidade", peso: 10, sentido: "maior" },
  { id: "custo", nome: "Custo estimado", peso: 10, sentido: "menor" },
  { id: "risco_ambiental", nome: "Risco ambiental", peso: 10, sentido: "menor" },
  { id: "maturidade", nome: "Maturidade do projeto", peso: 8, sentido: "maior" },
  { id: "orcamento", nome: "Disponibilidade orcamentaria", peso: 7, sentido: "maior" },
];

export const config = {
  app: APP,
  apiKey: ARCGIS_API_KEY,
  portalId: ARCGIS_PORTAL_ID,
  clientId: ARCGIS_CLIENT_ID,
  apiBaseUrl: API_BASE_URL,
  modoDados: MODO_DADOS,
  pwaAtivo: PWA_ATIVO,
  viewInicial: VIEW_INICIAL,
  servicos: SERVICOS,
  basemaps: BASEMAPS,
  rotulos: ROTULOS,
  endpointsAbertos: ENDPOINTS_ABERTOS,
  perfis: PERFIS,
  situacoes: SITUACOES,
  categoriasObra: CATEGORIAS_OBRA,
  criticidade: CRITICIDADE,
  criteriosPlanejamento: CRITERIOS_PLANEJAMENTO,
  producao: API_BASE_URL.length > 0,
};

export default config;
