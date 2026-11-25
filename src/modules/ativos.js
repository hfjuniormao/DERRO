/**
 * APP 05 — Gestão de pontes e ativos.
 * Inventario georreferenciado com condicao estrutural, criticidade, inspecoes,
 * capacidade e historico de manutencao.
 */
import { el } from "../utils/dom.js";
import { dados, recortar as recortarDados, obterRegistro } from "../services/data.js";
import { store, definirFiltros } from "../services/state.js";
import { cartaoIndicador, listaDados } from "../components/cards.js";
import { graficoBarras, graficoBarrasHorizontais, graficoRosca, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { abrirDrawer, toast, etiquetaStatus, blocoAviso } from "../components/ui.js";
import { numero, percentual, data } from "../utils/format.js";
import { config } from "../config.js";

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Gestão de pontes e ativos" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Inventário georreferenciado de pontes, bueiros, galerias, dispositivos de drenagem, sinalização, " +
            "defensas, viadutos e passarelas, com condição estrutural, criticidade, inspeções e histórico de manutenção.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Base demonstrativa")]),
    ])
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaFiltros, areaChips, areaKpis, areaGraficos, areaTabela);

  criarBarraFiltros(areaFiltros, {
    mostrar: ["municipio", "periodo", "criticos", "rodovia"],
    aoMudar: atualizar,
  });
  criarChipsFiltros(areaChips, () => {
    definirFiltros({});
    atualizar();
  });

  function atualizar() {
    const filtros = store.obter("filtros");
    const recorte = recortarDados(filtros);
    const ativos = recorte.ativos;

    const porCondicao = { boa: 0, regular: 0, ruim: 0, critica: 0 };
    const porCriticidade = { baixa: 0, media: 0, alta: 0, critica: 0 };
    const porTipo = new Map();
    ativos.forEach((ativo) => {
      porCondicao[ativo.condicao] = (porCondicao[ativo.condicao] || 0) + 1;
      porCriticidade[ativo.criticidade] = (porCriticidade[ativo.criticidade] || 0) + 1;
      porTipo.set(ativo.tipo_nome, (porTipo.get(ativo.tipo_nome) || 0) + 1);
    });

    const semInspecao = ativos.filter((a) => !a.ultima_inspecao).length;
    const manutencaoVencida = ativos.filter((a) => a.ultima_inspecao && (new Date(HOJE()) - new Date(a.ultima_inspecao)) / 86400000 > 730).length;

    areaKpis.innerHTML = "";
    areaKpis.append(
      cartaoIndicador({ titulo: "Ativos inventariados", valor: numero(ativos.length), detalhe: "Pontes, bueiros, sinalização e outros", icone: "🌉" }),
      cartaoIndicador({ titulo: "Condição crítica", valor: numero(porCondicao.critica), detalhe: `${numero(porCondicao.ruim)} em condição ruim`, icone: "⚠️", tom: "critico" }),
      cartaoIndicador({ titulo: "Criticidade alta/crítica", valor: numero(porCriticidade.alta + porCriticidade.critica), detalhe: "Exigem priorização", icone: "🎯", tom: "alerta" }),
      cartaoIndicador({ titulo: "Inspeções vencidas (>2 anos)", valor: numero(manutencaoVencida), detalhe: `${numero(semInspecao)} sem inspeção registrada`, icone: "🗓️", tom: "alerta" }),
      cartaoIndicador({ titulo: "Municípios com ativos", valor: numero(new Set(ativos.map((a) => a.municipio_codigo)).size), detalhe: "Cobertura territorial", icone: "🗺️" })
    );

    destruirGraficos();
    const graficoCondicao = el("div", { className: "grafico" });
    const graficoTipo = el("div", { className: "grafico" });
    areaGraficos.innerHTML = "";
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Condição estrutural" }),
          etiquetaStatus("SIMULADO"),
        ]),
        graficoCondicao,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Ativos por tipo" }),
          etiquetaStatus("SIMULADO"),
        ]),
        graficoTipo,
      ])
    );

    graficoRosca(graficoCondicao, {
      rotulos: ["Boa", "Regular", "Ruim", "Crítica"],
      valores: [porCondicao.boa, porCondicao.regular, porCondicao.ruim, porCondicao.critica],
      cores: ["#1f8a70", "#c9a227", "#d97a1f", "#b23a48"],
    });

    const tipos = [...porTipo.entries()].sort((a, b) => b[1] - a[1]);
    graficoBarras(graficoTipo, {
      rotulos: tipos.map(([tipo]) => tipo),
      valores: tipos.map(([, quantidade]) => quantidade),
      rotuloY: "Ativos",
      cor: "#2e7daf",
    });

    areaTabela.innerHTML = "";
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Inventário de ativos" }),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const corpo = el("div");
    areaTabela.append(corpo);

    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Registro", largura: "128px" },
        { chave: "tipo_nome", rotulo: "Tipo" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "rodovia", rotulo: "Rodovia", formatar: (v) => v || "—" },
        { chave: "km", rotulo: "Km", alinhamento: "direita", formatar: (v) => (v ?? "—") },
        { chave: "condicao_nome", rotulo: "Condição" },
        { chave: "criticidade", rotulo: "Criticidade", renderizar: (linha) => el("span", { className: `etiqueta situacao--${linha.criticidade === "critica" ? "paralisada" : linha.criticidade === "alta" ? "atrasada" : "planejada"}`, text: config.criticidade[linha.criticidade]?.nome || linha.criticidade }) },
        { chave: "capacidade", rotulo: "Capacidade" },
        { chave: "ultima_inspecao", rotulo: "Última inspeção", formatar: (v) => (v ? data(v) : "—") },
      ],
      linhas: ativos,
      aoClicarLinha: (linha) => abrirFichaAtivo(linha.id),
      nomeExportacao: "ativos-rodoviarios-ro",
      porPagina: 20,
    });
  }

  function abrirFichaAtivo(id) {
    const ativo = obterRegistro("ativo", id);
    if (!ativo) {
      toast("Ativo não encontrado.", "erro");
      return;
    }
    const drawer = abrirDrawer({
      titulo: `${ativo.tipo_nome} — ${ativo.id}`,
      subtitulo: `${ativo.municipio}${ativo.rodovia ? ` · ${ativo.rodovia}` : ""}`,
      conteudo: el("div", { className: "ficha" }),
      largura: "520px",
    });
    const corpo = drawer.corpo;

    if (ativo.criticidade === "critica") {
      corpo.append(blocoAviso("Ativo em condição crítica", "Intervenção recomendada conforme laudo de inspeção.", "perigo"));
    }

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Identificação" }),
        listaDados([
          { rotulo: "Tipo", valor: ativo.tipo_nome },
          { rotulo: "Município", valor: ativo.municipio },
          { rotulo: "Rodovia", valor: ativo.rodovia || "Não aplicável" },
          { rotulo: "Km", valor: ativo.km ?? "—" },
          { rotulo: "Ano de implantação", valor: ativo.ano_implantacao },
          { rotulo: "Extensão", valor: `${ativo.extensao_m} m` },
          { rotulo: "Capacidade", valor: ativo.capacidade },
          { rotulo: "Responsável", valor: ativo.responsavel },
        ]),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Condição e criticidade" }),
        listaDados([
          { rotulo: "Condição estrutural", valor: ativo.condicao_nome },
          { rotulo: "Criticidade", valor: config.criticidade[ativo.criticidade]?.nome || ativo.criticidade },
          { rotulo: "Última inspeção", valor: ativo.ultima_inspecao ? data(ativo.ultima_inspecao) : "Não registrada" },
          { rotulo: "Inspeções registradas", valor: (ativo.inspecoes || []).length },
        ]),
      ])
    );

    const inspecoes = ativo.inspecoes || [];
    const secaoInsp = el("section", { className: "ficha__secao" }, [el("h3", { text: "Histórico de inspeções" })]);
    if (!inspecoes.length) {
      secaoInsp.append(el("p", { className: "ficha__vazio", text: "Nenhuma inspeção registrada." }));
    } else {
      const lista = el("ol", { className: "linha-tempo" });
      inspecoes
        .slice()
        .sort((a, b) => b.data.localeCompare(a.data))
        .forEach((inspecao) => {
          lista.append(
            el("li", { className: "linha-tempo__item" }, [
              el("time", { className: "linha-tempo__data", datetime: inspecao.data, text: data(inspecao.data) }),
              el("div", {}, [
                el("strong", { text: `Condição: ${inspecao.condicao}` }),
                el("span", { className: "linha-tempo__responsavel", text: `${inspecao.responsavel} — ${inspecao.parecer}` }),
              ]),
            ])
          );
        });
      secaoInsp.append(lista);
    }
    corpo.append(secaoInsp);

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Fotografias" }),
        el("p", { className: "ficha__vazio", text: "Evidências fotográficas são anexadas pela rotina de fiscalização (APP 10) e sincronizadas com o backend de produção." }),
      ])
    );
  }

  function HOJE() {
    return new Date().toISOString().slice(0, 10);
  }

  atualizar();

  container.append(pagina);

  return {
    destruir() {
      destruirGraficos();
    },
  };
}
