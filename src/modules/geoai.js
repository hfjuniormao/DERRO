/**
 * APP 13 — GeoAI e inteligencia preditiva.
 *
 * IMPORTANTE: as seis analises abaixo sao calculadas por REGRAS DETERMINISTICAS
 * (heuristicas) sobre os dados carregados. NAO ha modelo treinado, rede neural,
 * aprendizado de maquina ou inferencia estatistica — e nunca devem ser apresentadas
 * como resultado de IA treinada.
 *
 * Cada analise exibe a regra utilizada e a lista dos registros avaliados.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoIndicador } from "../components/cards.js";
import { graficoBarrasHorizontais, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { etiquetaStatus, blocoAviso } from "../components/ui.js";
import { numero, percentual } from "../utils/format.js";
import { malhaPorMunicipio, trechosDaMalhaReal, normalizarSerie } from "./_geoespacial.js";
import { areasAmbiente, cruzarObrasComAreas } from "./_ambiente.js";

/** Pontuacao por situacao de obra usada na analise de atraso. */
const PESO_SITUACAO = {
  paralisada: 1,
  atrasada: 0.8,
  em_execucao: 0.4,
  planejada: 0.2,
  concluida: 0,
  cancelada: 0,
};

/** Pontuacao por condicao do ativo. */
const PESO_CONDICAO = { critica: 1, ruim: 0.75, regular: 0.4, boa: 0.1 };

/** Pontuacao por criticidade do ativo. */
const PESO_CRITICIDADE = { critica: 1, alta: 0.75, media: 0.4, baixa: 0.15 };

/** Ano de referencia para a idade dos ativos. */
const ANO_REFERENCIA = 2026;

