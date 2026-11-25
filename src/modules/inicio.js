/**
 * Pagina inicial institucional — APP 00 (porta de entrada).
 */
import { el } from "../utils/dom.js";
import { dados, calcularIndicadores, recortar, porMunicipio } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoAplicativo, cartaoDestaque } from "../components/cards.js";
import { etiquetaStatus } from "../components/ui.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { moedaCompacta, numero, percentual, data } from "../utils/format.js";
import { config } from "../config.js";

const APLICATIVOS = [
  { id: "painel", titulo: "Painel Executivo", descricao: "Obras, investimentos, contratos e execução financeira em uma visão consolidada.", icone: "📊", tags: ["APP 01"] },
  { id: "rodovias", titulo: "Sistema Rodoviário", descricao: "Rodovias federais, estaduais e municipais com quilometragem, condição e jurisdiction.", icone: "🛣️", tags: ["APP 02"] },
  { id: "obras", titulo: "Obras 360", descricao: "Mapa de obras com ficha detalhada, medições, contratos e histórico.", icone: "🏗️", tags: ["APP 03"] },
  { id: "contratos", titulo: "Gestão de Contratos", descricao: "Vigência, aditivos, empenho, liquidação, pagamento e saldos.", icone: "📄", tags: ["APP 04"] },
  { id: "ativos", titulo: "Pontes e Ativos", descricao: "Inventário georreferenciado com condição estrutural, criticidade e inspeções.", icone: "🌉", tags: ["APP 05"] },
  { id: "logistica", titulo: "Logística Multimodal", descricao: "Corredores de escoamento, integração com o Rio Madeira e ativos portuários.", icone: "🚚", tags: ["APP 06"] },
  { id: "municipios", titulo: "Perfil dos Municípios", descricao: "Ficha dos 52 municípios com população, PIB, obras e rankings.", icone: "🏛️", tags: ["APP 07"] },
  { id: "convenios", titulo: "Convênios", descricao: "Transferências estaduais e federais com desembolsos, vigência e alertas.", icone: "🤝", tags: ["APP 08"] },
  { id: "maquinas", titulo: "Máquinas", descricao: "Frota de manutenção rodoviária com disponibilidade e histórico.", icone: "🚜", tags: ["APP 09"] },
  { id: "fiscalizacao", titulo: "Fiscalização", descricao: "Vistorias em campo com GPS, evidências e sincronização offline.", icone: "📋", tags: ["APP 10"] },
  { id: "meioambiente", titulo: "Meio Ambiente", descricao: "Áreas de proteção, hidrografia e análise exploratória de interferência.", icone: "🌿", tags: ["APP 11"] },
  { id: "planejamento", titulo: "Planejamento", descricao: "Matriz multicritério, priorização territorial e cenários de investimento.", icone: "🧭", tags: ["APP 12"] },
  { id: "geoai", titulo: "GeoAI", descricao: "Riscos demonstrativos de atraso, deterioração, anomalias e gargalos.", icone: "🤖", tags: ["APP 13"] },
  { id: "assistente", titulo: "InfraAI RO", descricao: "Assistente geoespacial que responde com registros verificáveis.", icone: "💬", tags: ["APP 14"] },
  { id: "mapa", titulo: "Geoportal", descricao: "Catálogo completo de camadas com consultas espaciais.", icone: "🗺️", tags: ["APP 15"] },
  { id: "dados-abertos", titulo: "Dados Abertos", descricao: "Catálogo de datasets com licença, metodologia e downloads.", icone: "📦", tags: ["APP 16"] },
];

const NOTICIAS = [
  {
    titulo: "Painel executivo incorpora série histórica de investimento",
    descricao: "Evolução mensal de 2019 a 2026 disponível para download e comparação por município.",
    data: "2026-11-18",
    categoria: "Plataforma",
  },
  {
    titulo: "Malha municipal oficial de Rondônia georreferenciada",
    descricao: "Os 52 limites municipais foram atualizados a partir da base do IBGE e validados por área.",
    data: "2026-11-12",
    categoria: "Dados",
  },
  {
    titulo: "Busca global agora cobre obras, contratos e rodovias",
    descricao: "Pesquisa unificada no cabeçalho com resultados verificáveis e link direto para a ficha.",
    data: "2026-11-05",
    categoria: "Funcionalidade",
  },
];

