/**
 * Camada de dashboards — montagem dos indicadores e graficos do painel
 * executivo (APP 01). Separada dos modulos para que a mesma composicao possa
 * ser reaproveitada em relatorios ou na area restrita.
 */
import { el } from "../utils/dom.js";
import { dados, porMunicipio, agrupar } from "../services/data.js";
import { cartaoIndicador } from "../components/cards.js";
import { graficoBarras, graficoBarrasHorizontais, graficoLinha, graficoRosca } from "../components/charts.js";
import { moedaCompacta, numero, percentual } from "../utils/format.js";
import { config } from "../config.js";

const CORES_SITUACAO = {
  planejada: "#9aa7b2",
  em_execucao: "#1f8a70",
  atrasada: "#d97a1f",
  paralisada: "#b23a48",
  concluida: "#0b2545",
  cancelada: "#6b7a88",
};

/** Cartoes de indicador do painel executivo. */
export function criarKpisExecutivos(indicadores) {
  return [
    cartaoIndicador({
      titulo: "Obras em carteira",
      valor: numero(indicadores.obras),
      detalhe: `${indicadores.municipiosAtendidos} municípios com obra`,
      icone: "🏗️",
      rodape: "Fonte: base demonstrativa (SIMULADO)",
    }),
    cartaoIndicador({
      titulo: "Investimento total",
      valor: moedaCompacta(indicadores.valorObras),
      detalhe: `Contratado ${moedaCompacta(indicadores.valorContratado)}`,
      icone: "💰",
      tom: "positivo",
      rodape: "Valores atualizados dos contratos vinculados",
    }),
    cartaoIndicador({
      titulo: "Execução física média",
      valor: percentual(indicadores.execucaoMedia),
      detalhe: "Média das obras do recorte",
      icone: "📈",
    }),
    cartaoIndicador({
      titulo: "Obras atrasadas ou paralisadas",
      valor: numero((indicadores.situacoes.atrasada || 0) + (indicadores.situacoes.paralisada || 0)),
      detalhe: `Atraso médio de ${Math.round(indicadores.atrasoMedio)} dias`,
      icone: "⚠️",
      tom: "alerta",
      rodape: "Prazo previsto x. data de referência",
    }),
    cartaoIndicador({
      titulo: "Saldo a pagar",
      valor: moedaCompacta(indicadores.saldoContratos),
      detalhe: `${moedaCompacta(indicadores.valorPago)} pagos de ${moedaCompacta(indicadores.valorContratado)}`,
      icone: "💳",
      tom: indicadores.saldoContratos > indicadores.valorContratado * 0.4 ? "critico" : "padrao",
    }),
    cartaoIndicador({
      titulo: "Ativos de criticidade alta/crítica",
      valor: numero(indicadores.ativosCriticos),
      detalhe: `De ${numero(indicadores.ativos)} ativos inventariados`,
      icone: "🌉",
      tom: "critico",
    }),
  ];
}

/**
 * Monta os quatro graficos do painel executivo.
 * @returns {Array<{ container: HTMLElement, grafico: Object }>}
 */
export function criarGraficosExecutivos(recorte, indicadores, filtros) {
  const graficoSituacoes = el("div", { className: "grafico" });
  const graficoMunicipios = el("div", { className: "grafico" });
  const graficoCategorias = el("div", { className: "grafico" });
  const graficoInvestimento = el("div", { className: "grafico" });

  graficoRosca(graficoSituacoes, {
    rotulos: config.situacoes.obra.map((s) => s.nome),
    valores: config.situacoes.obra.map((s) => indicadores.situacoes[s.id] || 0),
    cores: config.situacoes.obra.map((s) => CORES_SITUACAO[s.id]),
  });

  const topMunicipios = porMunicipio(recorte.obras).slice(0, 8);
  graficoBarrasHorizontais(graficoMunicipios, {
    rotulos: topMunicipios.map((m) => m.municipio),
    valores: topMunicipios.map((m) => m.valor),
    formatador: (v) => moedaCompacta(v),
    cor: "#0b6e4f",
  });

  const porCategoria = agrupar(recorte.obras, "categoria", "categoria_nome");
  graficoBarras(graficoCategorias, {
    rotulos: porCategoria.map((c) => c.nome),
    valores: porCategoria.map((c) => c.quantidade),
    rotuloY: "Obras",
    cor: "#12355b",
  });

  const serie = dados.serieInvestimento.filter((p) => p.ano >= filtros.anoInicio && p.ano <= filtros.anoFim);
  const porAno = new Map();
  serie.forEach((p) => porAno.set(p.ano, (porAno.get(p.ano) || 0) + p.valor));
  const anos = [...porAno.keys()].sort();
  graficoLinha(graficoInvestimento, {
    rotulos: anos.map(String),
    series: [{ nome: "Investimento anual (R$)", valores: anos.map((a) => porAno.get(a)), cor: "#0b6e4f" }],
    rotuloY: "R$",
    formatador: (v) => moedaCompacta(v),
  });

  return [
    {
      container: graficoSituacoes,
      titulo: "Situação das obras",
      descricao: "Distribuição das obras do recorte por situação (base simulada).",
    },
    {
      container: graficoMunicipios,
      titulo: "Investimento por município",
      descricao: "Valor atualizado das obras nos oito primeiros municípios (base simulada).",
    },
    {
      container: graficoCategorias,
      titulo: "Obras por categoria",
      descricao: "Quantidade de obras por categoria de intervenção (base simulada).",
    },
    {
      container: graficoInvestimento,
      titulo: "Evolução do investimento (série anual)",
      descricao: "Série histórica demonstrativa de investimento por ano.",
    },
  ];
}

/** Linhas da tabela de detalhamento por municipio. */
export function linhasDetalhamento(recorte) {
  return porMunicipio(recorte.obras).map((item) => ({
    ...item,
    populacao: dados.indicadoresMunicipais[item.codigo]?.populacao || null,
    pib: dados.indicadoresMunicipais[item.codigo]?.pib_milhoes || null,
  }));
}
