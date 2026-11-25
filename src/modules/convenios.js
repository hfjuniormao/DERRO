/**
 * APP 08 — Convenios e transferencias.
 *
 * Painel com a relacao de convenios estaduais e federais (base demonstrativa),
 * objeto, orgao concedente, beneficiario, valor, contrapartida, vigencia,
 * desembolsos, situacao e localizacao; alertas de vencimento, risco de
 * execucao, grafico de desembolsos, ranking por municipio e exportacao CSV.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoIndicador } from "../components/cards.js";
import { graficoBarras, graficoBarrasHorizontais, graficoRosca, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { ajustarAlturaMapa } from "./_mapa.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { etiquetaStatus, etiquetaSituacao, blocoAviso } from "../components/ui.js";
import { moedaCompacta, numero, percentual } from "../utils/format.js";

/** Janela (em dias) usada para o alerta de vencimento. */
const JANELA_VENCIMENTO = 90;

/** Diferenca minima entre cronograma e desembolso para marcar risco. */
const MARGEM_RISCO = 0.15;

/** Situacoes de convenio usadas nos filtros locais. */
const SITUACOES = [
  { id: "vigente", nome: "Vigente" },
  { id: "execucao", nome: "Em execução" },
  { id: "atrasado", nome: "Atrasado" },
  { id: "concluido", nome: "Concluído" },
  { id: "cancelado", nome: "Cancelado" },
];

/** Dias ate o fim da vigencia (usa o campo da base; recalcula se ausente). */
function diasParaVencer(convenio, referencia) {
  if (Number.isFinite(convenio.dias_para_vencer)) return convenio.dias_para_vencer;
  if (!convenio.vigencia_fim) return null;
  const fim = new Date(`${convenio.vigencia_fim}T12:00:00`);
  return Math.round((fim - referencia) / 86400000);
}

/**
 * Indice de risco de execucao: quanto o desembolso esta atrasado em relacao
 * ao cronograma de vigencia. Quanto maior, maior o risco.
 */
function riscoExecucao(convenio, referencia) {
  const valor = convenio.valor || 0;
  if (!valor) return { risco: 0, execucao: 0, cronograma: 0 };
  const execucao = (convenio.desembolsado || 0) / valor;
  const inicio = convenio.vigencia_inicio ? new Date(`${convenio.vigencia_inicio}T12:00:00`) : null;
  const fim = convenio.vigencia_fim ? new Date(`${convenio.vigencia_fim}T12:00:00`) : null;
  if (!inicio || !fim || fim <= inicio) return { risco: 0, execucao, cronograma: 0 };
  const total = fim - inicio;
  const decorrido = Math.min(1, Math.max(0, (referencia - inicio) / total));
  return { risco: decorrido - execucao, execucao, cronograma: decorrido };
}