export async function montar(container) {
  const recorte = recortar(store.obter("filtros"));
  const indicadores = calcularIndicadores(recorte, store.obter("filtros"));

  const pagina = el("section", { className: "pagina" });

  /* ------------------------------------------------------------- banner */
  const banner = el("section", { className: "banner" }, [
    el("div", { className: "banner__conteudo" }, [
      el("h1", { className: "banner__titulo", text: config.app.nome }),
      el("p", {
        className: "banner__texto",
        text:
          "Plataforma de inteligência geográfica de infraestrutura e logística do Estado de Rondônia. " +
          "Integra malha rodoviaria oficial, limites municipais do IBGE, contratos, obras e indicadores " +
          "em um geoportal navegável.",
      }),
      el("div", { className: "banner__acoes" }, [
        el("a", { className: "botao botao--primario", href: "#/mapa" }, ["Abrir o geoportal"]),
        el("a", { className: "botao botao--claro", href: "#/painel" }, ["Ver indicadores"]),
        el("a", { className: "botao botao--claro", href: "#/dados-abertos" }, ["Dados abertos"]),
      ]),
    ]),
    el("span", { className: "banner__creditos", text: "Imagem: Esri, Maxar, Earthstar Geographics" }),
  ]);
  pagina.append(banner);

  /* --------------------------------------------------- faixa de indicadores */
  const faixa = el("section", { className: "faixa-indicadores", "aria-label": "Indicadores estratégicos" }, [
    el("div", { className: "faixa-indicadores__item" }, [
      el("span", { className: "faixa-indicadores__rotulo", text: "Municípios atendidos" }),
      el("strong", { className: "faixa-indicadores__valor", text: `${indicadores.municipiosAtendidos}/${indicadores.totalMunicipios}` }),
      el("span", { className: "faixa-indicadores__detalhe", text: "Municípios com obra em carteira" }),
    ]),
    el("div", { className: "faixa-indicadores__item" }, [
      el("span", { className: "faixa-indicadores__rotulo", text: "Investimento em carteira" }),
      el("strong", { className: "faixa-indicadores__valor", text: moedaCompacta(indicadores.valorObras) }),
      el("span", { className: "faixa-indicadores__detalhe", text: "Obras e contratos (dados simulados)" }),
    ]),
    el("div", { className: "faixa-indicadores__item" }, [
      el("span", { className: "faixa-indicadores__rotulo", text: "Execução física média" }),
      el("strong", { className: "faixa-indicadores__valor", text: percentual(indicadores.execucaoMedia) }),
      el("span", { className: "faixa-indicadores__detalhe", text: "Média das obras do recorte" }),
    ]),
    el("div", { className: "faixa-indicadores__item" }, [
      el("span", { className: "faixa-indicadores__rotulo", text: "Contratos em risco" }),
      el("strong", { className: "faixa-indicadores__valor", text: numero(indicadores.contratosAtrasados) }),
      el("span", { className: "faixa-indicadores__detalhe", text: "Atrasados ou paralisados" }),
    ]),
    el("div", { className: "faixa-indicadores__item" }, [
      el("span", { className: "faixa-indicadores__rotulo", text: "População na área de influência" }),
      el("strong", { className: "faixa-indicadores__valor", text: numero(indicadores.populacaoAtendida) }),
      el("span", { className: "faixa-indicadores__detalhe", text: "Municípios com obras (Censo 2022)" }),
    ]),
  ]);
  pagina.append(faixa);

  /* ----------------------------------------------------- mapa interativo */
  const secaoMapa = el("section", { className: "secao" }, [
    el("header", { className: "secao__cabecalho" }, [
      el("h2", { className: "secao__titulo", text: "Rondônia em escala territorial" }),
      el("a", { className: "secao__link", href: "#/mapa", text: "Abrir geoportal →" }),
    ]),
  ]);
  const areaMapaHome = el("div", { className: "painel" });
  secaoMapa.append(areaMapaHome);
  pagina.append(secaoMapa);

  /* ------------------------------------------------------- cards de apps */
  const secaoApps = el("section", { className: "secao" }, [
    el("header", { className: "secao__cabecalho" }, [
      el("h2", { className: "secao__titulo", text: "Aplicativos da plataforma" }),
      el("span", { className: "secao__link", text: `${APLICATIVOS.length} aplicativos` }),
    ]),
    el("div", { className: "grade grade--3" }, APLICATIVOS.map((app) => cartaoAplicativo(app))),
  ]);
  pagina.append(secaoApps);

  /* --------------------------------------- destaques de obras/investimentos */
  const topMunicipios = porMunicipio(recorte.obras).slice(0, 6);
  const obrasDestaque = [...recorte.obras]
    .sort((a, b) => (b.valor_atualizado || 0) - (a.valor_atualizado || 0))
    .slice(0, 4);
  const secaoDestaques = el("section", { className: "secao" }, [
    el("header", { className: "secao__cabecalho" }, [
      el("h2", { className: "secao__titulo", text: "Destaques de obras e investimentos" }),
      el("a", { className: "secao__link", href: "#/obras", text: "Ver todas as obras →" }),
    ]),
    el("div", { className: "grade grade--2" }, [
      el("div", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Maiores obras em carteira" }),
          etiquetaStatus("SIMULADO"),
        ]),
        el(
          "ul",
          { className: "lista-dados", style: { "--colunas": "1" } },
          obrasDestaque.flatMap((obra) => [
            el("dt", { text: `${obra.titulo} — ${obra.municipio}` }),
            el("dd", { text: `${moedaCompacta(obra.valor_atualizado)} · ${percentual(obra.percentual_execucao_fisica)} executado` }),
          ])
        ),
      ]),
      el("div", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Municípios com maior investimento" }),
          etiquetaStatus("SIMULADO"),
        ]),
        el(
          "ul",
          { className: "lista-dados", style: { "--colunas": "1" } },
          topMunicipios.flatMap((item) => [
            el("dt", { text: `${item.municipio} (${item.quantidade} obras)` }),
            el("dd", { text: moedaCompacta(item.valor) }),
          ])
        ),
      ]),
    ]),
  ]);
  pagina.append(secaoDestaques);

  /* ------------------------------------------------------------- notícias */
  const secaoNoticias = el("section", { className: "secao" }, [
    el("header", { className: "secao__cabecalho" }, [
      el("h2", { className: "secao__titulo", text: "Notícias e atualizações" }),
      el("span", { className: "secao__link", text: "Demonstração" }),
    ]),
    el("div", { className: "grade grade--3" }, NOTICIAS.map((noticia) => cartaoDestaque({ ...noticia, data: data(noticia.data) }))),
  ]);
  pagina.append(secaoNoticias);

  container.append(pagina);

  /* ----------------------------------------------------------- mapa home */
  const mapaHome = criarInterfaceMapa(areaMapaHome, {
    titulo: "Visão territorial de Rondônia",
  });
  mapaHome.iniciar().catch((erro) => console.warn("[home] mapa não inicializado:", erro));

  return {
    destruir() {
      mapaHome.destruir?.();
    },
  };
}