function nivelDeRisco(pontuacao) {
  if (pontuacao >= 0.66) return { rotulo: "Alto", classe: "etiqueta--simulado", cor: "#b23a48" };
  if (pontuacao >= 0.33) return { rotulo: "Médio", classe: "etiqueta--neutra", cor: "#d97a1f" };
  return { rotulo: "Baixo", classe: "etiqueta--real", cor: "#1f8a70" };
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "GeoAI e inteligência preditiva" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Seis análises calculadas por regras demonstrativas sobre os dados carregados: atraso de obras, " +
            "deterioração rodoviária, priorização de manutenção, anomalias contratuais, gargalos logísticos e " +
            "risco socioambiental. Cada painel traz a regra aplicada e os registros avaliados.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Análises demonstrativas")]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "MODELO HEURÍSTICO DEMONSTRATIVO — NÃO É IA TREINADA",
      "Os resultados abaixo vêm de regras fixas e determinísticas aplicadas aos registros da plataforma. " +
        "Não existe modelo de aprendizado de máquina, treinamento com dados históricos nem previsão estatística. " +
        "Use-os como apoio à leitura da equipe técnica, nunca como parecer, laudo ou decisão automática.",
      "perigo"
    )
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaAbas = el("div", { className: "chips" });
  const areaPainel = el("div");
  const areaGrafico = el("div", { className: "painel" });
  pagina.append(areaKpis, areaAbas, areaPainel, areaGrafico);
  container.append(pagina);

  /* ------------------------------------------------------------- base */

  const areas = await areasAmbiente();

  const contexto = { malha: new Map(), risco: new Map() };

  await new Promise((resolve) => setTimeout(resolve, 0));

  const trechos = trechosDaMalhaReal(dados);
  const municipios = (dados.municipios || []).map((m) => ({
    codigo_ibge: m.codigo_ibge,
    nome: m.nome,
    geometria: m.geometria,
  }));
  contexto.malha = malhaPorMunicipio(trechos, municipios, 2);
  const { riscoPorObra } = cruzarObrasComAreas(dados.obras, areas);
  contexto.risco = riscoPorObra;

  /* ---------------------------------------------------------- analises */

  function recorteObras() {
    const filtros = store.obter("filtros");
    return dados.obras.filter((o) => {
      if (filtros.municipio && String(o.municipio_codigo) !== String(filtros.municipio)) return false;
      if (filtros.categoria && o.categoria !== filtros.categoria) return false;
      return true;
    });
  }

  function recorteAtivos() {
    const filtros = store.obter("filtros");
    return dados.ativos.filter((a) => {
      if (filtros.municipio && String(a.municipio_codigo) !== String(filtros.municipio)) return false;
      return true;
    });
  }

  function recorteContratos() {
    const filtros = store.obter("filtros");
    return dados.contratos.filter((c) => {
      if (filtros.municipio && c.municipio !== filtros.municipioNome) return false;
      return true;
    });
  }

  /** (a) Risco de atraso de obras. */
  function analiseAtraso() {
    const obras = recorteObras();
    const hoje = new Date();
    const maxValor = Math.max(...obras.map((o) => o.valor_atualizado || 0), 1);
    const linhas = obras
      .map((obra) => {
        const inicio = obra.data_inicio ? new Date(`${obra.data_inicio}T12:00:00`) : null;
        const fim = obra.data_fim_prevista ? new Date(`${obra.data_fim_prevista}T12:00:00`) : null;
        let progressoTempo = 0;
        if (inicio && fim && fim > inicio) {
          progressoTempo = ((hoje - inicio) / (fim - inicio)) * 100;
          progressoTempo = Math.max(0, Math.min(120, progressoTempo));
        }
        const fisico = obra.percentual_execucao_fisica || 0;
        const defasagem = progressoTempo - fisico;
        const dias = obra.dias_atraso || 0;
        const pontuacao =
          0.4 * Math.min(1, dias / 365) +
          0.3 * Math.min(1, Math.max(0, defasagem) / 50) +
          0.2 * (PESO_SITUACAO[obra.situacao] ?? 0) +
          0.1 * Math.min(1, (obra.valor_atualizado || 0) / maxValor);
        const nivel = nivelDeRisco(pontuacao);
        return {
          id: obra.id,
          obra: obra.titulo,
          municipio: obra.municipio,
          situacao: obra.situacao_nome || obra.situacao,
          dias_atraso: dias,
          fisico: Number(fisico.toFixed(1)),
          tempo: Number(progressoTempo.toFixed(1)),
          defasagem: Number(defasagem.toFixed(1)),
          valor: obra.valor_atualizado || 0,
          pontuacao: Number((pontuacao * 100).toFixed(1)),
          nivel: nivel.rotulo,
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
    return {
      linhas,
      regra:
        "Pontuação de atraso = 0,40 × min(1, dias de atraso ÷ 365) + 0,30 × min(1, defasagem ÷ 50 pontos) + " +
        "0,20 × peso da situação (paralisada 1,0 · atrasada 0,8 · em execução 0,4 · planejada 0,2) + " +
        "0,10 × valor da obra ÷ maior valor da base. Defasagem = % do tempo decorrido − % de execução física. " +
        "Níveis: alto ≥ 66, médio ≥ 33, baixo abaixo de 33.",
      grafico: {
        rotulos: linhas.slice(0, 15).map((l) => `${l.id} — ${l.municipio}`),
        valores: linhas.slice(0, 15).map((l) => l.pontuacao),
        formatador: (v) => `${numero(v, 1)} pts`,
      },
      colunas: [
        { chave: "id", rotulo: "Obra" },
        { chave: "obra", rotulo: "Título" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "situacao", rotulo: "Situação" },
        { chave: "dias_atraso", rotulo: "Dias de atraso", alinhamento: "direita" },
        { chave: "fisico", rotulo: "% físico", alinhamento: "direita" },
        { chave: "tempo", rotulo: "% do prazo", alinhamento: "direita" },
        { chave: "defasagem", rotulo: "Defasagem (p.p.)", alinhamento: "direita" },
        { chave: "valor", rotulo: "Valor", alinhamento: "direita" },
        { chave: "pontuacao", rotulo: "Pontuação", alinhamento: "direita" },
        {
          chave: "nivel",
          rotulo: "Nível",
          renderizar: (linha) =>
            el("span", {
              className: `etiqueta ${linha.nivel === "Alto" ? "etiqueta--simulado" : linha.nivel === "Médio" ? "etiqueta--neutra" : "etiqueta--real"}`,
              text: linha.nivel,
            }),
        },
      ],
    };
  }

  /** (b) Deterioracao rodoviaria por rodovia. */
  function analiseDeterioracao() {
    const ativos = recorteAtivos();
    const mapa = new Map();
    ativos.forEach((ativo) => {
      const chave = ativo.rodovia || "Sem rodovia";
      const atual = mapa.get(chave) || { rodovia: chave, total: 0, ruins: 0, criticas: 0, criticidadeAlta: 0 };
      atual.total += 1;
      if (ativo.condicao === "ruim") atual.ruins += 1;
      if (ativo.condicao === "critica") atual.criticas += 1;
      if (ativo.criticidade === "alta" || ativo.criticidade === "critica") atual.criticidadeAlta += 1;
      mapa.set(chave, atual);
    });
    const linhas = [...mapa.values()]
      .map((l) => ({
        ...l,
        deterioracao: Number(((l.ruins + l.criticas) / Math.max(1, l.total)) * 100).toFixed(1),
        indice: Number(
          (0.5 * ((l.ruins + l.criticas) / Math.max(1, l.total)) + 0.5 * (l.criticidadeAlta / Math.max(1, l.total))).toFixed(3)
        ),
      }))
      .sort((a, b) => b.indice - a.indice);
    return {
      linhas,
      regra:
        "Deterioração da rodovia = (ativos em condição ruim + em condição crítica) ÷ total de ativos na via. " +
        "Índice depriorização = 0,50 × deterioração + 0,50 × (ativos com criticidade alta ou crítica ÷ total " +
        "da via). A condição do ativo é a registrada na inspeção mais recente da base demonstrativa.",
      grafico: {
        rotulos: linhas.slice(0, 15).map((l) => l.rodovia),
        valores: linhas.slice(0, 15).map((l) => Number((l.indice * 100).toFixed(1))),
        formatador: (v) => `${numero(v, 1)} pts`,
      },
      colunas: [
        { chave: "rodovia", rotulo: "Rodovia" },
        { chave: "total", rotulo: "Ativos", alinhamento: "direita" },
        { chave: "ruins", rotulo: "Condição ruim", alinhamento: "direita" },
        { chave: "criticas", rotulo: "Condição crítica", alinhamento: "direita" },
        { chave: "criticidadeAlta", rotulo: "Criticidade alta/crítica", alinhamento: "direita" },
        { chave: "deterioracao", rotulo: "Deterioração", alinhamento: "direita" },
        { chave: "indice", rotulo: "Índice de priorização", alinhamento: "direita" },
      ],
    };
  }

  /** (c) Priorizacao de manutencao dos ativos. */
  function analiseManutencao() {
    const ativos = recorteAtivos();
    const hoje = new Date();
    const linhas = ativos
      .map((ativo) => {
        const condicao = PESO_CONDICAO[ativo.condicao] ?? 0.4;
        const criticidade = PESO_CRITICIDADE[ativo.criticidade] ?? 0.3;
        const idade = Math.min(1, Math.max(0, (ANO_REFERENCIA - (ativo.ano_implantacao || ANO_REFERENCIA)) / 40));
        let semInspecao = 0;
        if (ativo.ultima_inspecao) {
          const data = new Date(`${ativo.ultima_inspecao}T12:00:00`);
          semInspecao = Math.min(1, Math.max(0, (hoje - data) / (365 * 5 * 86400000)));
        }
        const pontuacao = 0.35 * condicao + 0.3 * criticidade + 0.2 * idade + 0.15 * semInspecao;
        const nivel = nivelDeRisco(pontuacao);
        return {
          id: ativo.id,
          tipo: ativo.tipo_nome,
          municipio: ativo.municipio,
          rodovia: ativo.rodovia || "—",
          condicao: ativo.condicao_nome || ativo.condicao,
          criticidade: ativo.criticidade,
          implantacao: ativo.ano_implantacao,
          inspecao: ativo.ultima_inspecao || "—",
          pontuacao: Number((pontuacao * 100).toFixed(1)),
          nivel: nivel.rotulo,
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
    return {
      linhas,
      regra:
        "Prioridade de manutenção = 0,35 × condição (crítica 1,0 · ruim 0,75 · regular 0,40 · boa 0,10) + " +
        "0,30 × criticidade (crítica 1,0 · alta 0,75 · média 0,40 · baixa 0,15) + 0,20 × idade do ativo " +
        "(anos ÷ 40) + 0,15 × tempo sem inspeção (anos ÷ 5).",
      grafico: {
        rotulos: linhas.slice(0, 15).map((l) => `${l.id} — ${l.tipo}`),
        valores: linhas.slice(0, 15).map((l) => l.pontuacao),
        formatador: (v) => `${numero(v, 1)} pts`,
      },
      colunas: [
        { chave: "id", rotulo: "Ativo" },
        { chave: "tipo", rotulo: "Tipo" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "rodovia", rotulo: "Rodovia" },
        { chave: "condicao", rotulo: "Condição" },
        { chave: "criticidade", rotulo: "Criticidade" },
        { chave: "implantacao", rotulo: "Implantação", alinhamento: "direita" },
        { chave: "inspecao", rotulo: "Última inspeção" },
        { chave: "pontuacao", rotulo: "Prioridade", alinhamento: "direita" },
        {
          chave: "nivel",
          rotulo: "Nível",
          renderizar: (linha) =>
            el("span", {
              className: `etiqueta ${linha.nivel === "Alto" ? "etiqueta--simulado" : linha.nivel === "Médio" ? "etiqueta--neutra" : "etiqueta--real"}`,
              text: linha.nivel,
            }),
        },
      ],
    };
  }

  /** (d) Anomalias contratuais. */
  function analiseContratos() {
    const contratos = recorteContratos();
    const obraPorId = new Map(dados.obras.map((o) => [o.id, o]));
    const linhas = [];
    contratos.forEach((contrato) => {
      const aditivo = contrato.valor_inicial
        ? ((contrato.valor_atualizado || 0) / contrato.valor_inicial - 1) * 100
        : 0;
      if (aditivo > 20) {
        linhas.push({
          id: contrato.id,
          contrato: contrato.objeto,
          municipio: contrato.municipio,
          tipo: "Aditivo acima de 20%",
          detalhe: `Aditivo de ${percentual(aditivo)} sobre o valor inicial`,
          valor: contrato.valor_atualizado || 0,
          gravidade: aditivo > 40 ? "Alta" : "Média",
        });
      }
      const obrasVinculadas = contrato.obras || [];
      if (!obrasVinculadas.length) {
        linhas.push({
          id: contrato.id,
          contrato: contrato.objeto,
          municipio: contrato.municipio,
          tipo: "Contrato sem obra vinculada",
          detalhe: "Nenhuma obra da base está associada a este contrato",
          valor: contrato.valor_atualizado || 0,
          gravidade: "Média",
        });
      }
      obrasVinculadas.forEach((obraId) => {
        const obra = obraPorId.get(obraId);
        if (!obra) return;
        const fisico = obra.percentual_execucao_fisica || 0;
        const financeiro = obra.percentual_execucao_financeira || 0;
        if (financeiro - fisico > 20) {
          linhas.push({
            id: `${contrato.id} / ${obraId}`,
            contrato: contrato.objeto,
            municipio: contrato.municipio,
            tipo: "Execução financeira à frente da física",
            detalhe: `${obraId}: financeiro ${percentual(financeiro)} × físico ${percentual(fisico)}`,
            valor: contrato.valor_atualizado || 0,
            gravidade: financeiro - fisico > 35 ? "Alta" : "Média",
          });
        }
      });
    });
    const ordenadas = linhas.sort((a, b) => a.gravidade.localeCompare(b.gravidade));
    const porTipo = new Map();
    ordenadas.forEach((l) => porTipo.set(l.tipo, (porTipo.get(l.tipo) || 0) + 1));
    return {
      linhas: ordenadas,
      grafico: {
        rotulos: [...porTipo.keys()],
        valores: [...porTipo.values()],
        formatador: (v) => `${numero(v)}`,
      },
      regra:
        "Três regras de anomalia: (1) aditivo — valor atualizado ÷ valor inicial − 1 acima de 20%; " +
        "(2) execução física << execução financeira — diferença acima de 20 pontos percentuais entre a obra " +
        "vinculada e o contrato; (3) contrato sem obra vinculada — nenhum identificador de obra associado.",
      colunas: [
        { chave: "id", rotulo: "Contrato" },
        { chave: "contrato", rotulo: "Objeto" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "tipo", rotulo: "Anomalia" },
        { chave: "detalhe", rotulo: "Detalhe" },
        { chave: "valor", rotulo: "Valor do contrato", alinhamento: "direita" },
        {
          chave: "gravidade",
          rotulo: "Gravidade",
          renderizar: (linha) =>
            el("span", {
              className: `etiqueta ${linha.gravidade === "Alta" ? "etiqueta--simulado" : "etiqueta--neutra"}`,
              text: linha.gravidade,
            }),
        },
      ],
    };
  }

  /** (e) Gargalos logisticos por municipio. */
  function analiseGargalos() {
    const obras = recorteObras();
    const porMunicipio = new Map();
    obras.forEach((obra) => {
      const atual = porMunicipio.get(obra.municipio_codigo) || {
        codigo: obra.municipio_codigo,
        municipio: obra.municipio,
        quantidade: 0,
        valor: 0,
        atrasadas: 0,
      };
      atual.quantidade += 1;
      atual.valor += obra.valor_atualizado || 0;
      if (obra.situacao === "atrasada" || obra.situacao === "paralisada") atual.atrasadas += 1;
      porMunicipio.set(obra.municipio_codigo, atual);
    });

    const base = [...porMunicipio.values()].map((m) => ({
      ...m,
      malha: Number((contexto.malha.get(m.codigo) || 0).toFixed(1)),
      populacao: dados.indicadoresMunicipais?.[m.codigo]?.populacao || 0,
    }));

    const normObras = normalizarSerie(base.map((m) => m.quantidade));
    const normMalha = normalizarSerie(base.map((m) => -m.malha));
    const normPop = normalizarSerie(base.map((m) => m.populacao));

    const linhas = base
      .map((m) => ({
        ...m,
        indice: Number(
          (0.5 * normObras(m.quantidade) + 0.3 * normMalha(-m.malha) + 0.2 * normPop(m.populacao)).toFixed(3)
        ),
      }))
      .sort((a, b) => b.indice - a.indice);
    return {
      linhas,
      regra:
        "Gargalo logístico = 0,50 × (obras no município normalizado) + 0,30 × (malha viária real invertida: " +
        "menos quilometragem significa maior gargalo) + 0,20 × população (IBGE). A malha viária é medida sobre " +
        "a geometria oficial do SNV e das vias estaduais, com amostragem de 2 km.",
      grafico: {
        rotulos: linhas.slice(0, 15).map((l) => l.municipio),
        valores: linhas.slice(0, 15).map((l) => Number((l.indice * 100).toFixed(1))),
        formatador: (v) => `${numero(v, 1)} pts`,
      },
      colunas: [
        { chave: "municipio", rotulo: "Município" },
        { chave: "quantidade", rotulo: "Obras", alinhamento: "direita" },
        { chave: "atrasadas", rotulo: "Atrasadas/paralisadas", alinhamento: "direita" },
        { chave: "malha", rotulo: "Malha viária (km)", alinhamento: "direita" },
        { chave: "populacao", rotulo: "População", alinhamento: "direita" },
        { chave: "valor", rotulo: "Investimento", alinhamento: "direita" },
        { chave: "indice", rotulo: "Índice de gargalo", alinhamento: "direita" },
      ],
    };
  }

  /** (f) Risco socioambiental. */
  function analiseRiscoAmbiental() {
    const obras = recorteObras();
    const { areas: areasCruizadas } = cruzarObrasComAreas(obras, areas);
    const areaDe = new Map();
    areasCruizadas.forEach((a) => a.obras.forEach((o) => areaDe.set(o.id, a.nome)));

    const linhas = obras
      .map((obra) => {
        const risco = contexto.risco.get(obra.id);
        const dentro = Boolean(risco?.dentro);
        const pontuacao = dentro ? 100 : risco?.distanciaKm !== null && risco?.distanciaKm !== undefined
          ? Math.max(0, Math.round(100 - risco.distanciaKm * 4))
          : 10;
        return {
          id: obra.id,
          obra: obra.titulo,
          municipio: obra.municipio,
          categoria: obra.categoria_nome,
          area: areaDe.get(obra.id) || "—",
          distancia: risco?.distanciaKm !== null && risco?.distanciaKm !== undefined ? risco.distanciaKm : "—",
          pontuacao,
          situacao: dentro ? "Dentro de área de proteção" : "Proximidade",
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
    return {
      linhas,
      regra:
        "Risco socioambiental = 100 pontos para obra dentro de área de proteção (teste ponto-em-polígono sobre a " +
        "geometria oficial) e, para as demais, 100 − 4 × distância em km ao centroide da área mais próxima, " +
        "com piso de 10 pontos. É uma leitura geométrica exploratória: o risco socioambiental real depende de " +
        "estudo de impacto, fauna, vegetação e uso do solo.",
      grafico: {
        rotulos: linhas.slice(0, 15).map((l) => `${l.id} — ${l.municipio}`),
        valores: linhas.slice(0, 15).map((l) => l.pontuacao),
        formatador: (v) => `${numero(v, 1)} pts`,
      },
      grafico: {
        rotulos: linhas.slice(0, 15).map((l) => `${l.id} — ${l.municipio}`),
        valores: linhas.slice(0, 15).map((l) => l.pontuacao),
        formatador: (v) => `${numero(v, 1)} pts`,
      },
      colunas: [
        { chave: "id", rotulo: "Obra" },
        { chave: "obra", rotulo: "Título" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "categoria", rotulo: "Categoria" },
        { chave: "area", rotulo: "Área de proteção" },
        { chave: "distancia", rotulo: "Distância (km)", alinhamento: "direita" },
        { chave: "pontuacao", rotulo: "Risco", alinhamento: "direita" },
        {
          chave: "situacao",
          rotulo: "Situação",
          renderizar: (linha) =>
            el("span", {
              className: `etiqueta ${linha.situacao === "Dentro de área de proteção" ? "etiqueta--simulado" : "etiqueta--neutra"}`,
              text: linha.situacao,
            }),
        },
      ],
    };
  }

  /* --------------------------------------------------------------- abas */

  const ANALISES = [
    { id: "atraso", nome: "Risco de atraso", executar: analiseAtraso },
    { id: "deterioracao", nome: "Deterioração rodoviária", executar: analiseDeterioracao },
    { id: "manutencao", nome: "Priorização de manutenção", executar: analiseManutencao },
    { id: "contratos", nome: "Anomalias contratuais", executar: analiseContratos },
    { id: "gargalos", nome: "Gargalos logísticos", executar: analiseGargalos },
    { id: "ambiental", nome: "Risco socioambiental", executar: analiseRiscoAmbiental },
  ];

  let abaAtiva = "atraso";

  function renderAbas() {
    limpar(areaAbas);
    ANALISES.forEach((analise) => {
      areaAbas.append(
        el("button", {
          className: "chip",
          type: "button",
          text: analise.nome,
          "aria-pressed": analise.id === abaAtiva ? "true" : "false",
          onclick: () => {
            abaAtiva = analise.id;
            renderAbas();
            renderPainel();
          },
        })
      );
    });
  }

  function renderPainel() {
    const analise = ANALISES.find((a) => a.id === abaAtiva) || ANALISES[0];
    const resultado = analise.executar();
    limpar(areaPainel);
    const painel = el("section", { className: "painel" }, [
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: analise.nome }),
          el("p", { className: "painel__descricao", text: resultado.regra }),
        ]),
        etiquetaStatus("SIMULADO", "Regra heurística"),
      ]),
    ]);
    const corpo = el("div");
    painel.append(corpo);
    areaPainel.append(painel);
    criarTabela(corpo, {
      colunas: resultado.colunas,
      linhas: resultado.linhas,
      nomeExportacao: `geoai-${analise.id}`,
      porPagina: 20,
      vazio: "Nenhum registro atende à regra aplicada no recorte atual.",
    });
  }

  function renderGrafico() {
    destruirGraficos();
    limpar(areaGrafico);
    const analise = ANALISES.find((a) => a.id === abaAtiva) || ANALISES[0];
    const resultado = analise.executar();
    areaGrafico.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: `Distribuição — ${analise.nome.toLowerCase()}` }),
          el("p", {
            className: "painel__descricao",
            text: "Top 15 registros pela pontuação da regra aplicada (top 15 por pontuação ou por índice).",
          }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const grafico = el("div", { className: "grafico grafico--alto" });
    areaGrafico.append(grafico);

    const descriptor = resultado.grafico;
    if (!descriptor || !descriptor.valores.length) {
      areaGrafico.append(el("p", { className: "painel__descricao", text: "Sem registros no recorte atual." }));
      return;
    }
    graficoBarrasHorizontais(grafico, {
      rotulos: descriptor.rotulos,
      valores: descriptor.valores,
      formatador: descriptor.formatador,
      cor: "#5b4b8a",
    });
  }

  function renderKpis() {
    const atraso = analiseAtraso();
    const deterioracao = analiseDeterioracao();
    const contratos = analiseContratos();
    const gargalos = analiseGargalos();
    const ambiental = analiseRiscoAmbiental();
    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Obras em risco alto de atraso",
        valor: numero(atraso.linhas.filter((l) => l.nivel === "Alto").length),
        detalhe: `De ${numero(atraso.linhas.length)} obras avaliadas`,
        icone: "⏱️",
        tom: "critico",
        rodape: "Regra heurística demonstrativa",
      }),
      cartaoIndicador({
        titulo: "Vias com deterioração acima de 40%",
        valor: numero(deterioracao.linhas.filter((l) => l.deterioracao > 40).length),
        detalhe: `${numero(deterioracao.linhas.length)} vias avaliadas`,
        icone: "🛣️",
        tom: "alerta",
      }),
      cartaoIndicador({
        titulo: "Anomalias contratuais",
        valor: numero(contratos.linhas.length),
        detalhe: `${numero(contratos.linhas.filter((l) => l.gravidade === "Alta").length)} de gravidade alta`,
        icone: "📄",
        tom: contratos.linhas.length ? "alerta" : "padrao",
      }),
      cartaoIndicador({
        titulo: "Municípios com gargalo logístico",
        valor: numero(gargalos.linhas.filter((l) => l.indice > 0.6).length),
        detalhe: "Índice de gargalo acima de 0,60",
        icone: "🚧",
        tom: "alerta",
      }),
      cartaoIndicador({
        titulo: "Obras dentro de área de proteção",
        valor: numero(ambiental.linhas.filter((l) => l.situacao === "Dentro de área de proteção").length),
        detalhe: "Cruzamento exploratório sobre geometria oficial",
        icone: "🌿",
        tom: "critico",
      })
    );
  }

  /* --------------------------------------------------------------- render */

  criarBarraFiltros(areaFiltros, { mostrar: ["municipio", "categoria", "periodo"] });
  criarChipsFiltros(areaChips, () => {
    store.definir({ filtros: { ...store.obter("filtros") } });
  });

  renderKpis();
  renderAbas();
  renderPainel();
  renderGrafico();

  const cancelar = store.inscrever("filtros", () => {
    renderKpis();
    renderPainel();
    renderGrafico();
  });

  return {
    destruir() {
      cancelar();
      destruirGraficos();
    },
  };
}
