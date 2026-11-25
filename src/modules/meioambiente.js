/**
 * APP 11 — Meio ambiente e licenciamento.
 *
 * Areas de protecao e unidades de conservacao REAIS (data/ambiente.geojson),
 * hidrografia e zoneamento marcados como INDISPONIVEIS e um cruzamento
 * espacial SIMPLES entre as obras (SIMULADAS) e as areas de protecao.
 *
 * O cruzamento e uma ANALISE EXPLORATÓRIA DEMONSTRATIVA: conta os pontos de
 * obra que caem dentro de cada poligono (ponto-em-poligono local) e NAO
 * substitui pareceres, laudos ou licencas oficiais.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoIndicador } from "../components/cards.js";
import { graficoBarras, graficoRosca, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { ajustarAlturaMapa } from "./_mapa.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import { etiquetaStatus, blocoAviso } from "../components/ui.js";
import { numero } from "../utils/format.js";
import { areasAmbiente, cruzarObrasComAreas } from "./_ambiente.js";

/** Fontes que dependem de acesso oficial e nao estao publicadas nesta versao. */
const FONTES_INDISPONIVEIS = [
  {
    id: "hidrografia",
    nome: "Hidrografia",
    descricao:
      "Eixo do Rio Madeira, lagos,igarapés, bacias hidrográficas e áreas de várzea. Requer a base oficial " +
      "da ANA/SEM e o georreferenciamento dos trechos navegáveis.",
  },
  {
    id: "zoneamento",
    nome: "Zoneamento urbano",
    descricao:
      "Lei de zoneamento, zonas de uso e seus condicionantes de ocupação. Requer as leis municipais " +
      "publicadas em diário oficial e o cadastro de quadras.",
  },
  {
    id: "areas-restricao",
    nome: "Áreas de restrição",
    descricao:
      "Unidades de Conservação, terras indígenas, APPs de curso d'água e áreas de segurança de aeródromos. " +
      "Apenas as áreas de proteção com geometria pública estão carregadas; o restante depende de credencial " +
      "do órgão publicador (CNPq/INPE/SEDAM).",
  },
];

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Meio ambiente e licenciamento" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Áreas de proteção e unidades de conservação com geometria oficial, cruzamento exploratório com as " +
            "obras em carteira e o registro explícito das bases ambientais ainda indisponíveis (hidrografia e " +
            "zoneamento).",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        etiquetaStatus("REAL", "Áreas de proteção"),
        etiquetaStatus("SIMULADO", "Obras"),
      ]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "ANÁLISE EXPLORATÓRIA DEMONSTRATIVA",
      "O cruzamento entre obras e áreas de proteção conta apenas os pontos de obra que caem dentro de cada " +
        "polígono (teste ponto-em-poligono local). É uma leitura geográfica indicativa para priorização " +
        "interna e NÃO substitui pareceres ambientais, laudos de impacto ou licenças oficiais — a análise " +
        "definitiva é do órgão licenciador competente.",
      "perigo"
    )
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaMapa = el("div", { className: "painel" });
  const areaIndisponiveis = el("div", { className: "painel" });
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaKpis, areaMapa, areaIndisponiveis, areaGraficos, areaTabela);

  /* --------------------------------------------------- carga das areas */

  const areas = await areasAmbiente();

  /* -------------------------------------------------------------- calculo */

  function recorteObras() {
    const filtros = store.obter("filtros");
    return dados.obras.filter((o) => {
      if (filtros.municipio && String(o.municipio_codigo) !== String(filtros.municipio)) return false;
      return true;
    });
  }

  /**
   * Cruzamento ponto-em-poligono: para cada area, conta as obras cujo ponto de
   * cadastro cai dentro do poligono e encontra a obra mais proxima.
   */
  function cruzar() {
    const obras = recorteObras();
    const { areas: resultado } = cruzarObrasComAreas(obras, areas);
    return resultado;
  }

  /* -------------------------------------------------------------- render */

  function render() {
    const linhas = cruzar();
    const comInterferencia = linhas.filter((l) => l.obrasDentro > 0).sort((a, b) => b.obrasDentro - a.obrasDentro);
    const areaTotal = linhas.reduce((acc, l) => acc + l.areaKm2, 0);
    const obras = recorteObras();

    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Áreas de proteção mapeadas",
        valor: numero(linhas.length),
        detalhe: `${numero(new Set(linhas.map((l) => l.categoria)).size)} categorias · ${numero(
          new Set(linhas.map((l) => l.jurisdicao)).size
        )} níveis de jurisdição`,
        icone: "🌿",
        tom: "positivo",
        rodape: "Geometria oficial pública (REAL)",
      }),
      cartaoIndicador({
        titulo: "Área total mapeada",
        valor: `${numero(areaTotal)} km²`,
        detalhe: "Soma das áreas poligonais carregadas",
        icone: "🗺️",
        rodape: "Cálculo por excesso esférico sobre a geometria oficial",
      }),
      cartaoIndicador({
        titulo: "Áreas com obra dentro",
        valor: numero(comInterferencia.length),
        detalhe: `De ${numero(linhas.length)} áreas mapeadas`,
        icone: "⚠️",
        tom: comInterferencia.length ? "alerta" : "padrao",
        rodape: "Leitura exploratória (SIMULADA) sobre geometria REAL",
      }),
      cartaoIndicador({
        titulo: "Obras dentro de áreas",
        valor: numero(comInterferencia.reduce((acc, l) => acc + l.obrasDentro, 0)),
        detalhe: `De ${numero(obras.length)} obras no recorte`,
        icone: "🏗️",
        tom: "critico",
        rodape: "Contagem por ponto-em-polígono (SIMULADO)",
      }),
      cartaoIndicador({
        titulo: "Maior concentração",
        valor: comInterferencia.length
          ? `${comInterferencia[0].obrasDentro}`
          : "0",
        detalhe: comInterferencia.length ? `Obras dentro de ${comInterferencia[0].nome}` : "Nenhuma área com obra",
        icone: "📍",
      }),
      cartaoIndicador({
        titulo: "Bases ambientais oficiais",
        valor: `${FONTES_INDISPONIVEIS.length}`,
        detalhe: FONTES_INDISPONIVEIS.map((f) => f.nome).join(", "),
        icone: "⛔",
        tom: "critico",
        rodape: "Marcadas como INDISPONÍVEL até integração autorizada",
      })
    );

    renderIndisponiveis();
    renderGraficos(linhas);
    renderTabela(linhas, comInterferencia);
  }

  function renderIndisponiveis() {
    limpar(areaIndisponiveis);
    areaIndisponiveis.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Bases ambientais ainda indisponíveis" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Estas camadas não são carregadas nesta versão porque dependem de acesso oficial. A plataforma " +
              "prefere declarar a lacuna a exibi-la como se fosse real.",
          }),
        ]),
        etiquetaStatus("INDISPONIVEL", "Aguardando acesso oficial"),
      ])
    );
    const lista = el("div", { className: "grade grade--3" });
    FONTES_INDISPONIVEIS.forEach((fonte) => {
      lista.append(
        el("article", { className: "cartao cartao--alerta" }, [
          el("header", { className: "cartao__cabecalho" }, [
            el("h3", { className: "cartao__titulo", text: fonte.nome }),
            etiquetaStatus("INDISPONIVEL"),
          ]),
          el("p", { className: "cartao__detalhe", text: fonte.descricao }),
        ])
      );
    });
    areaIndisponiveis.append(lista);
  }

  function renderGraficos(linhas) {
    destruirGraficos();
    const areaCategoria = el("div", { className: "grafico" });
    const areaJurisdicao = el("div", { className: "grafico" });
    limpar(areaGraficos);
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Áreas por categoria" }),
          etiquetaStatus("REAL"),
        ]),
        areaCategoria,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Áreas por jurisdição" }),
          etiquetaStatus("REAL"),
        ]),
        areaJurisdicao,
      ])
    );

    const porCategoria = new Map();
    linhas.forEach((l) => porCategoria.set(l.categoria, (porCategoria.get(l.categoria) || 0) + 1));
    graficoBarras(areaCategoria, {
      rotulos: [...porCategoria.keys()],
      valores: [...porCategoria.values()],
      rotuloY: "Áreas",
      cor: "#2e7daf",
    });

    const porJurisdicao = new Map();
    linhas.forEach((l) => porJurisdicao.set(l.jurisdicao, (porJurisdicao.get(l.jurisdicao) || 0) + 1));
    graficoRosca(areaJurisdicao, {
      rotulos: [...porJurisdicao.keys()],
      valores: [...porJurisdicao.values()],
      cores: ["#0b6e4f", "#0b2545", "#c9a227", "#b23a48"],
    });
  }

  function renderTabela(linhas, comInterferencia) {
    limpar(areaTabela);
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Áreas de proteção e interferência potencial" }),
          el("p", {
            className: "painel__descricao",
            text:
              "A coluna «Obras dentro» conta os pontos de obra contidos no polígono. A «obra mais próxima» é " +
              "a de menor distância ao centroide da área. Tabela ordenada pela interferência potencial.",
          }),
        ]),
        etiquetaStatus("REAL", "Geometria oficial"),
      ])
    );
    const corpo = el("div");
    areaTabela.append(corpo);
    const ordenadas = [...linhas].sort((a, b) => b.obrasDentro - a.obrasDentro || b.areaKm2 - a.areaKm2);
    criarTabela(corpo, {
      colunas: [
        { chave: "nome", rotulo: "Área de proteção" },
        { chave: "categoria", rotulo: "Categoria" },
        { chave: "jurisdicao", rotulo: "Jurisdição" },
        { chave: "ano", rotulo: "Criação" },
        { chave: "areaKm2", rotulo: "Área (km²)", alinhamento: "direita" },
        { chave: "obrasDentro", rotulo: "Obras dentro", alinhamento: "direita" },
        { chave: "obraProxima", rotulo: "Obra mais próxima" },
        { chave: "obraProximaMunicipio", rotulo: "Município" },
        { chave: "distanciaProxima", rotulo: "Distância (km)", alinhamento: "direita" },
      ],
      linhas: ordenadas,
      nomeExportacao: "areas-protecao-interferencia",
      porPagina: 20,
    });

    if (!comInterferencia.length) {
      areaTabela.append(
        el("p", {
          className: "painel__descricao",
          text: "Nenhuma obra do recorte atual cai dentro de uma área de proteção mapeada.",
        })
      );
    }
  }

  /* ----------------------------------------------------------------- mapa */

  areaMapa.append(
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: "Mapa das áreas de proteção" }),
        el("p", {
          className: "painel__descricao",
          text: "Ative a camada «Áreas de proteção e uso restrito» no painel do mapa.",
        }),
      ]),
      etiquetaStatus("REAL"),
    ])
  );
  const areaMapaInterna = el("div");
  areaMapa.append(areaMapaInterna);

  /* --------------------------------------------------------------- render */

  criarBarraFiltros(areaFiltros, { mostrar: ["municipio", "categoria", "periodo"] });
  criarChipsFiltros(areaChips, () => {
    store.definir({ filtros: { ...store.obter("filtros") } });
  });

  render();

  const mapa = criarInterfaceMapa(areaMapaInterna, { titulo: "Áreas de proteção e obras" });
  ajustarAlturaMapa(areaMapaInterna);
  mapa.iniciar().catch((erro) => console.warn("[meioambiente] mapa não inicializado:", erro));

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