export async function montar(container, ctx) {
  const referencia = new Date();
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Convênios e transferências" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Convênios estaduais e federais com objeto, órgão concedente, beneficiário, valor, contrapartida, " +
            "vigência, desembolsos, situação e localização. Os alertas de vencimento consideram a janela de " +
            `${JANELA_VENCIMENTO} dias e o risco de execução compara o desembolso com o cronograma de vigência.`,
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Base demonstrativa de convênios")]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "Base demonstrativa",
      "Os convênios exibidos pertencem à base sintética de demonstração (SIMULADOS). Convênios reais exigem " +
        "integração com o Portal da Transparência de Rondônia e o cadastro oficial de transferências do Estado " +
        "(marcado como INDISPONÍVEL no catálogo de fontes).",
      "alerta"
    )
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaMapa = el("div", { className: "painel" });
  const areaAlertas = el("div", { className: "grade grade--2" });
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaRanking = el("div", { className: "painel" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaKpis, areaMapa, areaAlertas, areaGraficos, areaRanking, areaTabela);

  /* ------------------------------------------------------- filtro local */

  const filtroSituacao = el("select", { className: "campo", id: "filtro-convenio-situacao" });
  filtroSituacao.append(el("option", { value: "", text: "Todas as situações do convênio" }));
  SITUACOES.forEach((s) => filtroSituacao.append(el("option", { value: s.id, text: s.nome })));

  const filtroOrgao = el("select", { className: "campo", id: "filtro-convenio-orgao" });
  filtroOrgao.append(el("option", { value: "", text: "Todos os órgãos concedentes" }));
  [...new Set(dados.convenios.map((c) => c.orgao_concedente).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((o) => filtroOrgao.append(el("option", { value: o, text: o })));

  const filtroAlerta = el("select", { className: "campo", id: "filtro-convenio-alerta" });
  filtroAlerta.append(
    el("option", { value: "", text: "Todos os convênios" }),
    el("option", { value: "vencimento", text: "Somente com vencimento próximo" }),
    el("option", { value: "risco", text: "Somente com risco de execução" }),
    el("option", { value: "vencido", text: "Somente vencidos sem conclusão" })
  );

  const local = { situacao: "", orgao: "", alerta: "" };
  [filtroSituacao, filtroOrgao, filtroAlerta].forEach((campo) => {
    campo.addEventListener("change", () => {
      local.situacao = filtroSituacao.value;
      local.orgao = filtroOrgao.value;
      local.alerta = filtroAlerta.value;
      render();
    });
  });

  areaFiltros.append(
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "filtro-convenio-situacao", text: "Situação do convênio" }),
      filtroSituacao,
    ]),
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "filtro-convenio-orgao", text: "Órgão concedente" }),
      filtroOrgao,
    ]),
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "filtro-convenio-alerta", text: "Alertas" }),
      filtroAlerta,
    ])
  );

  /* ------------------------------------------------------- recorte de dados */

  function recorte() {
    const filtros = store.obter("filtros");
    return dados.convenios.filter((c) => {
      if (filtros.municipio && String(c.municipio_codigo) !== String(filtros.municipio)) return false;
      if (filtros.busca) {
        const alvo = `${c.id} ${c.objeto} ${c.beneficiario} ${c.orgao_concedente} ${c.municipio}`.toLowerCase();
        if (!alvo.includes(filtros.busca.toLowerCase())) return false;
      }
      if (local.situacao && c.situacao !== local.situacao) return false;
      if (local.orgao && c.orgao_concedente !== local.orgao) return false;
      const dias = diasParaVencer(c, referencia);
      if (local.alerta === "vencimento" && !(dias !== null && dias >= 0 && dias <= JANELA_VENCIMENTO)) return false;
      if (local.alerta === "risco" && !(riscoExecucao(c, referencia).risco > MARGEM_RISCO && dias !== null && dias >= 0)) return false;
      if (local.alerta === "vencido" && !(dias !== null && dias < 0 && c.situacao !== "concluido" && c.situacao !== "cancelado")) return false;
      return true;
    });
  }

  /* -------------------------------------------------------------- render */

  function render() {
    const lista = recorte();

    const valorTotal = lista.reduce((acc, c) => acc + (c.valor || 0), 0);
    const desembolsado = lista.reduce((acc, c) => acc + (c.desembolsado || 0), 0);
    const contrapartida = lista.reduce((acc, c) => acc + (c.contrapartida || 0), 0);
    const saldo = lista.reduce((acc, c) => acc + (c.saldo || 0), 0);
    const vencendo = lista.filter((c) => {
      const dias = diasParaVencer(c, referencia);
      return dias !== null && dias >= 0 && dias <= JANELA_VENCIMENTO;
    });
    const emRisco = lista.filter((c) => {
      const dias = diasParaVencer(c, referencia);
      return riscoExecucao(c, referencia).risco > MARGEM_RISCO && dias !== null && dias >= 0;
    });

    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Convênios no recorte",
        valor: numero(lista.length),
        detalhe: `${numero(new Set(lista.map((c) => c.municipio_codigo)).size)} municípios atendidos`,
        icone: "🤝",
        rodape: "Base demonstrativa (SIMULADO)",
      }),
      cartaoIndicador({
        titulo: "Valor conveniado",
        valor: moedaCompacta(valorTotal),
        detalhe: `Contrapartida de ${moedaCompacta(contrapartida)}`,
        icone: "💰",
        tom: "positivo",
        rodape: "Soma dos valores dos convênios do recorte",
      }),
      cartaoIndicador({
        titulo: "Desembolsado",
        valor: moedaCompacta(desembolsado),
        detalhe: `${percentual(valorTotal ? (desembolsado / valorTotal) * 100 : 0)} do valor conveniado`,
        icone: "📤",
        rodape: "Soma dos desembolsos registrados",
      }),
      cartaoIndicador({
        titulo: "Saldo a desembolsar",
        valor: moedaCompacta(saldo),
        detalhe: `${percentual(valorTotal ? (saldo / valorTotal) * 100 : 0)} do valor conveniado`,
        icone: "⏳",
        tom: saldo > valorTotal * 0.5 ? "alerta" : "padrao",
      }),
      cartaoIndicador({
        titulo: `Vencimento em até ${JANELA_VENCIMENTO} dias`,
        valor: numero(vencendo.length),
        detalhe: `${moedaCompacta(vencendo.reduce((a, c) => a + (c.saldo || 0), 0))} com saldo em aberto`,
        icone: "📅",
        tom: vencendo.length ? "alerta" : "padrao",
        rodape: "Regra: dias para o fim da vigência ≤ 90",
      }),
      cartaoIndicador({
        titulo: "Risco de execução",
        valor: numero(emRisco.length),
        detalhe: "Desembolso abaixo do cronograma de vigência",
        icone: "⚠️",
        tom: emRisco.length ? "critico" : "padrao",
        rodape: `Regra: (cronograma − desembolso) > ${MARGEM_RISCO}`,
      })
    );

    renderAlertas(lista, vencendo, emRisco);
    renderGraficos(lista);
    renderRanking(lista);
    renderTabela(lista);
  }

  /* ------------------------------------------------------------- alertas */

  function renderAlertas(lista, vencendo, emRisco) {
    const vencidos = lista.filter((c) => {
      const dias = diasParaVencer(c, referencia);
      return dias !== null && dias < 0 && c.situacao !== "concluido" && c.situacao !== "cancelado";
    });

    limpar(areaAlertas);
    areaAlertas.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: `Alertas de vencimento (≤ ${JANELA_VENCIMENTO} dias)` }),
          etiquetaStatus("SIMULADO"),
        ]),
        vencendo.length
          ? el(
              "ul",
              { className: "lista-resumo" },
              vencendo
                .slice(0, 8)
                .map((c) =>
                  el("li", {}, [
                    el("span", { text: `${c.id} — ${c.objeto}` }),
                    el("strong", {
                      text: `${diasParaVencer(c, referencia)} dias · ${moedaCompacta(c.saldo)} em aberto`,
                    }),
                  ])
                )
            )
          : el("p", { className: "painel__descricao", text: "Nenhum convênio com vencimento dentro da janela." }),
        vencidos.length
          ? blocoAviso(
              "Convênios vencidos sem conclusão",
              `${vencidos.length} convênio(s) passaram da vigência sem situação concluída ou cancelada.`,
              "perigo"
            )
          : null,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Riscos de execução" }),
          etiquetaStatus("SIMULADO"),
        ]),
        el("p", {
          className: "painel__descricao",
          text:
            "Risco = progresso do cronograma de vigência − percentual desembolsado. Acima de " +
            `${MARGEM_RISCO} o convênio entra na lista de risco.`,
        }),
        emRisco.length
          ? el(
              "ul",
              { className: "lista-resumo" },
              emRisco
                .slice(0, 8)
                .map((c) => {
                  const r = riscoExecucao(c, referencia);
                  return el("li", {}, [
                    el("span", { text: `${c.id} — ${c.municipio}` }),
                    el("strong", {
                      text: `${percentual(r.execucao * 100)} desembolsado · cronograma ${percentual(r.cronograma * 100)}`,
                    }),
                  ]);
                })
            )
          : el("p", { className: "painel__descricao", text: "Nenhum convênio em risco no recorte atual." }),
      ])
    );
  }

  /* ------------------------------------------------------------ gráficos */

  function renderGraficos(lista) {
    destruirGraficos();
    const areaDesembolso = el("div", { className: "grafico" });
    const areaSituacao = el("div", { className: "grafico" });
    limpar(areaGraficos);
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Desembolso por órgão concedente" }),
          etiquetaStatus("SIMULADO"),
        ]),
        areaDesembolso,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Situação dos convênios" }),
          etiquetaStatus("SIMULADO"),
        ]),
        areaSituacao,
      ])
    );

    const porOrgao = new Map();
    lista.forEach((c) => {
      const atual = porOrgao.get(c.orgao_concedente) || { nome: c.orgao_concedente, devolvido: 0, valor: 0 };
      atual.devolvido += c.desembolsado || 0;
      atual.valor += c.valor || 0;
      porOrgao.set(c.orgao_concedente, atual);
    });
    const orgaos = [...porOrgao.values()].sort((a, b) => b.devolvido - a.devolvido).slice(0, 8);
    graficoBarras(areaDesembolso, {
      rotulos: orgaos.map((o) => o.nome),
      valores: orgaos.map((o) => o.devolvido),
      rotuloY: "Desembolsado (R$)",
      formatador: (v) => moedaCompacta(v),
      cor: "#5b4b8a",
    });

    const contagem = new Map();
    lista.forEach((c) => contagem.set(c.situacao, (contagem.get(c.situacao) || 0) + 1));
    const cores = { vigente: "#1f8a70", execucao: "#2e7daf", atrasado: "#d97a1f", concluido: "#0b2545", cancelado: "#6b7a88" };
    graficoRosca(areaSituacao, {
      rotulos: [...contagem.keys()].map((s) => SITUACOES.find((x) => x.id === s)?.nome || s),
      valores: [...contagem.values()],
      cores: [...contagem.keys()].map((s) => cores[s] || "#6b7a88"),
    });
  }

  /* ------------------------------------------------------------- ranking */

  function renderRanking(lista) {
    const mapa = new Map();
    lista.forEach((c) => {
      const atual = mapa.get(c.municipio) || { municipio: c.municipio, quantidade: 0, valor: 0, desembolsado: 0 };
      atual.quantidade += 1;
      atual.valor += c.valor || 0;
      atual.desembolsado += c.desembolsado || 0;
      mapa.set(c.municipio, atual);
    });
    const linhas = [...mapa.values()]
      .map((m) => ({
        ...m,
        saldo: m.valor - m.desembolsado,
        execucao: m.valor ? (m.desembolsado / m.valor) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    limpar(areaRanking);
    areaRanking.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Ranking de convênios por município" }),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const grafico = el("div", { className: "grafico grafico--alto" });
    areaRanking.append(grafico);
    const corpo = el("div");
    areaRanking.append(corpo);

    const topo = linhas.slice(0, 10);
    graficoBarrasHorizontais(grafico, {
      rotulos: topo.map((l) => l.municipio),
      valores: topo.map((l) => l.valor),
      formatador: (v) => moedaCompacta(v),
      cor: "#0b6e4f",
    });

    criarTabela(corpo, {
      colunas: [
        { chave: "municipio", rotulo: "Município" },
        { chave: "quantidade", rotulo: "Convênios", alinhamento: "direita" },
        { chave: "valor", rotulo: "Valor conveniado", alinhamento: "direita" },
        { chave: "desembolsado", rotulo: "Desembolsado", alinhamento: "direita" },
        { chave: "saldo", rotulo: "Saldo", alinhamento: "direita" },
        { chave: "execucao", rotulo: "Execução", alinhamento: "direita" },
      ],
      linhas,
      nomeExportacao: "convenios-por-municipio",
      porPagina: 15,
    });
  }

  /* -------------------------------------------------------------- tabela */

  function renderTabela(lista) {
    limpar(areaTabela);
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Relação completa de convênios" }),
          el("p", {
            className: "painel__descricao",
            text: "Busque, ordene e exporte os convênios do recorte atual (CSV pela tabela).",
          }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const corpo = el("div");
    areaTabela.append(corpo);

    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Convênio" },
        { chave: "objeto", rotulo: "Objeto" },
        { chave: "orgao_concedente", rotulo: "Órgão concedente" },
        { chave: "beneficiario", rotulo: "Beneficiário" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "valor", rotulo: "Valor", alinhamento: "direita" },
        { chave: "contrapartida", rotulo: "Contrapartida", alinhamento: "direita" },
        { chave: "desembolsado", rotulo: "Desembolsado", alinhamento: "direita" },
        { chave: "saldo", rotulo: "Saldo", alinhamento: "direita" },
        { chave: "vigencia_inicio", rotulo: "Vigência (início)" },
        { chave: "vigencia_fim", rotulo: "Vigência (fim)" },
        {
          chave: "situacao",
          rotulo: "Situação",
          renderizar: (linha) => etiquetaSituacao(linha.situacao),
        },
        {
          chave: "dias_para_vencer",
          rotulo: "Dias p/ vencer",
          alinhamento: "direita",
          renderizar: (linha) => {
            const dias = diasParaVencer(linha, referencia);
            if (dias === null) return "—";
            if (dias < 0) return `${numero(Math.abs(dias))} (vencido)`;
            return numero(dias);
          },
        },
      ],
      linhas: lista,
      nomeExportacao: "convenios",
      porPagina: 20,
    });
  }

  /* ----------------------------------------------------------------- mapa */

  areaMapa.append(
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: "Mapa dos convênios" }),
        el("p", {
          className: "painel__descricao",
          text: "Ative a camada «Convênios e transferências» no painel do mapa para visualizar os pontos.",
        }),
      ]),
      etiquetaStatus("SIMULADO"),
    ])
  );
  const areaMapaInterna = el("div");
  areaMapa.append(areaMapaInterna);

  /* --------------------------------------------------------------- render */

  criarBarraFiltros(areaFiltros, { mostrar: ["municipio", "periodo"] });
  criarChipsFiltros(areaChips, () => {
    store.definir({ filtros: { ...store.obter("filtros") } });
  });

  render();

  const mapa = criarInterfaceMapa(areaMapaInterna, { titulo: "Convênios e transferências" });
  ajustarAlturaMapa(areaMapaInterna);
  mapa.iniciar().catch((erro) => console.warn("[convenios] mapa não inicializado:", erro));

  const cancelar = store.inscrever("filtros", render);

  container.append(pagina);

  return {
    destruir() {
      cancelar();
      destruirGraficos();
      mapa.destruir?.();
    },
  };
}
