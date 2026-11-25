/**
 * APP 06 — Logistica multimodal.
 *
 * Mapa da malha rodoviaria oficial (SNV + vias estaduais, dados REAIS),
 * infraestrutura hidrovia-aerea-ferroviaria (sem base oficial: marcada como
 * INDISPONIVEL), corredores de escoamento, acessibilidade e calculo de rota
 * ESTIMADA por distancia de estrada.
 *
 * Regra do modulo: todo numero exibido e calculado a partir da malha real
 * carregada em /data e dos registros das bases simuladas, sempre rotulados.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { store } from "../services/state.js";
import { cartaoIndicador } from "../components/cards.js";
import { graficoBarrasHorizontais, graficoBarras, destruirGraficos } from "../components/charts.js";
import { criarTabela } from "../components/tables.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { ajustarAlturaMapa } from "./_mapa.js";
import { etiquetaStatus, blocoAviso, toast } from "../components/ui.js";
import { moedaCompacta, numero, percentual } from "../utils/format.js";
import { criarBarraFiltros, criarChipsFiltros } from "../components/filters.js";
import {
  construirRedeRodoviaria,
  centroidePoligono,
  distanciaHaversine,
  malhaPorMunicipio,
  normalizarSerie,
} from "./_geoespacial.js";

/** Velocidade media de referencia para a estimativa de tempo de percurso. */
const VELOCIDADE_KMH = 60;

/** Modalidades sem base geoespacial oficial disponivel nesta versao. */
const MODALIDADES_INDISPONIVEIS = [
  {
    id: "portuaria",
    nome: "Portuária",
    motivo: "Exige o cadastro oficial de terminais portuários (SODIM/ANTAQ) e o georreferenciamento da hidrovia do Rio Madeira.",
  },
  {
    id: "aeroportuaria",
    nome: "Aeroportuária",
    motivo: "Exige a base oficial de aeródromos (DAESP/ANAC) com posições e movementações.",
  },
  {
    id: "ferroviaria",
    nome: "Ferroviária",
    motivo: "Exige o cadastro da malha ferroviária concededida (RFFSA/Eldorado Mineração) e o traçado autorizado.",
  },
  {
    id: "hidrografica",
    nome: "Hidrográfica",
    motivo: "Exige a base hidrográfica oficial (ANA/SEM) com o eixo navegável do Rio Madeira e seus obstáculos.",
  },
];

let cacheLogistica = null;

/**
 * Prepara (uma unica vez) a base de calculo logistico a partir da malha real.
 */
function prepararBase() {
  if (cacheLogistica) return cacheLogistica;

  const trechosSNV = (dados.rodovias || []).map((f) => ({
    id: f.properties?.codigo_snv || f.id,
    codigo: f.properties?.codigo_rodovia || "SNV",
    pontos: f.geometry?.coordinates || [],
    kmOficial: f.properties?.extensao_km || 0,
    tipo: "federal",
  }));
  const trechosEstaduais = (dados.viasEstaduais || []).flatMap((f) => {
    const geometria = f.geometry || {};
    const partes = geometria.type === "MultiLineString" ? geometria.coordinates : [geometria.coordinates];
    return partes
      .filter((p) => Array.isArray(p) && p.length > 1)
      .map((p, i) => ({
        id: `${f.properties?.codigo_rodovia || "RO"}-${i}`,
        codigo: f.properties?.codigo_rodovia || "RO",
        pontos: p,
        kmOficial: 0,
        tipo: "estadual",
      }));
  });

  const rede = construirRedeRodoviaria([...trechosSNV, ...trechosEstaduais], { tolerancia: 0.006 });
  const ligacoes = rede.conectarComponentes(2);

  const municipios = (dados.municipios || []).map((m) => ({
    codigo: m.codigo_ibge,
    codigo_ibge: m.codigo_ibge,
    nome: m.nome,
    geometria: m.geometria,
    centroide: centroidePoligono(m.geometria) || m.centroide,
    populacao: dados.indicadoresMunicipais?.[m.codigo_ibge]?.populacao || 0,
    pib: dados.indicadoresMunicipais?.[m.codigo_ibge]?.pib_milhoes || 0,
  }));

  const malha = malhaPorMunicipio([...trechosSNV, ...trechosEstaduais], municipios, 2);

  const kmOficialSNV = trechosSNV.reduce((acc, t) => acc + (t.kmOficial || 0), 0);
  const kmGeodesico = rede.totalKm;

  cacheLogistica = {
    rede,
    ligacoes,
    municipios,
    malha,
    trechosSNV,
    trechosEstaduais,
    kmOficialSNV,
    kmGeodesico,
  };
  return cacheLogistica;
}

