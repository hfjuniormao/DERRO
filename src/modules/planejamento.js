/**
 * APP 12 — Planejamento estrategico.
 *
 * Matriz multicriterio com pesos configuraveis (soma 100%), normalizacao 0..1
 * por criterio (invertida quando o sentido e "menor"), pontuacao final e
 * ranking dos projetos, cenarios de investimento por orcamento e tabela
 * detalhada com a contribuicao de cada criterio.
 *
 * Os candidatos sao as obras da base demonstrativa (SIMULADAS) e os criterios
 * combinam dados REAIS (IBGE, malha SNV, areas de protecao) com a base
 * SIMULADA de obras.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoIndicador } from "../components/cards.js";
import { graficoBarrasHorizontais, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { etiquetaStatus, blocoAviso } from "../components/ui.js";
import { moeda, moedaCompacta, numero, percentual } from "../utils/format.js";
import { config } from "../config.js";
import { malhaPorMunicipio, trechosDaMalhaReal, normalizarSerie } from "./_geoespacial.js";
import { areasAmbiente, cruzarObrasComAreas, classificarRiscoAmbiental } from "./_ambiente.js";

/**
 * Peso base da criticidade por categoria de obra (regra fixa e disclosed).
 * Expressa a criticidade estrutural/funcional de cada tipo de intervenção.
 */
const BASE_CRITICIDADE = {
  pontes: 1,
  hospitais: 0.95,
  escolas: 0.9,
  drenagem: 0.8,
  predios_publicos: 0.75,
  infraestrutura_urbana: 0.6,
  pavimentacao: 0.5,
  recuperacao_rodoviaria: 0.45,
  outras_obras: 0.4,
};

/** Ajuste de criticidade conforme a situacao da obra. */
const AJUSTE_SITUACAO = {
  atrasada: 0.15,
  paralisada: 0.25,
  em_execucao: 0.05,
  planejada: -0.1,
  concluida: -0.05,
  cancelada: -0.2,
};

