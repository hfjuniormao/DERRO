/**
 * APP 03 — Gestão de Obras Públicas 360.
 * Mapa de obras com filtros, ficha detalhada (medições, evidências, histórico)
 * e exportação.
 */
import { el } from "../utils/dom.js";
import { dados, recortar as recortarDados, obterRegistro } from "../services/data.js";
import { store, definirFiltros } from "../services/state.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { criarTabela } from "../components/tables.js";
import { cartaoIndicador, listaDados } from "../components/cards.js";
import { abrirDrawer, toast, etiquetaStatus, etiquetaSituacao, blocoAviso } from "../components/ui.js";
import { moeda, moedaCompacta, numero, percentual, data, dataExtenso, titulo as formatarTitulo } from "../utils/format.js";
import { config } from "../config.js";

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Gestão de Obras Públicas 360" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Mapa de obras por categoria com ficha detalhada: órgão responsável, município, empresa, contrato, " +
            "valores, prazo, execução física e financeira, medições, evidências e histórico.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Base de obras demonstrativa")]),
    ])
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaMapa = el("div", { className: "painel" });
  const areaTabela = el("div", { className: "painel" });

  pagina.append(areaFiltros, areaChips, areaKpis, areaMapa, areaTabela);

  const mapa = criarInterfaceMapa(areaMapa, {
    titulo: "Mapa de obras públicas",
    aoSelecionarFeicao: (feicao) => {
      const id = feicao.atributos?.id;
      if (id) abrirFichaObra(id);
    },
  });

  const barra = criarBarraFiltros(areaFiltros, {
    mostrar: ["municipio", "categoria", "situacao", "periodo", "rodovia", "orgao", "atrasados"],
    aoMudar: atualizar,
  });
  criarChipsFiltros(areaChips, () => {
    definirFiltros({});
    atualizar();
  });

  let tabela = null;

  function atualizar() {
    const filtros = store.obter("filtros");
    const recorte = recortarDados(filtros);
    const obras = recorte.obras;

    areaKpis.innerHTML = "";
    const valor = obras.reduce((acc, o) => acc + (o.valor_atualizado || 0), 0);
    const execucaoMedia = obras.length
      ? obras.reduce((acc, o) => acc + (o.percentual_execucao_fisica || 0), 0) / obras.length
      : 0;
    areaKpis.append(
      cartaoIndicador({ titulo: "Obras no recorte", valor: numero(obras.length), detalhe: "Base demonstrativa", icone: "🏗️" }),
      cartaoIndicador({ titulo: "Valor atualizado", valor: moedaCompacta(valor), detalhe: "Obra + aditivos", icone: "💰", tom: "positivo" }),
      cartaoIndicador({ titulo: "Execução física média", valor: percentual(execucaoMedia), detalhe: "Média do recorte", icone: "📈" }),
      cartaoIndicador({
        titulo: "Atrasadas ou paralisadas",
        valor: numero(obras.filter((o) => ["atrasada", "paralisada"].includes(o.situacao)).length),
        detalhe: "Exigem atenção do gestor",
        icone: "⚠️",
        tom: "alerta",
      })
    );

    areaTabela.innerHTML = "";
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Obras do recorte" }),
        el("span", { className: "etiqueta etiqueta--simulado", text: "Simulado" }),
      ])
    );
    const corpoTabela = el("div");
    areaTabela.append(corpoTabela);

    tabela = criarTabela(corpoTabela, {
      colunas: [
        { chave: "id", rotulo: "Obra", largura: "128px" },
        { chave: "titulo", rotulo: "Descrição" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "categoria_nome", rotulo: "Categoria" },
        { chave: "rodovia", rotulo: "Rodovia", formatar: (v) => v || "—" },
        { chave: "valor_atualizado", rotulo: "Valor", alinhamento: "direita", formatar: (v) => moedaCompacta(v) },
        {
          chave: "percentual_execucao_fisica",
          rotulo: "Execução",
          alinhamento: "direita",
          formatar: (v) => percentual(v),
        },
        { chave: "situacao", rotulo: "Situação", renderizar: (linha) => etiquetaSituacao(linha.situacao) },
      ],
      linhas: obras,
      aoClicarLinha: (linha) => abrirFichaObra(linha.id),
      nomeExportacao: "obras-publicas-ro",
      porPagina: 20,
    });
  }

  /** Ficha detalhada da obra. */
  function abrirFichaObra(id) {
    const obra = obterRegistro("obra", id);
    if (!obra) {
      toast("Obra não encontrada.", "erro");
      return;
    }
    const drawer = abrirDrawer({
      titulo: obra.titulo,
      subtitulo: `${obra.id} · ${obra.municipio}`,
      conteudo: el("div", { className: "ficha" }),
      largura: "520px",
    });

    const corpo = drawer.corpo;
    corpo.append(
      el("div", { className: "ficha__topo" }, [
        etiquetaSituacao(obra.situacao),
        etiquetaStatus("SIMULADO", "Base demonstrativa"),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Identificação" }),
        listaDados([
          { rotulo: "Órgão responsável", valor: obra.orgao_responsavel },
          { rotulo: "Município", valor: obra.municipio },
          { rotulo: "Categoria", valor: obra.categoria_nome },
          { rotulo: "Rodovia", valor: obra.rodovia || "Não aplicável" },
          { rotulo: "Referência", valor: obra.referencia || "—"},
          { rotulo: "Contrato", valor: obra.contrato_id },
          { rotulo: "Empresa (fictícia)", valor: obra.empresa },
          { rotulo: "Fonte de recurso", valor: obra.fonte_recurso },
        ]),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Execução e valores" }),
        listaDados([
          { rotulo: "Valor inicial", valor: moeda(obra.valor_inicial) },
          { rotulo: "Valor atualizado", valor: moeda(obra.valor_atualizado) },
          { rotulo: "Execução física", valor: percentual(obra.percentual_execucao_fisica) },
          { rotulo: "Execução financeira", valor: percentual(obra.percentual_execucao_financeira) },
          { rotulo: "Início", valor: data(obra.data_inicio) },
          { rotulo: "Prazo previsto", valor: data(obra.data_fim_prevista) },
          { rotulo: "Dias de atraso", valor: obra.dias_atraso ? `${obra.dias_atraso} dias` : "Sem atraso" },
        ]),
      ])
    );

    /* ------------------------------------------------------- medições */
    const mediacoes = obra.mediacoes || [];
    const secaoMed = el("section", { className: "ficha__secao" }, [el("h3", { text: `Medições (${mediacoes.length})` })]);
    if (!mediacoes.length) {
      secaoMed.append(el("p", { className: "ficha__vazio", text: "Nenhuma medição registrada para esta obra." }));
    } else {
      const tabelaMed = el("table", { className: "tabela tabela--compacta" });
      tabelaMed.append(
        el("thead", {}, [
          el("tr", {}, [
            el("th", { scope: "col", text: "Nº" }),
            el("th", { scope: "col", text: "Data" }),
            el("th", { scope: "col", text: "% físico" }),
            el("th", { scope: "col", text: "Valor medido" }),
          ]),
        ])
      );
      const corpoMed = el("tbody");
      mediacoes.forEach((m) => {
        corpoMed.append(
          el("tr", {}, [
            el("td", { text: String(m.numero) }),
            el("td", { text: data(m.data) }),
            el("td", { text: percentual(m.percentual_fisico) }),
            el("td", { text: moeda(m.valor_medido) }),
          ])
        );
      });
      tabelaMed.append(corpoMed);
      secaoMed.append(tabelaMed);
    }
    corpo.append(secaoMed);

    /* ------------------------------------------------------ evidências */
    const evidencias = obra.evidencias || [];
    const secaoEv = el("section", { className: "ficha__secao" }, [el("h3", { text: `Evidências fotográficas (${evidencias.length})` })]);
    if (!evidencias.length) {
      secaoEv.append(
        el("p", { className: "ficha__vazio", text: "Sem imagens anexadas nesta demonstração. O upload real depende do backend de produção." })
      );
    } else {
      const grade = el("div", { className: "grade grade--3" });
      evidencias.forEach((evidencia) => {
        grade.append(
          el("div", { className: "evidencia" }, [
            el("span", { className: "evidencia__placeholder", "aria-hidden": "true", text: "🖼️" }),
            el("span", { className: "evidencia__legenda", text: evidencia.legenda }),
            el("time", { className: "evidencia__data", datetime: evidencia.data, text: data(evidencia.data) }),
          ])
        );
      });
      secaoEv.append(grade);
    }
    corpo.append(secaoEv);

    /* ------------------------------------------------------- histórico */
    const historico = obra.historico || [];
    const secaoHist = el("section", { className: "ficha__secao" }, [el("h3", { text: "Histórico do empreendimento" })]);
    if (!historico.length) {
      secaoHist.append(el("p", { className: "ficha__vazio", text: "Sem eventos registrados." }));
    } else {
      const linha = el("ol", { className: "linha-tempo" });
      historico
        .slice()
        .sort((a, b) => a.data.localeCompare(b.data))
        .forEach((evento) => {
          linha.append(
            el("li", { className: "linha-tempo__item" }, [
              el("time", { className: "linha-tempo__data", datetime: evento.data, text: data(evento.data) }),
              el("div", {}, [
                el("strong", { text: evento.evento }),
                el("span", { className: "linha-tempo__responsavel", text: evento.responsavel }),
              ]),
            ])
          );
        });
      secaoHist.append(linha);
    }
    corpo.append(secaoHist);

    /* ------------------------------------------------------ ações finais */
    const acoes = el("div", { className: "ficha__acoes" }, [
      el("button", {
        className: "botao botao--secundario",
        type: "button",
        text: "Localizar no mapa",
        onclick: () => {
          mapa.irPara([obra.localizacao.lon, obra.localizacao.lat], { zoom: 13 });
        },
      }),
      el("a", {
        className: "botao botao--secundario",
        href: `#/contratos`,
        text: "Ver contratos",
      }),
      el("button", {
        className: "botao botao--secundario",
        type: "button",
        text: "Baixar ficha (CSV)",
        onclick: () => {
          import("../utils/export.js").then(({ paraCsv, baixarTexto }) => {
            const linha = {
              id: obra.id,
              titulo: obra.titulo,
              municipio: obra.municipio,
              categoria: obra.categoria_nome,
              orgao: obra.orgao_responsavel,
              empresa: obra.empresa,
              contrato: obra.contrato_id,
              valor_inicial: obra.valor_inicial,
              valor_atualizado: obra.valor_atualizado,
              execucao_fisica: obra.percentual_execucao_fisica,
              execucao_financeira: obra.percentual_execucao_financeira,
              situacao: obra.situacao_nome,
              inicio: obra.data_inicio,
              prazo: obra.data_fim_prevista,
            };
            baixarTexto(`obra-${obra.id}.csv`, paraCsv([linha]), "text/csv;charset=utf-8");
            toast("Ficha exportada em CSV.", "sucesso");
          });
        },
      }),
    ]);
    corpo.append(acoes);
  }

  atualizar();
  mapa.iniciar().catch((erro) => console.warn("[obras] mapa não inicializado:", erro));

  container.append(pagina);

  return {
    destruir() {
      mapa.destruir?.();
    },
  };
}
