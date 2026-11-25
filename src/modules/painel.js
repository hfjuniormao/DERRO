/**
 * APP 01 — Painel executivo de infraestrutura.
 * Todos os indicadores são calculados a partir dos registros carregados e
 * respondem aos filtros globais.
 */
import { el } from "../utils/dom.js";
import { dados, recortar, calcularIndicadores, porMunicipio, agrupar } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoIndicador, faixaIndicadores } from "../components/cards.js";
import { graficoBarras, graficoBarrasHorizontais, graficoLinha, graficoRosca, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarBarraFiltros, criarChipsFiltros, cartaoResumoFiltros } from "../components/filters.js";
import { etiquetaStatus, blocoAviso } from "../components/ui.js";
import { moedaCompacta, numero, percentual, data, mesAno } from "../utils/format.js";
import { config } from "../config.js";
import { criarKpisExecutivos, criarGraficosExecutivos, linhasDetalhamento } from "../dashboards/executivo.js";

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Painel executivo de infraestrutura" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Visão consolidada de obras, investimentos, contratos, extensão rodoviária, ativos e convênios do " +
            "Estado de Rondônia. Todos os números respondem aos filtros e são calculados a partir dos registros " +
            "carregados — dados de obras e contratos são simulados e identificados como tal.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Obras/contratos simulados")]),
    ])
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaKpis, areaGraficos, areaTabela);

  const barra = criarBarraFiltros(areaFiltros, {
    mostrar: ["municipio", "categoria", "situacao", "periodo", "atrasados"],
    aoMudar: atualizar,
  });
  criarChipsFiltros(areaChips, () => {
    store.definir({ filtros: { ...store.obter("filtros") } });
    atualizar();
  });

  let graficos = [];
  let tabela = null;

  function atualizar() {
    const filtros = store.obter("filtros");
    const recorte = recortar(filtros);
    const indicadores = calcularIndicadores(recorte, filtros);

    /* ------------------------------------------------------------- KPIs */
    areaKpis.innerHTML = "";
    criarKpisExecutivos(indicadores).forEach((cartao) => areaKpis.append(cartao));

    /* ---------------------------------------------------------- gráficos */
    destruirGraficos();
    graficos = [];
    areaGraficos.innerHTML = "";
    criarGraficosExecutivos(recorte, indicadores, filtros).forEach((definicao) => {
      areaGraficos.append(
        el("section", { className: "painel" }, [
          el("header", { className: "painel__cabecalho" }, [
            el("h3", { className: "painel__titulo", text: definicao.titulo }),
            el("span", { className: "etiqueta etiqueta--simulado", text: "Simulado" }),
          ]),
          definicao.container,
        ])
      );
    });

    /* ------------------------------------------------------------ tabela */
    areaTabela.innerHTML = "";
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Detalhamento por município" }),
        el("span", { className: "etiqueta etiqueta--simulado", text: "Simulado" }),
      ])
    );
    const corpoTabela = el("div");
    areaTabela.append(corpoTabela);

    tabela = criarTabela(corpoTabela, {
      colunas: [
        { chave: "municipio", rotulo: "Município" },
        { chave: "quantidade", rotulo: "Obras", alinhamento: "direita" },
        { chave: "valor", rotulo: "Investimento", alinhamento: "direita", formatar: (v) => moedaCompacta(v) },
        {
          chave: "populacao",
          rotulo: "População (Censo 2022)",
          alinhamento: "direita",
          formatar: (v) => (v ? numero(v) : "—"),
        },
        {
          chave: "pib",
          rotulo: "PIB (R$ mi)",
          alinhamento: "direita",
          formatar: (v) => (v ? numero(v, 1) : "—"),
        },
      ],
      linhas: linhasDetalhamento(recorte),
      nomeExportacao: "painel-executivo-por-municipio",
      porPagina: 20,
    });
  }

  atualizar();

  const cancelar = store.inscrever("filtros", () => atualizar());

  container.append(pagina);

  return {
    destruir() {
      cancelar();
      destruirGraficos();
    },
  };
}
