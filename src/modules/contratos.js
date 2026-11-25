/**
 * APP 04 — Gestão de contratos.
 * Diferencia valores contratados, empenhados, liquidados e pagos; aponta
 * contratos a vencer, atrasados, paralisados e com inconsistências.
 */
import { el } from "../utils/dom.js";
import { dados, recortar as recortarDados, obterRegistro } from "../services/data.js";
import { store, definirFiltros } from "../services/state.js";
import { cartaoIndicador, listaDados, faixaIndicadores } from "../components/cards.js";
import { graficoBarras, graficoRosca, graficoBarrasHorizontais, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { abrirDrawer, toast, etiquetaStatus, etiquetaSituacao, blocoAviso } from "../components/ui.js";
import { moeda, moedaCompacta, numero, percentual, data, diasEntre } from "../utils/format.js";

const HOJE = new Date().toISOString().slice(0, 10);

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Gestão de contratos" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Objeto, contratada, vigência, valor inicial, aditivos, valor atualizado, empenho, liquidação, " +
            "pagamento e saldo, com indicadores de contratos a vencer, atrasados, paralisados e com inconsistências contábeis.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Base demonstrativa")]),
    ])
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaFaixa = el("div");
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaFiltros, areaChips, areaKpis, areaFaixa, areaGraficos, areaTabela);

  criarBarraFiltros(areaFiltros, {
    mostrar: ["municipio", "situacao", "periodo", "orgao", "atrasados"],
    aoMudar: atualizar,
  });
  criarChipsFiltros(areaChips, () => {
    definirFiltros({});
    atualizar();
  });

  /** Detecta inconsistências contábeis explicáveis. */
  function inconsistencias(contrato) {
    const achados = [];
    if (contrato.valor_empenhado > contrato.valor_atualizado + 1) achados.push("Empenhado maior que o valor atualizado");
    if (contrato.valor_liquidado > contrato.valor_empenhado + 1) achados.push("Liquidado maior que o empenhado");
    if (contrato.valor_pago > contrato.valor_liquidado + 1) achados.push("Pago maior que o liquidado");
    if (contrato.saldo < -1) achados.push("Saldo negativo");
    if (contrato.valor_aditivos > contrato.valor_inicial * 0.25) achados.push("Aditivos acima de 25% do valor inicial");
    return achados;
  }

  function atualizar() {
    const filtros = store.obter("filtros");
    const recorte = recortarDados(filtros);
    const contratos = recorte.contratos;

    const totalContratado = contratos.reduce((acc, c) => acc + (c.valor_atualizado || 0), 0);
    const totalEmpenhado = contratos.reduce((acc, c) => acc + (c.valor_empenhado || 0), 0);
    const totalLiquidado = contratos.reduce((acc, c) => acc + (c.valor_liquidado || 0), 0);
    const totalPago = contratos.reduce((acc, c) => acc + (c.valor_pago || 0), 0);
    const totalSaldo = contratos.reduce((acc, c) => acc + (c.saldo || 0), 0);

    const aVencer = contratos.filter((c) => c.situacao === "a_vencer" || (c.dias_para_vencer ?? 9999) <= 90 && c.situacao === "vigente");
    const atrasados = contratos.filter((c) => c.situacao === "atrasado");
    const paralisados = contratos.filter((c) => c.situacao === "paralisado");
    const comInconsistencia = contratos.filter((c) => inconsistencias(c).length > 0);

    areaKpis.innerHTML = "";
    areaKpis.append(
      cartaoIndicador({ titulo: "Contratos no recorte", valor: numero(contratos.length), detalhe: "Vigentes e encerrados", icone: "📄" }),
      cartaoIndicador({ titulo: "Valor contratado", valor: moedaCompacta(totalContratado), detalhe: "Inicial + aditivos", icone: "💰", tom: "positivo" }),
      cartaoIndicador({ titulo: "A vencer (90 dias)", valor: numero(aVencer.length), detalhe: "Exigem renovação ou encerramento", icone: "⏳", tom: "alerta" }),
      cartaoIndicador({ titulo: "Atrasados", valor: numero(atrasados.length), detalhe: "Vigência expirada", icone: "⚠️", tom: "critico" }),
      cartaoIndicador({ titulo: "Paralisados", valor: numero(paralisados.length), detalhe: "Execução interrompida", icone: "⛔", tom: "critico" }),
      cartaoIndicador({ titulo: "Com inconsistências", valor: numero(comInconsistencia.length), detalhe: "Coerência entre fases", icone: "🔍", tom: "alerta" })
    );

    areaFaixa.innerHTML = "";
    areaFaixa.append(
      faixaIndicadores([
        { rotulo: "Contratado", valor: moedaCompacta(totalContratado) },
        { rotulo: "Empenhado", valor: moedaCompacta(totalEmpenhado), detalhe: percentual(totalEmpenhado / (totalContratado || 1)) },
        { rotulo: "Liquidado", valor: moedaCompacta(totalLiquidado), detalhe: percentual(totalLiquidado / (totalContratado || 1)) },
        { rotulo: "Pago", valor: moedaCompacta(totalPago), detalhe: percentual(totalPago / (totalContratado || 1)) },
        { rotulo: "Saldo", valor: moedaCompacta(totalSaldo) },
      ])
    );

    destruirGraficos();
    const graficoSituacoes = el("div", { className: "grafico" });
    const graficoMaiores = el("div", { className: "grafico" });
    areaGraficos.innerHTML = "";
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Situação dos contratos" }),
          etiquetaStatus("SIMULADO"),
        ]),
        graficoSituacoes,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Maiores contratos por valor atualizado" }),
          etiquetaStatus("SIMULADO"),
        ]),
        graficoMaiores,
      ])
    );

    const cores = {
      vigente: "#1f8a70",
      a_vencer: "#c9a227",
      atrasado: "#d97a1f",
      paralisado: "#b23a48",
      encerrado: "#6b7a88",
      rescindido: "#9aa7b2",
    };
    const rotulos = ["vigente", "a_vencer", "atrasado", "paralisado", "encerrado", "rescindido"];
    graficoRosca(graficoSituacoes, {
      rotulos: rotulos.map((r) => r.replace("_", " ")),
      valores: rotulos.map((r) => contratos.filter((c) => c.situacao === r).length),
      cores: rotulos.map((r) => cores[r]),
    });

    const maiores = [...contratos].sort((a, b) => b.valor_atualizado - a.valor_atualizado).slice(0, 8);
    graficoBarrasHorizontais(graficoMaiores, {
      rotulos: maiores.map((c) => c.id),
      valores: maiores.map((c) => c.valor_atualizado),
      formatador: (v) => moedaCompacta(v),
      cor: "#12355b",
    });

    areaTabela.innerHTML = "";
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Contratos do recorte" }),
        el("span", { className: "etiqueta etiqueta--simulado", text: "Simulado" }),
      ])
    );
    const corpoTabela = el("div");
    areaTabela.append(corpoTabela);

    criarTabela(corpoTabela, {
      colunas: [
        { chave: "id", rotulo: "Contrato", largura: "140px" },
        { chave: "objeto", rotulo: "Objeto" },
        { chave: "contratada", rotulo: "Contratada (fictícia)" },
        { chave: "vigencia_fim", rotulo: "Vigência até", formatar: (v) => data(v) },
        { chave: "valor_atualizado", rotulo: "Atualizado", alinhamento: "direita", formatar: (v) => moedaCompacta(v) },
        { chave: "valor_pago", rotulo: "Pago", alinhamento: "direita", formatar: (v) => moedaCompacta(v) },
        { chave: "saldo", rotulo: "Saldo", alinhamento: "direita", formatar: (v) => moedaCompacta(v) },
        { chave: "situacao", rotulo: "Situação", renderizar: (linha) => etiquetaSituacao(linha.situacao) },
        {
          chave: "inconsistencias",
          rotulo: "Consistência",
          renderizar: (linha) => {
            const achados = inconsistencias(linha);
            return achados.length
              ? el("span", { className: "etiqueta etiqueta--indisponivel", text: `${achados.length} aviso(s)` , title: achados.join(" · ") })
              : el("span", { className: "etiqueta etiqueta--real", text: "Coerente" });
          },
        },
      ],
      linhas: contratos,
      aoClicarLinha: (linha) => abrirFichaContrato(linha.id),
      nomeExportacao: "contratos-ro",
      porPagina: 20,
    });
  }

  function abrirFichaContrato(id) {
    const contrato = obterRegistro("contrato", id);
    if (!contrato) {
      toast("Contrato não encontrado.", "erro");
      return;
    }
    const drawer = abrirDrawer({
      titulo: `Contrato ${contrato.id}`,
      subtitulo: contrato.objeto,
      conteudo: el("div", { className: "ficha" }),
      largura: "520px",
    });
    const corpo = drawer.corpo;

    const achados = inconsistencias(contrato);
    if (achados.length) {
      corpo.append(blocoAviso("Inconsistências detectadas", achados.join(" · "), "alerta"));
    }

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Identificação" }),
        listaDados([
          { rotulo: "Objeto", valor: contrato.objeto },
          { rotulo: "Contratada (fictícia)", valor: contrato.contratada },
          { rotulo: "Órgão", valor: contrato.orgao },
          { rotulo: "Município", valor: contrato.municipio },
          { rotulo: "Modalidade", valor: contrato.modalidade },
          { rotulo: "Fonte de recurso", valor: contrato.fonte_recurso },
        ]),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Vigência" }),
        listaDados([
          { rotulo: "Início", valor: data(contrato.vigencia_inicio) },
          { rotulo: "Fim", valor: data(contrato.vigencia_fim) },
          {
            rotulo: "Dias para o encerramento",
            valor: contrato.dias_para_vencer >= 0 ? `${contrato.dias_para_vencer} dias` : `vencido há ${Math.abs(contrato.dias_para_vencer)} dias`,
          },
          { rotulo: "Situação", valor: el("span", {}, [etiquetaSituacao(contrato.situacao)]) },
        ]),
      ])
    );

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Execução financeira" }),
        listaDados([
          { rotulo: "Valor inicial", valor: moeda(contrato.valor_inicial) },
          { rotulo: "Aditivos", valor: moeda(contrato.valor_aditivos) },
          { rotulo: "Valor atualizado", valor: moeda(contrato.valor_atualizado) },
          { rotulo: "Empenhado", valor: moeda(contrato.valor_empenhado) },
          { rotulo: "Liquidado", valor: moeda(contrato.valor_liquidado) },
          { rotulo: "Pago", valor: moeda(contrato.valor_pago) },
          { rotulo: "Saldo", valor: moeda(contrato.saldo) },
        ]),
      ])
    );

    const obrasVinculadas = (contrato.obras || [])
      .map((obraId) => obterRegistro("obra", obraId))
      .filter(Boolean);
    const secaoObras = el("section", { className: "ficha__secao" }, [el("h3", { text: `Obras associadas (${obrasVinculadas.length})` })]);
    if (!obrasVinculadas.length) {
      secaoObras.append(el("p", { className: "ficha__vazio", text: "Nenhuma obra vinculada a este contrato." }));
    } else {
      const lista = el("ul", { className: "lista-simples" });
      obrasVinculadas.forEach((obra) => {
        lista.append(
          el("li", {}, [
            el("strong", { text: obra.id }),
            el("span", { text: ` — ${obra.titulo} (${obra.municipio}) · ${percentual(obra.percentual_execucao_fisica)} executado` }),
          ])
        );
      });
      secaoObras.append(lista);
    }
    corpo.append(secaoObras);

    corpo.append(
      el("div", { className: "ficha__acoes" }, [
        el("a", { className: "botao botao--secundario", href: "#/obras", text: "Abrir módulo de obras" }),
        el("button", {
          className: "botao botao--secundario",
          type: "button",
          text: "Baixar contrato (CSV)",
          onclick: () => {
            import("../utils/export.js").then(({ paraCsv, baixarTexto }) => {
              baixarTexto(`contrato-${contrato.id}.csv`, paraCsv([contrato]), "text/csv;charset=utf-8");
              toast("Contrato exportado em CSV.", "sucesso");
            });
          },
        }),
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
