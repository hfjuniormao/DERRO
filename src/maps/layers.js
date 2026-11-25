/**
 * Catalogo de camadas do Geoportal (APP 15) e definicoes de renderizacao.
 * Cada camada informa sua origem (REAL/SIMULADO) para ser exibida no painel.
 */
import { config } from "../config.js";

const marcador = (cor, tamanho = 7) => ({
  type: "simple-marker",
  style: "circle",
  color: cor,
  size: tamanho,
  outline: { color: "#ffffff", width: 1.2 },
});

const linha = (cor, largura = 2) => ({
  type: "simple-line",
  color: cor,
  width: largura,
  style: "solid",
});

/** Simbolos por valor unico (categoria, criticidade, situacao...). */
function renderizadorUnico(campo, mapaValores, simboloPadrao) {
  return {
    type: "unique-value",
    field: campo,
    defaultSymbol: simboloPadrao,
    uniqueValueInfos: Object.entries(mapaValores).map(([valor, simbolo]) => ({ value: valor, symbol: simbolo })),
  };
}

const CORES_SITUACAO = {
  planejada: "#9aa7b2",
  em_execucao: "#1f8a70",
  atrasada: "#d97a1f",
  paralisada: "#b23a48",
  concluida: "#0b2545",
  cancelada: "#6b7a88",
  vigente: "#1f8a70",
  a_vencer: "#c9a227",
  atrasado: "#d97a1f",
  paralisado: "#b23a48",
  encerrado: "#6b7a88",
  rescindido: "#9aa7b2",
  execucao: "#2e7daf",
  concluido: "#0b2545",
  cancelado: "#9aa7b2",
  operacional: "#1f8a70",
  manutencao: "#c9a227",
  inoperante: "#b23a48",
  afastada: "#9aa7b2",
};

const CORES_CRITICIDADE = {
  baixa: "#2e7daf",
  media: "#c9a227",
  alta: "#d97a1f",
  critica: "#b23a48",
};

/** Grupos do catalogo de camadas (APP 15). */
export const GRUPOS_CAMADAS = [
  { id: "administrativos", nome: "Limites administrativos" },
  { id: "rodoviario", nome: "Infraestrutura rodoviaria" },
  { id: "obras", nome: "Obras" },
  { id: "contratos", nome: "Contratos" },
  { id: "pontes", nome: "Pontes e ativos" },
  { id: "logistica", nome: "Logistica" },
  { id: "convenios", nome: "Convenios" },
  { id: "maquinas", nome: "Maquinas" },
  { id: "ambiente", nome: "Meio ambiente" },
  { id: "socioeconomicos", nome: "Indicadores socioeconormicos" },
  { id: "planejamento", nome: "Planejamento" },
  { id: "riscos", nome: "Riscos territoriais" },
];

/**
 * Definicao completa das camadas.
 * `arquivo` aponta para o GeoJSON em /data; `status` identifica a origem.
 */
