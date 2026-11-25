/**
 * APP 07 — Perfil dos 52 municipios de Rondonia.
 * Populacao, area territorial e PIB (IBGE/SIDRA, dados reais) + indicadores
 * de infraestrutura derivados dos registros das bases.
 */
import { el } from "../utils/dom.js";
import { dados, fichaMunicipio, porMunicipio } from "../services/data.js";
import { store, definirFiltros } from "../services/state.js";
import { cartaoIndicador, listaDados } from "../components/cards.js";
import { graficoBarrasHorizontais, graficoRosca, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { abrirDrawer, toast, etiquetaStatus, blocoAviso } from "../components/ui.js";
import { moedaCompacta, numero, percentual, data } from "../utils/format.js";
import { config } from "../config.js";

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Perfil dos municípios de Rondônia" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Ficha individual dos 52 municípios com população (Censo 2022), área territorial, PIB municipal, " +
            "infraestrutura, obras, investimentos e indicadores sociais — além de comparativos e rankings.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        etiquetaStatus("REAL", "IBGE: população e PIB"),
        etiquetaStatus("SIMULADO", "Obras e ativos"),
      ]),
    ])
  );

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaGrafico = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaKpis, areaGrafico, areaTabela);

  /** Consolida um registro por municipio. */
  function municipiosConsolidados() {
    const obrasPorMun = porMunicipio(dados.obras);
    const contratosPorMun = new Map();
    dados.contratos.forEach((c) => {
      const atual = contratosPorMun.get(c.municipio) || { quantidade: 0, valor: 0 };
      atual.quantidade += 1;
      atual.valor += c.valor_atualizado || 0;
      contratosPorMun.set(c.municipio, atual);
    });
    const ativosPorMun = new Map();
    dados.ativos.forEach((a) => {
      ativosPorMun.set(a.municipio_codigo, (ativosPorMun.get(a.municipio_codigo) || 0) + 1);
    });

    return dados.municipios.map((m) => {
      const indicadores = dados.indicadoresMunicipais[m.codigo_ibge] || {};
      const obras = obrasPorMun.find((o) => o.codigo === m.codigo_ibge) || { quantidade: 0, valor: 0 };
      const contratos = contratosPorMun.get(m.nome) || { quantidade: 0, valor: 0 };
      const pop = indicadores.populacao || 0;
      return {
        ...m,
        populacao: pop,
        pib: indicadores.pib_milhoes || null,
        obras: obras.quantidade,
        investimento: obras.valor,
        contratos: contratos.quantidade,
        valor_contratado: contratos.valor,
        ativos: ativosPorMun.get(m.codigo_ibge) || 0,
        investimento_per_capita: pop ? (obras.valor + contratos.valor) / pop : null,
        pib_per_capita: indicadores.pib_milhoes && pop ? (indicadores.pib_milhoes * 1e6) / pop : null,
      };
    });
  }

  let lista = municipiosConsolidados();

  function atualizar() {
    const popTotal = lista.reduce((acc, m) => acc + (m.populacao || 0), 0);
    const areaTotal = lista.reduce((acc, m) => acc + (m.area_km2 || 0), 0);
    const comObras = lista.filter((m) => m.obras > 0).length;

    areaKpis.innerHTML = "";
    areaKpis.append(
      cartaoIndicador({ titulo: "Municípios", valor: numero(lista.length), detalhe: "Limites oficiais do IBGE", icone: "🏛️" }),
      cartaoIndicador({ titulo: "População (Censo 2022)", valor: numero(popTotal), detalhe: "Soma dos 52 municípios", icone: "👥", tom: "positivo" }),
      cartaoIndicador({ titulo: "Área territorial", valor: `${numero(areaTotal, 0)} km²`, detalhe: "Área geodésica da malha", icone: "🗺️" }),
      cartaoIndicador({ titulo: "Municípios com obras", valor: numero(comObras), detalhe: "Base demonstrativa", icone: "🏗️" }),
      cartaoIndicador({ titulo: "Maior investimento", valor: moedaCompacta(Math.max(...lista.map((m) => m.investimento))), detalhe: [...lista].sort((a, b) => b.investimento - a.investimento)[0]?.municipio || "—", icone: "💰" })
    );

    destruirGraficos();
    const graficoPop = el("div", { className: "grafico" });
    const graficoInvest = el("div", { className: "grafico" });
    areaGrafico.innerHTML = "";
    areaGrafico.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Maiores populações (Censo 2022)" }),
          etiquetaStatus("REAL"),
        ]),
        graficoPop,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Investimento por município (demonstrativo)" }),
          etiquetaStatus("SIMULADO"),
        ]),
        graficoInvest,
      ])
    );

    const topPop = [...lista].sort((a, b) => b.populacao - a.populacao).slice(0, 8);
    graficoBarrasHorizontais(graficoPop, {
      rotulos: topPop.map((m) => m.nome),
      valores: topPop.map((m) => m.populacao),
      formatador: (v) => numero(v),
      cor: "#12355b",
    });

    const topInvest = [...lista].sort((a, b) => b.investimento - a.investimento).slice(0, 8);
    graficoBarrasHorizontais(graficoInvest, {
      rotulos: topInvest.map((m) => m.nome),
      valores: topInvest.map((m) => m.investimento),
      formatador: (v) => moedaCompacta(v),
      cor: "#0b6e4f",
    });

    areaTabela.innerHTML = "";
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Comparativo entre municípios" }),
        el("span", { className: "etiqueta etiqueta--real", text: "IBGE + derivados" }),
      ])
    );
    const corpo = el("div");
    areaTabela.append(corpo);

    criarTabela(corpo, {
      colunas: [
        { chave: "nome", rotulo: "Município" },
        { chave: "codigo_ibge", rotulo: "Código IBGE", largura: "110px" },
        { chave: "populacao", rotulo: "População", alinhamento: "direita", formatar: (v) => numero(v) },
        { chave: "area_km2", rotulo: "Área (km²)", alinhamento: "direita", formatar: (v) => numero(v, 0) },
        { chave: "pib", rotulo: "PIB (R$ mi)", alinhamento: "direita", formatar: (v) => (v ? numero(v, 0) : "—") },
        { chave: "pib_per_capita", rotulo: "PIB per capita (R$)", alinhamento: "direita", formatar: (v) => (v ? numero(v) : "—") },
        { chave: "obras", rotulo: "Obras", alinhamento: "direita" },
        { chave: "investimento", rotulo: "Investimento", alinhamento: "direita", formatar: (v) => moedaCompacta(v) },
        { chave: "ativos", rotulo: "Ativos", alinhamento: "direita" },
      ],
      linhas: lista,
      aoClicarLinha: (linha) => abrirFichaMunicipio(linha.codigo_ibge),
      nomeExportacao: "municipios-ro",
      porPagina: 20,
    });
  }

  function abrirFichaMunicipio(codigo) {
    const ficha = fichaMunicipio(codigo);
    if (!ficha) {
      toast("Município não encontrado.", "erro");
      return;
    }
    const { municipio, indicadores, obras, contratos, ativos, convenios } = ficha;
    const drawer = abrirDrawer({
      titulo: municipio.nome,
      subtitulo: `Código IBGE ${municipio.codigo_ibge} · RO`,
      conteudo: el("div", { className: "ficha" }),
      largura: "540px",
    });
    const corpo = drawer.corpo;

    const investimento = obras.reduce((acc, o) => acc + (o.valor_atualizado || 0), 0);
    const contratado = contratos.reduce((acc, c) => acc + (c.valor_atualizado || 0), 0);

    corpo.append(
      el("div", { className: "ficha__topo" }, [
        etiquetaStatus("REAL", "IBGE"),
        etiquetaStatus("SIMULADO", "Obras/ativos"),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Identificação e território" }),
        listaDados([
          { rotulo: "Código IBGE", valor: municipio.codigo_ibge },
          { rotulo: "Área territorial", valor: `${numero(municipio.area_km2, 1)} km²` },
          { rotulo: "Centroide (lon, lat)", valor: (municipio.centroide || []).map((n) => Number(n).toFixed(3)).join(", ") },
        ]),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Perfil socioeconômico (IBGE)" }),
        listaDados([
          { rotulo: "População residente (Censo 2022)", valor: numero(indicadores.populacao) },
          { rotulo: "PIB municipal", valor: indicadores.pib_milhoes ? `R$ ${numero(indicadores.pib_milhoes, 1)} milhões` : "—" },
          {
            rotulo: "PIB per capita",
            valor: indicadores.pib_milhoes && indicadores.populacao ? `R$ ${numero((indicadores.pib_milhoes * 1e6) / indicadores.populacao)}` : "—",
          },
          { rotulo: "Ano de referência do PIB", valor: dados.anoPib ? String(dados.anoPib).slice(0, 4) : "—" },
        ]),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Infraestrutura e obras (base demonstrativa)" }),
        listaDados([
          { rotulo: "Obras ativas no município", valor: numero(obras.length) },
          { rotulo: "Investimento em obras", valor: moedaCompacta(investimento) },
          { rotulo: "Contratos", valor: numero(contratos.length) },
          { rotulo: "Valor contratado", valor: moedaCompacta(contratado) },
          { rotulo: "Ativos inventariados", valor: numero(ativos.length) },
          { rotulo: "Convênios", valor: numero(convenios.length) },
        ]),
      ])
    );

    const emObra = obras.filter((o) => !["concluida", "cancelada"].includes(o.situacao));
    const secaoObras = el("section", { className: "ficha__secao" }, [el("h3", { text: `Obras em andamento (${emObra.length})` })]);
    if (!emObra.length) {
      secaoObras.append(el("p", { className: "ficha__vazio", text: "Nenhuma obra em andamento (base demonstrativa)." }));
    } else {
      const lista = el("ul", { className: "lista-simples" });
      emObra.slice(0, 12).forEach((obra) => {
        lista.append(
          el("li", {}, [
            el("strong", { text: obra.titulo }),
            el("span", { text: ` — ${percentual(obra.percentual_execucao_fisica)} executado · ${moedaCompacta(obra.valor_atualizado)}` }),
          ])
        );
      });
      secaoObras.append(lista);
    }
    corpo.append(secaoObras);

    corpo.append(
      el("div", { className: "ficha__acoes" }, [
        el("button", {
          className: "botao botao--secundario",
          type: "button",
          text: "Filtrar plataforma por este município",
          onclick: () => {
            definirFiltros({ municipio: municipio.codigo_ibge, municipioNome: municipio.nome });
            window.location.hash = "#/painel";
          },
        }),
        el("a", { className: "botao botao--secundario", href: "#/mapa", text: "Ver no geoportal" }),
      ])
    );
  }

  atualizar();

  container.append(pagina);

  return {
    destruir() {
      destruirGraficos();
    },
  };
}
