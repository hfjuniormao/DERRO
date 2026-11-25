/**
 * APP 09 — Maquinas e equipamentos.
 *
 * Cadastro e monitoramento da frota: tipo, identificacao patrimonial, unidade
 * responsavel, municipio, disponibilidade, situacao e manutencao.
 *
 * A MOVIMENTACAO NO MAPA e SIMULADA: os pontos deslizam de forma deterministica
 * a cada ciclo de 4 segundos para demonstrar o monitoramento. Nao ha telemetria
 * GPS real nesta versao — a estrutura esta preparada (campos e payload
 * documentados) para a integracao futura.
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
import { etiquetaStatus, etiquetaSituacao, blocoAviso, toast } from "../components/ui.js";
import { numero, percentual, data } from "../utils/format.js";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Point from "@arcgis/core/geometry/Point";

/** Intervalo do ciclo de simulacao (ms). */
const INTERVALO_SIMULACAO = 4000;

/**
 * Deslocamento deterministico: raio e angulo inicial derivados do indice da
 * maquina (angulo de ouro) e passo derived do ciclo. Nao ha aleatoriedade —
 * a mesma maquina percorre sempre o mesmo circulo.
 */
function posicaoSimulada(maquina, indice, ciclo) {
  const base = maquina.localizacao || { lon: 0, lat: 0 };
  const anguloInicial = ((indice * 137.508) % 360) * (Math.PI / 180);
  const raioGraus = 0.004 + (indice % 7) * 0.0006; // ~0,4 a 0,8 km
  const passo = (ciclo * Math.PI) / 6; // um ciclo completo a cada 6 pulsos
  return {
    lon: base.lon + raioGraus * Math.cos(anguloInicial + passo),
    lat: base.lat + raioGraus * Math.sin(anguloInicial + passo),
  };
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Máquinas e equipamentos" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Frota de manutenção rodoviária com tipo, identificação patrimonial, unidade responsável, município, " +
            "disponibilidade, situação e histórico de manutenção. A movimentação dos pontos no mapa é " +
            "SIMULADA e está identificada como tal em todos os painéis.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Frota demonstrativa")]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "MOVIMENTAÇÃO SIMULADA",
      "Os pontos das máquinas no mapa são deslocados por uma rotina determinística a cada 4 segundos apenas para " +
        "demonstrar o monitoramento. Não há telemetria GPS real nem rastreamento de frota nesta versão — a " +
        "posição exibida é um deslocamento sintético em torno da coordenada de cadastro.",
      "alerta"
    )
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaMapa = el("div", { className: "painel" });
  const areaMonitor = el("div", { className: "painel" });
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaHistorico = el("div", { className: "painel" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaKpis, areaMapa, areaMonitor, areaGraficos, areaHistorico, areaTabela);

  /* ------------------------------------------------------- filtro local */

  const filtroTipo = el("select", { className: "campo", id: "filtro-maquina-tipo" });
  filtroTipo.append(el("option", { value: "", text: "Todos os tipos" }));
  [...new Set(dados.maquinas.map((m) => m.tipo_nome).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((t) => filtroTipo.append(el("option", { value: t, text: t })));

  const filtroUnidade = el("select", { className: "campo", id: "filtro-maquina-unidade" });
  filtroUnidade.append(el("option", { value: "", text: "Todas as unidades" }));
  [...new Set(dados.maquinas.map((m) => m.unidade_responsavel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((u) => filtroUnidade.append(el("option", { value: u, text: u })));

  const filtroSituacao = el("select", { className: "campo", id: "filtro-maquina-situacao" });
  filtroSituacao.append(el("option", { value: "", text: "Todas as situações" }));
  [
    { id: "operacional", nome: "Operacional" },
    { id: "manutencao", nome: "Em manutenção" },
    { id: "inoperante", nome: "Inoperante" },
    { id: "afastada", nome: "Afastada" },
  ].forEach((s) => filtroSituacao.append(el("option", { value: s.id, text: s.nome })));

  const local = { tipo: "", unidade: "", situacao: "" };
  [filtroTipo, filtroUnidade, filtroSituacao].forEach((campo) => {
    campo.addEventListener("change", () => {
      local.tipo = filtroTipo.value;
      local.unidade = filtroUnidade.value;
      local.situacao = filtroSituacao.value;
      render();
    });
  });

  areaFiltros.append(
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "filtro-maquina-tipo", text: "Tipo de equipamento" }),
      filtroTipo,
    ]),
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "filtro-maquina-unidade", text: "Unidade responsável" }),
      filtroUnidade,
    ]),
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "filtro-maquina-situacao", text: "Situação" }),
      filtroSituacao,
    ])
  );

  /* --------------------------------------------------------------- estado */

  const estado = {
    ciclo: 0,
    simulando: false,
    timer: null,
    posicoes: new Map(),
    graficosMapa: new Map(),
    tabela: null,
    camada: null,
    relogio: null,
    listaPosicoes: null,
  };

  function recorte() {
    const filtros = store.obter("filtros");
    return dados.maquinas.filter((m) => {
      if (filtros.municipio && String(m.municipio_codigo) !== String(filtros.municipio)) return false;
      if (local.tipo && m.tipo_nome !== local.tipo) return false;
      if (local.unidade && m.unidade_responsavel !== local.unidade) return false;
      if (local.situacao && m.situacao !== local.situacao) return false;
      return true;
    });
  }

  function posicaoAtual(maquina, indice) {
    if (!estado.simulando) {
      const base = maquina.localizacao || { lon: 0, lat: 0 };
      return { lon: base.lon, lat: base.lat };
    }
    return posicaoSimulada(maquina, indice, estado.ciclo);
  }

  /* --------------------------------------------------------------- render */

  function render() {
    const lista = recorte();
    const porSituacao = new Map();
    lista.forEach((m) => porSituacao.set(m.situacao, (porSituacao.get(m.situacao) || 0) + 1));
    const disponibilidadeMedia = lista.length
      ? lista.reduce((acc, m) => acc + (m.disponibilidade || 0), 0) / lista.length
      : 0;
    const horas = lista.reduce((acc, m) => acc + (m.horas_operacao || 0), 0);

    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Equipamentos no recorte",
        valor: numero(lista.length),
        detalhe: `${numero(new Set(lista.map((m) => m.unidade_responsavel)).size)} unidades responsáveis`,
        icone: "🚜",
        rodape: "Base demonstrativa (SIMULADO)",
      }),
      cartaoIndicador({
        titulo: "Operacionais",
        valor: numero(porSituacao.get("operacional") || 0),
        detalhe: `${percentual(lista.length ? ((porSituacao.get("operacional") || 0) / lista.length) * 100 : 0)} da frota`,
        icone: "✅",
        tom: "positivo",
      }),
      cartaoIndicador({
        titulo: "Em manutenção",
        valor: numero(porSituacao.get("manutencao") || 0),
        detalhe: `${numero(porSituacao.get("inoperante") || 0)} inoperantes · ${numero(porSituacao.get("afastada") || 0)} afastadas`,
        icone: "🔧",
        tom: "alerta",
      }),
      cartaoIndicador({
        titulo: "Disponibilidade média",
        valor: percentual(disponibilidadeMedia * 100),
        detalhe: "Média da disponibilidade registrada na base",
        icone: "📈",
        tom: disponibilidadeMedia < 0.7 ? "alerta" : "padrao",
      }),
      cartaoIndicador({
        titulo: "Horas de operação",
        valor: numero(horas),
        detalhe: "Soma das horas registradas no cadastro",
        icone: "⏱️",
      }),
      cartaoIndicador({
        titulo: "Manutenções recentes",
        valor: numero(lista.filter((m) => m.ultima_manutencao).length),
        detalhe: `Última manutenção: ${data(lista.map((m) => m.ultima_manutencao).filter(Boolean).sort().reverse()[0])}`,
        icone: "📅",
      })
    );

    renderGraficos(lista);
    renderHistorico(lista);
    renderTabela(lista);
    renderMonitor(lista);
  }

  function renderGraficos(lista) {
    destruirGraficos();
    const areaTipo = el("div", { className: "grafico" });
    const areaSituacao = el("div", { className: "grafico" });
    limpar(areaGraficos);
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Frota por tipo de equipamento" }),
          etiquetaStatus("SIMULADO"),
        ]),
        areaTipo,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Situação da frota" }),
          etiquetaStatus("SIMULADO"),
        ]),
        areaSituacao,
      ])
    );

    const porTipo = new Map();
    lista.forEach((m) => porTipo.set(m.tipo_nome, (porTipo.get(m.tipo_nome) || 0) + 1));
    graficoBarras(areaTipo, {
      rotulos: [...porTipo.keys()],
      valores: [...porTipo.values()],
      rotuloY: "Equipamentos",
      cor: "#0b6e4f",
    });

    const cores = { operacional: "#1f8a70", manutencao: "#c9a227", inoperante: "#b23a48", afastada: "#9aa7b2" };
    const situacoes = ["operacional", "manutencao", "inoperante", "afastada"];
    graficoRosca(areaSituacao, {
      rotulos: ["Operacional", "Em manutenção", "Inoperante", "Afastada"],
      valores: situacoes.map((s) => lista.filter((m) => m.situacao === s).length),
      cores: situacoes.map((s) => cores[s]),
    });
  }

  function renderHistorico(lista) {
    limpar(areaHistorico);
    areaHistorico.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Histórico de manutenção" }),
          el("p", {
            className: "painel__descricao",
            text:
              "A base de demonstração registra a última manutenção e o acumulado de horas por equipamento. " +
              "O histórico evento a evento (abertura de chamado, peça trocada, custo) depende do sistema " +
              "corporativo do DER-RO — INDISPONÍVEL nesta versão.",
          }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const corpo = el("div");
    areaHistorico.append(corpo);
    const ordenadas = [...lista]
      .filter((m) => m.ultima_manutencao)
      .sort((a, b) => (a.ultima_manutencao < b.ultima_manutencao ? 1 : -1))
      .slice(0, 60);
    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Patrimônio" },
        { chave: "tipo_nome", rotulo: "Equipamento" },
        { chave: "unidade_responsavel", rotulo: "Unidade" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "ultima_manutencao", rotulo: "Última manutenção" },
        { chave: "horas_operacao", rotulo: "Horas", alinhamento: "direita" },
        { chave: "disponibilidade", rotulo: "Disponibilidade", alinhamento: "direita" },
        {
          chave: "situacao",
          rotulo: "Situação",
          renderizar: (linha) => etiquetaSituacao(linha.situacao),
        },
      ],
      linhas: ordenadas,
      nomeExportacao: "maquinas-historico-manutencao",
      porPagina: 15,
    });
  }

  function renderTabela(lista) {
    const corpo = el("div");
    const montarTabela = () => {
      estado.tabela = criarTabela(corpo, {
        colunas: [
          { chave: "id", rotulo: "Identificador" },
          { chave: "tipo_nome", rotulo: "Tipo" },
          { chave: "patrimonial", rotulo: "Patrimonial" },
          { chave: "unidade_responsavel", rotulo: "Unidade responsável" },
          { chave: "municipio", rotulo: "Município" },
          {
            chave: "disponibilidade",
            rotulo: "Disponibilidade",
            alinhamento: "direita",
            renderizar: (linha) => percentual((linha.disponibilidade || 0) * 100),
          },
          {
            chave: "situacao",
            rotulo: "Situação",
            renderizar: (linha) => etiquetaSituacao(linha.situacao),
          },
          { chave: "horas_operacao", rotulo: "Horas", alinhamento: "direita" },
          { chave: "ultima_manutencao", rotulo: "Última manutenção" },
          { chave: "lat", rotulo: "Latitude (cadastro)", alinhamento: "direita" },
          { chave: "lon", rotulo: "Longitude (cadastro)", alinhamento: "direita" },
        ],
        linhas: linhasTabela(lista),
        nomeExportacao: "maquinas",
        porPagina: 20,
      });
    };

    limpar(areaTabela);
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Cadastro de equipamentos" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Busque, ordene, pagine e exporte o cadastro (CSV). As colunas de latitude e longitude trazem a " +
              "posição de cadastro de cada equipamento; durante a simulação, a posição sintética corrente é " +
              "exibida no painel de monitoramento e nos pontos do mapa.",
          }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    areaTabela.append(corpo);
    montarTabela();
  }

  /** Linhas da tabela com a posicao atual (cadastro ou simulada). */
  function linhasTabela(lista) {
    return lista.map((m, i) => {
      const posicao = posicaoAtual(m, i);
      return {
        id: m.id,
        tipo_nome: m.tipo_nome,
        patrimonial: m.patrimonial,
        unidade_responsavel: m.unidade_responsavel,
        municipio: m.municipio,
        disponibilidade: m.disponibilidade,
        situacao: m.situacao,
        horas_operacao: m.horas_operacao,
        ultima_manutencao: m.ultima_manutencao,
        lat: Number(posicao.lat.toFixed(6)),
        lon: Number(posicao.lon.toFixed(6)),
      };
    });
  }

  /* ------------------------------------------------------------ monitor */

  function renderMonitor(lista) {
    limpar(areaMonitor);
    areaMonitor.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Monitoramento da frota" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Acompanhe a posição reportada de cada equipamento. Durante a simulação as coordenadas mudam a " +
              "cada ciclo — o deslocamento é sintético e identificado como MOVIMENTAÇÃO SIMULADA.",
          }),
        ]),
        etiquetaStatus("SIMULADO", "MOVIMENTAÇÃO SIMULADA"),
      ])
    );

    const botao = el("button", {
      className: "botao botao--primario",
      type: "button",
      text: estado.simulando ? "Parar simulação" : "Iniciar simulação",
      "aria-pressed": estado.simulando ? "true" : "false",
      onclick: () => {
        alternarSimulacao();
        render();
      },
    });

    const relogio = el("p", {
      className: "painel__descricao",
      text: "",
    });

    const listaPosicoes = el("ul", { className: "lista-resumo" });
    estado.relogio = relogio;
    estado.listaPosicoes = listaPosicoes;

    areaMonitor.append(botao, relogio, listaPosicoes);
    areaMonitor.append(
      blocoAviso(
        "Estrutura preparada para telemetria GPS",
        "O modelo já carrega os campos de latitude e longitude por equipamento. A integração futura de telemetria " +
          "usará o payload { id, data_hora, latitude, longitude, velocidade, rumo, id_unidade, id_obra, bateria, sinal } " +
          "postado pelo rastreador ao ArcGIS Enterprise (FeatureServer de rastreamento) — ainda não implementado.",
        "sucesso"
      )
    );
    atualizarMonitor();
  }

  /** Atualiza relogio e posicoes do painel de monitoramento (sem recriar a tela). */
  function atualizarMonitor() {
    if (!estado.relogio) return;
    estado.relogio.textContent = estado.simulando
      ? `Simulação ativa — ciclo ${estado.ciclo} · atualização ${new Date().toLocaleTimeString("pt-BR")}`
      : "Simulação parada — as coordenadas exibidas são as de cadastro.";
    if (!estado.listaPosicoes) return;
    const lista = recorte();
    limpar(estado.listaPosicoes);
    lista.slice(0, 10).forEach((m, i) => {
      const posicao = posicaoAtual(m, i);
      estado.listaPosicoes.append(
        el("li", {}, [
          el("span", { text: `${m.patrimonial} — ${m.tipo_nome} (${m.municipio})` }),
          el("strong", { text: `${posicao.lat.toFixed(4)}, ${posicao.lon.toFixed(4)}` }),
        ])
      );
    });
  }

  /* ------------------------------------------------------------ simulação */

  function alternarSimulacao() {
    if (estado.simulando) {
      clearInterval(estado.timer);
      estado.timer = null;
      estado.simulando = false;
      toast("Simulação de movimentação encerrada.", "info");
      atualizarMonitor();
      return;
    }
    estado.simulando = true;
    estado.ciclo = 0;
    toast("MOVIMENTAÇÃO SIMULADA iniciada — os pontos deslizam a cada 4 segundos.", "info", 5000);
    estado.timer = setInterval(() => {
      estado.ciclo += 1;
      atualizarPosicoesMapa();
      atualizarMonitor();
    }, INTERVALO_SIMULACAO);
    atualizarPosicoesMapa();
    atualizarMonitor();
  }

  /** Move os pontos do mapa conforme a posicao simulada do ciclo. */
  function atualizarPosicoesMapa() {
    const lista = recorte();
    lista.forEach((m, i) => {
      const posicao = posicaoSimulada(m, i, estado.ciclo);
      estado.posicoes.set(m.id, posicao);
      const grafico = estado.graficosMapa.get(m.id);
      if (grafico) {
        grafico.geometry = new Point({ longitude: posicao.lon, latitude: posicao.lat });
      }
    });
  }

  /* ----------------------------------------------------------------- mapa */

  areaMapa.append(
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: "Mapa da frota" }),
        el("p", {
          className: "painel__descricao",
          text:
            "Pontos da frota sobre a malha do Estado. A camada «Frota (MOVIMENTAÇÃO SIMULADA)» acompanha o " +
            "deslocamento sintético dos equipamentos.",
        }),
      ]),
      etiquetaStatus("SIMULADO", "MOVIMENTAÇÃO SIMULADA"),
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

  const mapa = criarInterfaceMapa(areaMapaInterna, { titulo: "Frota de máquinas e equipamentos" });
  ajustarAlturaMapa(areaMapaInterna);
  mapa
    .iniciar()
    .then(() => {
      const controlador = mapa.obterControlador();
      const mapaArc = controlador?.obterMapa?.();
      if (!mapaArc) return;
      const camada = new GraphicsLayer({
        id: "frota-simulada",
        title: "Frota (MOVIMENTAÇÃO SIMULADA)",
        listMode: "hide",
      });
      recorte().forEach((m, i) => {
        const posicao = posicaoSimulada(m, i, 0);
        const grafico = new Graphic({
          geometry: new Point({ longitude: posicao.lon, latitude: posicao.lat }),
          attributes: { id: m.id, type: m.tipo_nome },
          symbol: {
            type: "simple-marker",
            style: "circle",
            color: m.situacao === "inoperante" ? "#b23a48" : m.situacao === "manutencao" ? "#c9a227" : "#0b6e4f",
            size: 8,
            outline: { color: "#ffffff", width: 1 },
          },
        });
        estado.graficosMapa.set(m.id, grafico);
        camada.add(grafico);
      });
      mapaArc.add(camada);
      estado.camada = camada;
    })
    .catch((erro) => console.warn("[maquinas] mapa não inicializado:", erro));

  const cancelar = store.inscrever("filtros", render);

  container.append(pagina);

  return {
    destruir() {
      cancelar();
      clearInterval(estado.timer);
      estado.timer = null;
      estado.simulando = false;
      destruirGraficos();
      mapa.destruir?.();
    },
  };
}