/** Corredores de escoamento: eixos principais do SNV (sigla_tipo B). */
function corredores(rodovias) {
  const mapa = new Map();
  (rodovias || []).forEach((f) => {
    const p = f.properties || {};
    if (p.sigla_tipo !== "B") return;
    const atual = mapa.get(p.codigo_rodovia) || { codigo: p.codigo_rodovia, km: 0, trechos: 0, municipios: new Set() };
    atual.km += p.extensao_km || 0;
    atual.trechos += 1;
    mapa.set(p.codigo_rodovia, atual);
  });
  return [...mapa.values()].sort((a, b) => b.km - a.km);
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Logística multimodal" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Malha rodoviaria oficial do Estado (Sistema Nacional de Viaria e malha estadual/municipal), " +
            "corredores de escoamento, acessibilidade dos 52 municipios e estimativa de percurso. " +
            "As modalidades portuaria, aeroportuaria, ferroviaria e a hidroafia sao declaradas INDISPONIVEIS " +
            "porque dependem de bases oficiais nao publicadas nesta versao.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        etiquetaStatus("REAL", "Malha SNV + vias estaduais"),
        etiquetaStatus("SIMULADO", "Obras e ativos"),
      ]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "Roteamento oficial exige serviço licenciado",
      "O cálculo de percurso apresentado aqui é uma ESTIMATIVA POR DISTÂNCIA DE ESTRADA, calculada por caminho " +
        "mínimo sobre a malha real (SNV + vias estaduais) simplificada e com ligações aproximadas entre trechos " +
        "desconectados. O roteamento com impedimentos, sentidos, restrições de carga e horários exige um serviço " +
        "ArcGIS Network Analyst configurado e licenciado no ArcGIS Enterprise do Estado.",
      "alerta"
    )
  );

  const areaFiltros = el("div", { className: "barra-filtros" });
  const areaChips = el("div", { className: "chips" });
  pagina.append(areaFiltros, areaChips);

  const areaCorpo = el("div");
  pagina.append(areaCorpo);
  areaCorpo.append(el("div", { className: "painel" }, [el("p", { className: "carregando-bloco", text: "Preparando a malha logística real…" })]));

  await new Promise((resolve) => setTimeout(resolve, 0));

  const base = prepararBase();
  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaMapa = el("div", { className: "painel" });
  const areaCorredores = el("div", { className: "painel" });
  const areaRota = el("div", { className: "painel" });
  const areaAcessibilidade = el("div", { className: "painel" });
  const areaRanking = el("div", { className: "painel" });
  const areaGraficos = el("div", { className: "grade grade--2" });

  limpar(areaCorpo);
  areaCorpo.append(
    areaKpis,
    areaMapa,
    areaCorredores,
    areaRota,
    areaAcessibilidade,
    areaRanking,
    areaGraficos
  );

  /* ------------------------------------------------------------------ KPIs */

  function renderKpis() {
    const filtros = store.obter("filtros");
    const recorte = filtros.municipio ? base.municipios.filter((m) => String(m.codigo) === String(filtros.municipio)) : base.municipios;
    const obras = dados.obras.filter((o) => !filtros.municipio || String(o.municipio_codigo) === String(filtros.municipio));
    const barragens = dados.ativos.filter(
      (a) => a.tipo === "barragem" && (!filtros.municipio || String(a.municipio_codigo) === String(filtros.municipio))
    );
    const kmNoRecorte = recorte.reduce((acc, m) => acc + (base.malha.get(m.codigo) || 0), 0);

    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Malha rodoviaria oficial",
        valor: `${numero(base.kmOficialSNV, 0)} km`,
        detalhe: `${numero(base.trechosSNV.length)} trechos SNV + ${numero(base.trechosEstaduais.length)} segmentos estaduais`,
        icone: "🛣️",
        tom: "positivo",
        rodape: "Fonte: DNIT/SNV e serviço publico ArcGIS — dado REAL",
      }),
      cartaoIndicador({
        titulo: "Malha no recorte",
        valor: `${numero(kmNoRecorte, 0)} km`,
        detalhe: `${recorte.length} município(s) na malha analisada`,
        icone: "📏",
        rodape: "Amostragem da geometria real a cada 2 km (estimativa)",
      }),
      cartaoIndicador({
        titulo: "Corredores de escoamento",
        valor: numero(corredores(dados.rodovias).length),
        detalhe: "Eixos principais SNV com maior extensão",
        icone: "🚚",
        rodape: "Dado REAL — volume de carga depende de fonte oficial (INDISPONÍVEL)",
      }),
      cartaoIndicador({
        titulo: "Estruturas com interface hidroviária",
        valor: numero(barragens.length),
        detalhe: `${barragens.filter((b) => b.criticidade === "critica" || b.criticidade === "alta").length} de criticidade alta/crítica`,
        icone: "🌊",
        tom: "alerta",
        rodape: "Base de ativos demonstrativa (SIMULADO) — hidrografia INDISPONÍVEL",
      }),
      cartaoIndicador({
        titulo: "Obras ao longo da malha",
        valor: numero(obras.length),
        detalhe: `${moedaCompacta(obras.reduce((a, o) => a + (o.valor_atualizado || 0), 0))} em carteira`,
        icone: "🏗️",
        rodape: "Base demonstrativa (SIMULADO)",
      }),
      cartaoIndicador({
        titulo: "Modalidades sem base oficial",
        valor: `${MODALIDADES_INDISPONIVEIS.length}`,
        detalhe: MODALIDADES_INDISPONIVEIS.map((m) => m.nome).join(", "),
        icone: "⚠️",
        tom: "critico",
        rodape: "Marcadas como INDISPONÍVEL até integração oficial",
      })
    );
  }

  /* ------------------------------------------------------------- corredores */

  function dadosCorredores() {
    const filtros = store.obter("filtros");
    const lista = corredores(dados.rodovias);
    const obrasPorCodigo = new Map();
    dados.obras.forEach((o) => {
      if (!o.rodovia) return;
      const atual = obrasPorCodigo.get(o.rodovia) || { quantidade: 0, valor: 0 };
      atual.quantidade += 1;
      atual.valor += o.valor_atualizado || 0;
      obrasPorCodigo.set(o.rodovia, atual);
    });
    const ativosPorCodigo = new Map();
    dados.ativos.forEach((a) => {
      if (!a.rodovia) return;
      const atual = ativosPorCodigo.get(a.rodovia) || { quantidade: 0, criticos: 0 };
      atual.quantidade += 1;
      if (a.criticidade === "alta" || a.criticidade === "critica") atual.criticos += 1;
      ativosPorCodigo.set(a.rodovia, atual);
    });

    return lista.map((corredor) => {
      const obras = obrasPorCodigo.get(corredor.codigo) || { quantidade: 0, valor: 0 };
      const ativos = ativosPorCodigo.get(corredor.codigo) || { quantidade: 0, criticos: 0 };
      const municipioDoCorredor = base.municipios.filter((m) => {
        const no = base.rede.noMaisProximo(m.centroide);
        if (!no) return false;
        const arestas = base.rede.nos.get(no.no.id).arestas;
        return arestas.some((a) => a.codigo === corredor.codigo);
      });
      return {
        codigo: corredor.codigo,
        km: Math.round(corredor.km),
        trechos: corredor.trechos,
        municipios: municipioDoCorredor.length,
        obras: obras.quantidade,
        investimento: obras.valor,
        ativos: ativos.quantidade,
        ativosCriticos: ativos.criticos,
        indice: corredor.km,
      };
    }).filter((c) => !filtros.rodovia || c.codigo === filtros.rodovia);
  }

  function renderCorredores() {
    const linhas = dadosCorredores();
    limpar(areaCorredores);
    areaCorredores.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Corredores de escoamento agrícola" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Ranking dos eixos principais do SNV pela extensão real da malha. O volume de carga transportada " +
              "não está disponível (exige dados oficiais de escoamento) — o indicador usa extensão viária, " +
              "municípios atendidos e carteira de obras (SIMULADA).",
          }),
        ]),
        etiquetaStatus("REAL", "Extensão SNV"),
      ])
    );
    const corpo = el("div");
    areaCorredores.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "codigo", rotulo: "Corredor" },
        { chave: "km", rotulo: "Extensão (km)", alinhamento: "direita" },
        { chave: "trechos", rotulo: "Trechos SNV", alinhamento: "direita" },
        { chave: "municipios", rotulo: "Municípios atendidos", alinhamento: "direita" },
        { chave: "obras", rotulo: "Obras no corredor", alinhamento: "direita" },
        { chave: "investimento", rotulo: "Investimento", alinhamento: "direita" },
        { chave: "ativosCriticos", rotulo: "Ativos críticos", alinhamento: "direita" },
      ],
      linhas,
      nomeExportacao: "corredores-de-escoamento",
      porPagina: 15,
    });
  }

  /* ------------------------------------------------------------- calculadora */

  function renderRota() {
    limpar(areaRota);
    areaRota.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Estimativa de percurso pela malha real" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Origem e destino referem-se ao centroide areal do município (não à sede urbana). " +
              "O resultado é uma estimativa por distância de estrada sobre a malha oficial, não um roteamento " +
              "com impedimentos ou restrições de carga.",
          }),
        ]),
        etiquetaStatus("REAL", "Malha SNV"),
      ])
    );

    const seletorOrigem = el("select", { className: "campo", id: "rota-origem" });
    const seletorDestino = el("select", { className: "campo", id: "rota-destino" });
    const ordenados = [...base.municipios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    ordenados.forEach((m, i) => {
      seletorOrigem.append(el("option", { value: m.codigo, text: m.nome, selected: i === 0 }));
      seletorDestino.append(el("option", { value: m.codigo, text: m.nome, selected: i === 1 }));
    });

    const resultado = el("div", { className: "lista-dados", style: { "--colunas": "2" } });

    function calcular() {
      const origem = base.municipios.find((m) => String(m.codigo) === String(seletorOrigem.value));
      const destino = base.municipios.find((m) => String(m.codigo) === String(seletorDestino.value));
      limpar(resultado);
      if (!origem || !destino) return;
      const noOrigem = base.rede.noMaisProximo(origem.centroide);
      const noDestino = base.rede.noMaisProximo(destino.centroide);
      if (!noOrigem || !noDestino) {
        resultado.append(el("p", { text: "Sem conexão com a malha viária para um dos pontos." }));
        return;
      }
      const caminho = base.rede.caminhoMaisCurto(noOrigem.no.id, noDestino.no.id);
      if (!caminho) {
        resultado.append(
          el("p", {
            text:
              "Não há caminho contínuo entre esses pontos na malha oficial. " +
              "Isto ocorre porque o SNV é digitalizado por trecho e alguns segmentos permanecem isolados.",
          })
        );
        return;
      }
      const codigos = [...new Set(caminho.arestas.map((a) => a.codigo))];
      const aproximadas = caminho.arestas.filter((a) => a.aproximada).length;
      const reta = distanciaHaversine(origem.centroide, destino.centroide);
      const horas = caminho.distanciaKm / VELOCIDADE_KMH;
      const pares = [
        { rotulo: "Origem", valor: `${origem.nome} (centroide areal)` },
        { rotulo: "Destino", valor: `${destino.nome} (centroide areal)` },
        { rotulo: "Distância de estrada estimada", valor: `${numero(caminho.distanciaKm, 1)} km` },
        { rotulo: "Distância em linha reta", valor: `${numero(reta, 1)} km` },
        { rotulo: "Fator de desvio", valor: percentual((caminho.distanciaKm / Math.max(reta, 0.1)) * 100) },
        { rotulo: "Tempo estimado a 60 km/h", valor: `${numero(horas, 1)} h` },
        { rotulo: "Rodovias e vias utilizadas", valor: codigos.join(", ") },
        { rotulo: "Acesso à malha (origem/destino)", valor: `${numero(noOrigem.distanciaKm, 1)} km / ${numero(noDestino.distanciaKm, 1)} km` },
        {
          rotulo: "Ligações aproximadas na base",
          valor: aproximadas
            ? `${aproximadas} ligação(ões) entre trechos não conectados no SNV`
            : "Nenhuma — percurso totalmente conectado",
        },
      ];
      pares.forEach((par) => {
        resultado.append(el("dt", { text: par.rotulo }));
        resultado.append(el("dd", { text: par.valor }));
      });
      toast("Estimativa calculada sobre a malha real.", "sucesso");
    }

    const botao = el("button", {
      className: "botao botao--primario",
      type: "button",
      text: "Calcular percurso estimado",
      onclick: calcular,
    });

    areaRota.append(
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "rota-origem", text: "Origem" }),
        seletorOrigem,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "rota-destino", text: "Destino" }),
        seletorDestino,
      ]),
      botao,
      resultado
    );
    calcular();
  }

  /* ----------------------------------------------------- acessibilidade */

  function linhasAcessibilidade() {
    const filtros = store.obter("filtros");
    const obrasPorMunicipio = new Map();
    dados.obras.forEach((o) => {
      const atual = obrasPorMunicipio.get(o.municipio_codigo) || { quantidade: 0, valor: 0 };
      atual.quantidade += 1;
      atual.valor += o.valor_atualizado || 0;
      obrasPorMunicipio.set(o.municipio_codigo, atual);
    });

    const baseLinhas = base.municipios
      .filter((m) => !filtros.municipio || String(m.codigo) === String(filtros.municipio))
      .map((m) => {
        const no = base.rede.noMaisProximo(m.centroide);
        const obras = obrasPorMunicipio.get(m.codigo) || { quantidade: 0, valor: 0 };
        return {
          municipio: m.nome,
          codigo: m.codigo,
          malha: Number((base.malha.get(m.codigo) || 0).toFixed(1)),
          acesso: no ? Number(no.distanciaKm.toFixed(1)) : null,
          rodovia: no ? base.rede.nos.get(no.no.id).arestas[0]?.codigo || "—" : "—",
          populacao: m.populacao,
          obras: obras.quantidade,
          investimento: Math.round(obras.valor),
        };
      });

    const normMalha = normalizarSerie(baseLinhas.map((l) => l.malha));
    const normPop = normalizarSerie(baseLinhas.map((l) => l.populacao));
    const normInv = normalizarSerie(baseLinhas.map((l) => l.investimento));
    const normAcesso = normalizarSerie(baseLinhas.map((l) => (l.acesso === null ? 0 : -l.acesso)));

    return baseLinhas
      .map((l) => ({
        ...l,
        indice: Number(
          (
            0.3 * normMalha(l.malha) +
            0.25 * normPop(l.populacao) +
            0.25 * normInv(l.investimento) +
            0.2 * normAcesso(l.acesso === null ? 0 : -l.acesso)
          ).toFixed(3)
        ),
      }))
      .sort((a, b) => b.indice - a.indice);
  }

  function renderAcessibilidade() {
    const linhas = linhasAcessibilidade();
    limpar(areaAcessibilidade);
    areaAcessibilidade.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Acessibilidade e ranking de corredores por município" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Índice de corredor logístico = 0,30×malha viária no município (km, REAL) + 0,25×população " +
              "(IBGE, REAL) + 0,25×investimento em obras (SIMULADO) + 0,20×(−acesso do centroide à malha). " +
              "O acesso é medido do centroide areal do município até o ponto mais próximo da malha real.",
          }),
        ]),
        etiquetaStatus("REAL", "Malha + IBGE"),
      ])
    );
    const corpo = el("div");
    areaAcessibilidade.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "municipio", rotulo: "Município" },
        { chave: "malha", rotulo: "Malha no município (km)", alinhamento: "direita" },
        { chave: "acesso", rotulo: "Acesso à malha (km)", alinhamento: "direita" },
        { chave: "rodovia", rotulo: "Via mais próxima" },
        { chave: "populacao", rotulo: "População", alinhamento: "direita" },
        { chave: "obras", rotulo: "Obras", alinhamento: "direita" },
        { chave: "investimento", rotulo: "Investimento", alinhamento: "direita" },
        { chave: "indice", rotulo: "Índice de corredor", alinhamento: "direita" },
      ],
      linhas,
      nomeExportacao: "corredores-logisticos-por-municipio",
      porPagina: 20,
    });
  }

  /* -------------------------------------------------------------- graficos */

  function renderGraficos() {
    destruirGraficos();
    const areaKm = el("div", { className: "grafico grafico--alto" });
    const areaObras = el("div", { className: "grafico grafico--alto" });
    limpar(areaGraficos);
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Extensão dos corredores (km, SNV)" }),
          etiquetaStatus("REAL"),
        ]),
        areaKm,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Obras por corredor (SIMULADO)" }),
          etiquetaStatus("SIMULADO"),
        ]),
        areaObras,
      ])
    );

    const linhas = dadosCorredores();
    graficoBarrasHorizontais(areaKm, {
      rotulos: linhas.map((l) => l.codigo),
      valores: linhas.map((l) => l.km),
      formatador: (v) => `${numero(v)} km`,
      cor: "#0b2545",
    });
    graficoBarras(areaObras, {
      rotulos: linhas.map((l) => l.codigo),
      valores: linhas.map((l) => l.obras),
      rotuloY: "Obras",
      cor: "#1f8a70",
    });
  }

  /* ------------------------------------------------------------------ mapa */

  areaMapa.append(
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: "Mapa da infraestrutura logística" }),
        el("p", {
          className: "painel__descricao",
          text:
            "Use o painel de camadas para alternar o SNV (REAL), a malha estadual (REAL), as obras e os ativos " +
            "(SIMULADOS).",
        }),
      ]),
      etiquetaStatus("REAL", "SNV"),
    ])
  );
  const areaMapaInterna = el("div");
  areaMapa.append(areaMapaInterna);

  /* ---------------------------------------------------------------- render */

  criarBarraFiltros(areaFiltros, {
    mostrar: ["municipio", "rodovia", "periodo"],
  });
  criarChipsFiltros(areaChips, () => {
    store.definir({ filtros: { ...store.obter("filtros") } });
  });

  renderKpis();
  renderCorredores();
  renderRota();
  renderAcessibilidade();
  renderGraficos();

  const mapa = criarInterfaceMapa(areaMapaInterna, {
    titulo: "Infraestrutura logística de Rondônia",
  });
  ajustarAlturaMapa(areaMapaInterna);
  mapa.iniciar().catch((erro) => console.warn("[logistica] mapa não inicializado:", erro));

  const cancelar = store.inscrever("filtros", () => {
    renderKpis();
    renderCorredores();
    renderAcessibilidade();
    renderGraficos();
  });

  container.append(pagina);

  return {
    destruir() {
      cancelar();
      destruirGraficos();
      mapa.destruir?.();
    },
  };
}