/** Redistribui um inteiro de resto entre partes proportionais (metodo do maior resto). */
function distribuirInteiros(partes, total) {
  const base = partes.map((p) => Math.floor(p.valor));
  let usado = base.reduce((a, b) => a + b, 0);
  const ordem = partes
    .map((p, i) => ({ i, resto: p.valor - Math.floor(p.valor) }))
    .sort((a, b) => b.resto - a.resto);
  let indice = 0;
  while (usado < total && ordem.length) {
    base[ordem[indice % ordem.length].i] += 1;
    usado += 1;
    indice += 1;
  }
  return base;
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Planejamento estratégico" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Matriz multicritério para priorização de investimento no Estado. Os pesos são configuráveis e " +
            "somam 100%; cada critério é normalizado entre 0 e 1 e o resultado ordena os projetos candidatos. " +
            "Os candidatos são as obras da base demonstrativa (SIMULADAS).",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        etiquetaStatus("SIMULADO", "Obras candidatas"),
        etiquetaStatus("REAL", "IBGE, SNV e áreas de proteção"),
      ]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "Priorização demonstrativa",
      "A pontuação resulta de regras determinísticas sobre os dados carregados — não é uma decisão de " +
        "investimento nem substitui a análise técnica do Estado. Os valores de custo e de avanço vêm da base " +
        "simulada de obras.",
      "alerta"
    )
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaPesos = el("div", { className: "painel" });
  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaGrafico = el("div", { className: "painel" });
  const areaCenario = el("div", { className: "painel" });
  const areaRanking = el("div", { className: "painel" });
  const areaDetalhe = el("div", { className: "painel" });
  const areaCarregando = el("div", { className: "painel" }, [
    el("p", { className: "carregando-bloco", text: "Medindo a malha viária real e cruzando as áreas de proteção…" }),
  ]);
  pagina.append(areaPesos, areaKpis, areaGrafico, areaCenario, areaRanking, areaDetalhe, areaCarregando);
  container.append(pagina);

  /* ------------------------------------------------------------- pesos */

  const criterios = config.criteriosPlanejamento.map((c) => ({ ...c }));
  const pesos = Object.fromEntries(criterios.map((c) => [c.id, c.peso]));
  const controles = new Map();

  function redistribuir(idAlterado, novoValor) {
    const valor = Math.max(0, Math.min(100, Math.round(Number(novoValor) || 0)));
    pesos[idAlterado] = valor;
    const resto = 100 - valor;
    const outros = criterios.filter((c) => c.id !== idAlterado);
    const somaAtual = outros.reduce((acc, c) => acc + (pesos[c.id] || 0), 0);
    const bruto = outros.map((c) => ({
      id: c.id,
      valor: somaAtual > 0 ? (resto * (pesos[c.id] || 0)) / somaAtual : resto / outros.length,
    }));
    const inteiros = distribuirInteiros(bruto, resto);
    bruto.forEach((p, i) => {
      pesos[p.id] = inteiros[i];
    });
    atualizarControles();
    render();
  }

  function atualizarControles() {
    criterios.forEach((c) => {
      const controle = controles.get(c.id);
      if (!controle) return;
      controle.slider.value = pesos[c.id];
      controle.numero.value = pesos[c.id];
    });
    const total = criterios.reduce((acc, c) => acc + pesos[c.id], 0);
    if (totalBadge) {
      totalBadge.textContent = `Soma dos pesos: ${total}%`;
      totalBadge.className = total === 100 ? "etiqueta etiqueta--real" : "etiqueta etiqueta--indisponivel";
    }
  }

  let totalBadge = null;

  function renderPesos() {
    limpar(areaPesos);
    areaPesos.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Pesos dos critérios (matriz multicritério)" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Ao mover um peso, os demais são redistribuídos proporcionalmente para manter a soma em 100%. " +
              "Critérios com sentido «menor» (custo e risco ambiental) são invertidos na normalização.",
          }),
        ]),
        el("span", { className: "etiqueta etiqueta--neutra", text: "Pesos configuráveis" }),
      ])
    );

    totalBadge = el("span", { className: "etiqueta etiqueta--real", text: "Soma dos pesos: 100%" });
    areaPesos.append(el("div", { className: "pagina__acoes" }, [totalBadge]));

    const grade = el("div", { className: "grade grade--4" });
    criterios.forEach((c) => {
      const id = `peso-${c.id}`;
      const slider = el("input", {
        type: "range",
        className: "campo",
        id,
        min: "0",
        max: "50",
        step: "1",
        value: pesos[c.id],
        "aria-label": `Peso de ${c.nome}`,
        oninput: (ev) => redistribuir(c.id, ev.target.value),
      });
      const numero = el("input", {
        type: "number",
        className: "campo",
        id: `${id}-numero`,
        min: "0",
        max: "100",
        step: "1",
        value: pesos[c.id],
        "aria-label": `Peso de ${c.nome} em porcentagem`,
        onchange: (ev) => redistribuir(c.id, ev.target.value),
      });
      controles.set(c.id, { slider, numero });
      grade.append(
        el("div", { className: "campo-grupo" }, [
          el("label", { className: "campo-rotulo", for: id, text: `${c.nome} (${c.sentido === "menor" ? "menor é melhor" : "maior é melhor"})` }),
          slider,
          numero,
        ])
      );
    });
    areaPesos.append(grade);
    areaPesos.append(
      el("div", { className: "pagina__acoes" }, [
        el("button", {
          className: "botao botao--secundario",
          type: "button",
          text: "Restaurar pesos padrão",
          onclick: () => {
            criterios.forEach((c) => {
              pesos[c.id] = c.peso;
            });
            atualizarControles();
            render();
          },
        }),
        el("button", {
          className: "botao botao--secundario",
          type: "button",
          text: "Distribuir igualmente",
          onclick: () => {
            const parte = Math.floor(100 / criterios.length);
            criterios.forEach((c, i) => {
              pesos[c.id] = i === 0 ? 100 - parte * (criterios.length - 1) : parte;
            });
            atualizarControles();
            render();
          },
        }),
      ])
    );
    atualizarControles();
  }

  /* --------------------------------------------------------- candidatos */

  const areas = await areasAmbiente();

  const contexto = {
    malha: new Map(),
    risco: new Map(),
  };

  await new Promise((resolve) => setTimeout(resolve, 0));

  function prepararBase() {
    const trechos = trechosDaMalhaReal(dados);
    const municipios = (dados.municipios || []).map((m) => ({
      codigo_ibge: m.codigo_ibge,
      nome: m.nome,
      geometria: m.geometria,
    }));
    const malha = malhaPorMunicipio(trechos, municipios, 2);
    const obras = dados.obras;
    const { riscoPorObra } = cruzarObrasComAreas(obras, areas);
    return { malha, riscoPorObra };
  }

  const base = prepararBase();
  contexto.malha = base.malha;
  contexto.risco = base.riscoPorObra;

  function criticidadeDaObra(obra) {
    const baseCategoria = BASE_CRITICIDADE[obra.categoria] ?? 0.5;
    const ajuste = AJUSTE_SITUACAO[obra.situacao] ?? 0;
    return Math.max(0, Math.min(1, baseCategoria + ajuste));
  }

  function candidatos() {
    const filtros = store.obter("filtros");
    const obras = dados.obras.filter((o) => {
      if (filtros.municipio && String(o.municipio_codigo) !== String(filtros.municipio)) return false;
      if (filtros.categoria && o.categoria !== filtros.categoria) return false;
      if (filtros.situacao && o.situacao !== filtros.situacao) return false;
      return true;
    });
    if (!obras.length) return [];

    const maxCusto = Math.max(...obras.map((o) => o.valor_atualizado || 0), 1);

    const brutos = obras.map((obra) => {
      const indicadores = dados.indicadoresMunicipais?.[obra.municipio_codigo] || {};
      const custo = obra.valor_atualizado || 0;
      return {
        obra,
        populacao: indicadores.populacao || 0,
        impacto: custo,
        criticidade: criticidadeDaObra(obra),
        acessibilidade: contexto.malha.get(obra.municipio_codigo) || 0,
        custo,
        risco_ambiental: classificarRiscoAmbiental(contexto.risco.get(obra.id)),
        maturidade: obra.percentual_execucao_fisica || 0,
        orcamento: maxCusto ? 1 - custo / maxCusto : 1,
      };
    });

    const normalizadores = {};
    criterios.forEach((c) => {
      normalizadores[c.id] = normalizarSerie(brutos.map((b) => b[c.id]));
    });

    return brutos
      .map((b) => {
        const valores = {};
        const contribuicoes = {};
        let total = 0;
        criterios.forEach((c) => {
          const bruto = normalizadores[c.id](b[c.id]);
          const norm = c.sentido === "menor" ? 1 - bruto : bruto;
          const peso = (pesos[c.id] || 0) / 100;
          valores[c.id] = norm;
          contribuicoes[c.id] = norm * peso * 100;
          total += norm * peso;
        });
        return {
          ...b,
          valores,
          contribuicoes,
          pontuacao: Number((total * 100).toFixed(2)),
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
  }

  /* -------------------------------------------------------------- cenario */

  const estado = { orcamento: null, selecao: [] };

  function renderCenario(lista) {
    limpar(areaCenario);
    areaCenario.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Cenário de investimento" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Defina o orçamento disponível: as obras são selecionadas em ordem de pontuação (as de maior " +
              "pontuação entram primeiro). Uma obra que não cabe no saldo é pulada, e as seguintes, menores, " +
              "podem entrar.",
          }),
        ]),
        etiquetaStatus("SIMULADO", "Custos da base demonstrativa"),
      ])
    );

    if (!lista.length) {
      areaCenario.append(el("p", { className: "painel__descricao", text: "Nenhuma obra candidata no recorte atual." }));
      return;
    }

    const total = lista.reduce((acc, l) => acc + (l.obra.valor_atualizado || 0), 0);
    const inicial = Math.round(total * 0.25);
    if (estado.orcamento === null || estado.orcamento > total) estado.orcamento = inicial;

    const saida = el("p", { className: "painel__titulo", text: "" });
    const resumo = el("ul", { className: "lista-resumo" });

    function calcular() {
      const orcamento = Number(estado.orcamento);
      let saldo = orcamento;
      const selecionadas = [];
      lista.forEach((c) => {
        const custo = c.obra.valor_atualizado || 0;
        if (custo <= saldo) {
          saldo -= custo;
          selecionadas.push(c);
        }
      });
      estado.selecao = selecionadas;
      const usado = orcamento - saldo;
      saida.textContent = `${selecionadas.length} de ${lista.length} obras cabem em ${moeda(orcamento)}`;
      limpar(resumo);
      resumo.append(
        el("li", {}, [el("span", { text: "Orçamento aplicado" }), el("strong", { text: moeda(orcamento) })]),
        el("li", {}, [el("span", { text: "Investimento comprometido" }), el("strong", { text: moeda(usado) })]),
        el("li", {}, [el("span", { text: "Saldo remanescente" }), el("strong", { text: moeda(saldo) })]),
        el("li", {}, [
          el("span", { text: "Cobertura da carteira" }),
          el("strong", { text: percentual(total ? (usado / total) * 100 : 0) }),
        ])
      );
    }

    const slider = el("input", {
      type: "range",
      className: "campo",
      id: "orcamento-planejamento",
      min: "0",
      max: String(Math.round(total)),
      step: String(Math.max(1, Math.round(total / 200))),
      value: String(Math.round(estado.orcamento)),
      "aria-label": "Orçamento disponível para o cenário de investimento",
      oninput: (ev) => {
        estado.orcamento = Number(ev.target.value);
        rotuloOrcamento.textContent = moeda(estado.orcamento);
        calcular();
      },
    });
    const rotuloOrcamento = el("p", { className: "campo-rotulo", text: moeda(estado.orcamento) });

    areaCenario.append(
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "orcamento-planejamento", text: "Orçamento disponível" }),
        slider,
        rotuloOrcamento,
      ]),
      saida,
      resumo
    );
    calcular();
  }

  /* -------------------------------------------------------------- render */

  function render() {
    const lista = candidatos();

    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Projetos candidatos",
        valor: numero(lista.length),
        detalhe: `${numero(new Set(lista.map((l) => l.obra.municipio)).size)} municípios em carteira`,
        icone: "🧭",
        rodape: "Obras da base demonstrativa (SIMULADO)",
      }),
      cartaoIndicador({
        titulo: "Pontuação máxima",
        valor: lista.length ? numero(lista[0].pontuacao, 1) : "—",
        detalhe: "Escala de 0 a 100 pontos",
        icone: "🏅",
        tom: "positivo",
      }),
      cartaoIndicador({
        titulo: "Investimento da carteira",
        valor: moedaCompacta(lista.reduce((acc, l) => acc + (l.obra.valor_atualizado || 0), 0)),
        detalhe: "Soma do valor atualizado das obras do recorte",
        icone: "💰",
      }),
      cartaoIndicador({
        titulo: "Concentração no topo",
        valor: percentual(
          lista.length
            ? (lista.slice(0, 10).reduce((acc, l) => acc + (l.obra.valor_atualizado || 0), 0) /
                Math.max(1, lista.reduce((acc, l) => acc + (l.obra.valor_atualizado || 0), 0))) *
              100
            : 0
        ),
        detalhe: "Participação das 10 obras mais bem pontuadas no investimento",
        icone: "📊",
      })
    );

    renderGrafico(lista);
    renderCenario(lista);
    renderRanking(lista);
    renderDetalhe(lista);
  }

  function renderGrafico(lista) {
    destruirGraficos();
    limpar(areaGrafico);
    areaGrafico.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Pontuação dos projetos priorizados" }),
          el("p", { className: "painel__descricao", text: "Top 15 por pontuação final da matriz multicritério." }),
        ]),
        etiquetaStatus("SIMULADO", "Obras candidatas"),
      ])
    );
    const grafico = el("div", { className: "grafico grafico--alto" });
    areaGrafico.append(grafico);
    const topo = lista.slice(0, 15);
    graficoBarrasHorizontais(grafico, {
      rotulos: topo.map((l) => `${l.obra.id} — ${l.obra.municipio}`),
      valores: topo.map((l) => l.pontuacao),
      formatador: (v) => `${numero(v, 1)} pts`,
      cor: "#0b6e4f",
    });
  }

  function renderRanking(lista) {
    limpar(areaRanking);
    areaRanking.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Ranking depriorização de investimento" }),
          el("p", { className: "painel__descricao", text: "Ordenado pela pontuação final da matriz." }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const corpo = el("div");
    areaRanking.append(corpo);
    let acumulado = 0;
    const total = lista.reduce((acc, l) => acc + (l.obra.valor_atualizado || 0), 0);
    const linhas = lista.map((l, i) => {
      acumulado += l.obra.valor_atualizado || 0;
      return {
        posicao: i + 1,
        id: l.obra.id,
        obra: l.obra.titulo,
        municipio: l.obra.municipio,
        categoria: l.obra.categoria_nome,
        pontuacao: l.pontuacao,
        custo: l.obra.valor_atualizado || 0,
        acumulado,
        acumuladoPercentual: total ? Number(((acumulado / total) * 100).toFixed(1)) : 0,
      };
    });
    criarTabela(corpo, {
      colunas: [
        { chave: "posicao", rotulo: "#", alinhamento: "direita" },
        { chave: "id", rotulo: "Obra" },
        { chave: "obra", rotulo: "Título" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "categoria", rotulo: "Categoria" },
        { chave: "pontuacao", rotulo: "Pontuação", alinhamento: "direita" },
        { chave: "custo", rotulo: "Custo estimado", alinhamento: "direita" },
        { chave: "acumulado", rotulo: "Acumulado", alinhamento: "direita" },
        { chave: "acumuladoPercentual", rotulo: "% da carteira", alinhamento: "direita" },
      ],
      linhas,
      nomeExportacao: "planejamento-ranking",
      porPagina: 20,
    });
  }

  function renderDetalhe(lista) {
    limpar(areaDetalhe);
    areaDetalhe.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Contribuição de cada critério" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Cada coluna mostra os pontos que o critério adicionou à pontuação final (valor normalizado × peso). " +
              "A soma das colunas é a pontuação do projeto.",
          }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const corpo = el("div");
    areaDetalhe.append(corpo);
    const linhas = lista.slice(0, 120).map((l) => {
      const linha = {
        id: l.obra.id,
        municipio: l.obra.municipio,
        pontuacao: l.pontuacao,
      };
      criterios.forEach((c) => {
        linha[`contrib_${c.id}`] = Number((l.contribuicoes[c.id] || 0).toFixed(2));
      });
      return linha;
    });
    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Obra" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "pontuacao", rotulo: "Pontuação", alinhamento: "direita" },
        ...criterios.map((c) => ({
          chave: `contrib_${c.id}`,
          rotulo: c.nome.length > 18 ? `${c.nome.slice(0, 17)}…` : c.nome,
          alinhamento: "direita",
        })),
      ],
      linhas,
      nomeExportacao: "planejamento-detalhe-criterios",
      porPagina: 20,
    });
  }

  /* --------------------------------------------------------------- render */

  criarBarraFiltros(areaFiltros, { mostrar: ["municipio", "categoria", "situacao", "periodo"] });
  criarChipsFiltros(areaChips, () => {
    store.definir({ filtros: { ...store.obter("filtros") } });
  });

  renderPesos();
  render();
  areaCarregando.remove();

  const cancelar = store.inscrever("filtros", render);

  return {
    destruir() {
      cancelar();
      destruirGraficos();
    },
  };
}