export const CAMADAS = [
  {
    id: "municipios",
    titulo: "Municipios de Rondonia",
    grupo: "administrativos",
    arquivo: "municipios.geojson",
    status: "REAL",
    visivel: true,
    opcoes: { titleField: "nome" },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [11, 110, 79, 0.12],
        outline: { color: [11, 37, 69, 0.85], width: 1.1 },
      },
    },
    legenda: [
      { rotulo: "Limite municipal (IBGE 2020)", cor: "#0b2545", tipo: "poligono" },
    ],
  },
  {
    id: "rodovias",
    titulo: "Rodovias federais e estaduais (SNV)",
    grupo: "rodoviario",
    arquivo: "rodovias.geojson",
    status: "REAL",
    visivel: true,
    opcoes: { titleField: "codigo_rodovia" },
    renderer: {
      type: "simple",
      symbol: linha("#0b2545", 2.2),
    },
    legenda: [
      { rotulo: "Eixo rodoviario SNV (BR/RO)", cor: "#0b2545", tipo: "linha" },
    ],
  },
  {
    id: "vias-estaduais",
    titulo: "Malha viiaria estadual (RO-xxx)",
    grupo: "rodoviario",
    arquivo: "vias-estaduais.geojson",
    status: "REAL",
    visivel: false,
    opcoes: { titleField: "nome" },
    renderer: { type: "simple", symbol: linha("#2e7daf", 1.2) },
    legenda: [{ rotulo: "Segmento estadual RO-xxx", cor: "#2e7daf", tipo: "linha" }],
  },
  {
    id: "obras",
    titulo: "Obras publicas",
    grupo: "obras",
    arquivo: "obras-demo.geojson",
    status: "SIMULADO",
    visivel: true,
    opcoes: { titleField: "titulo" },
    renderer: renderizadorUnico(
      "categoria",
      Object.fromEntries(config.categoriasObra.map((c) => [c.id, marcador(c.cor, 7)])),
      marcador("#6b7280", 7)
    ),
    legenda: config.categoriasObra.map((c) => ({ rotulo: c.nome, cor: c.cor, tipo: "ponto" })),
  },
  {
    id: "ativos",
    titulo: "Ativos, pontes e dispositivos",
    grupo: "pontes",
    arquivo: "ativos-demo.geojson",
    status: "SIMULADO",
    visivel: false,
    opcoes: { titleField: "tipo_nome" },
    renderer: renderizadorUnico(
      "criticidade",
      Object.fromEntries(Object.entries(CORES_CRITICIDADE).map(([k, c]) => [k, marcador(c, 6)])),
      marcador("#6b7280", 6)
    ),
    legenda: Object.entries(CORES_CRITICIDADE).map(([k, c]) => ({ rotulo: c, cor: CORES_CRITICIDADE[k], tipo: "ponto" })),
  },
  {
    id: "convenios",
    titulo: "Convenios e transferencias",
    grupo: "convenios",
    arquivo: "convenios-demo.geojson",
    status: "SIMULADO",
    visivel: false,
    opcoes: { titleField: "objeto" },
    renderer: { type: "simple", symbol: marcador("#5b4b8a", 7) },
    legenda: [{ rotulo: "Convenio (sede do municipio)", cor: "#5b4b8a", tipo: "ponto" }],
  },
  {
    id: "maquinas",
    titulo: "Maquinas e equipamentos",
    grupo: "maquinas",
    arquivo: "maquinas-demo.geojson",
    status: "SIMULADO",
    visivel: false,
    opcoes: { titleField: "tipo_nome" },
    renderer: renderizadorUnico(
      "situacao",
      Object.fromEntries(Object.entries(CORES_SITUACAO).map(([k, c]) => [k, marcador(c, 6)])),
      marcador("#6b7280", 6)
    ),
    legenda: [
      { rotulo: "Operacional", cor: "#1f8a70", tipo: "ponto" },
      { rotulo: "Em manutencao", cor: "#c9a227", tipo: "ponto" },
      { rotulo: "Inoperante", cor: "#b23a48", tipo: "ponto" },
    ],
  },
  {
    id: "ambiente",
    titulo: "Areas de protecao e uso restrito",
    grupo: "ambiente",
    arquivo: "ambiente.geojson",
    status: "REAL",
    visivel: false,
    opcoes: { titleField: "nome" },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [46, 125, 175, 0.25],
        outline: { color: [46, 125, 175, 0.9], width: 1 },
      },
    },
    legenda: [{ rotulo: "Area de protecao / restricao (servico publico)", cor: "#2e7daf", tipo: "poligono" }],
  },
];

/** Camadas que dependem de arquivo opcional (podem nao existir). */
export const CAMADAS_OPCIONAIS = new Set(["ambiente"]);

export function camadasPorGrupo() {
  return GRUPOS_CAMADAS.map((grupo) => ({
    ...grupo,
    camadas: CAMADAS.filter((c) => c.grupo === grupo.id),
  }));
}

export { CORES_SITUACAO, CORES_CRITICIDADE };
