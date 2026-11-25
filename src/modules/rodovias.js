/**
 * APP 02 — Sistema Rodoviário Estadual.
 * Trechos com codigo oficial, quilometragem (referencia linear), jurisdicao,
 * superficie, extensao e vinculo com as obras do trecho.
 */
import { el } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { store, definirFiltros } from "../services/state.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { criarTabela } from "../components/tables.js";
import { cartaoIndicador, listaDados } from "../components/cards.js";
import { graficoBarrasHorizontais, graficoRosca, destruirGraficos } from "../components/charts.js";
import { abrirDrawer, toast, etiquetaStatus, blocoAviso } from "../components/ui.js";
import { moedaCompacta, numero, percentual, data } from "../utils/format.js";

const CONDICAO_PAVIMENTO = {
  PAV: { nome: "Pavimentado", cor: "#1f8a70" },
  PAR: { nome: "Parcialmente pavimentado", cor: "#c9a227" },
  PLA: { nome: "Não pavimentado (terra)", cor: "#d97a1f" },
  "": { nome: "Não informado", cor: "#9aa7b2" },
};

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Sistema rodoviário estadual" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Rodovias federais, estaduais e municipais com código oficial, referência linear por quilometragem, " +
            "jurisdição, superfície do pavimento, extensão e obras vinculadas. A malha oficial de trechos vem do " +
            "Sistema Nacional de Viário (SNV) e a malha estadual de vias RO-xxx de serviço público.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        etiquetaStatus("REAL", "Malha SNV oficial"),
        etiquetaStatus("SIMULADO", "Obras vinculadas"),
      ]),
    ])
  );

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaMapa = el("div", { className: "painel" });
  const areaGraficos = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  pagina.append(areaKpis, areaMapa, areaGraficos, areaTabela);

  const mapa = criarInterfaceMapa(areaMapa, {
    titulo: "Malha rodoviária de Rondônia",
    aoSelecionarFeicao: (feicao) => {
      const props = feicao.atributos || {};
      const id = props.codigo_snv || props.codigo_rodovia;
      if (id) abrirTrecho(id);
    },
  });

  /** Normaliza os trechos SNV + vias estaduais em uma lista unica. */
  function trechos() {
    const snv = (dados.rodovias || []).map((f) => ({ ...f.properties, fonte: "SNV (DNIT)", geometria: f.geometry }));
    const estaduais = (dados.viasEstaduais || []).map((f) => ({
      codigo_rodovia: f.properties?.codigo_rodovia,
      nome: f.properties?.nome,
      jurisdicao: "Estadual",
      status: "REAL",
      fonte: "Malha viária estadual (serviço público)",
      geometria: f.geometry,
    }));
    return [...snv, ...estaduais];
  }

  function atualizar() {
    const lista = trechos();
    const obrasPorRodovia = new Map();
    dados.obras.forEach((obra) => {
      if (!obra.rodovia) return;
      const atual = obrasPorRodovia.get(obra.rodovia) || { quantidade: 0, valor: 0, obras: [] };
      atual.quantidade += 1;
      atual.valor += obra.valor_atualizado || 0;
      atual.obras.push(obra);
      obrasPorRodovia.set(obra.rodovia, atual);
    });

    const extensaoTotal = lista.reduce((acc, t) => acc + (t.extensao_km || 0), 0);
    const codigos = new Set(lista.map((t) => t.codigo_rodovia).filter(Boolean));
    const porJurisdicao = lista.reduce((acc, t) => {
      const j = t.jurisdicao || "Federal";
      acc[j] = (acc[j] || 0) + (t.extensao_km || 0);
      return acc;
    }, {});

    areaKpis.innerHTML = "";
    areaKpis.append(
      cartaoIndicador({ titulo: "Trechos catalogados", valor: numero(lista.length), detalhe: `${codigos.size} rodovia(s)`, icone: "🛣️" }),
      cartaoIndicador({ titulo: "Extensão oficial (SNV)", valor: `${numero(extensaoTotal, 0)} km`, detalhe: "Soma dos trechos com extensão cadastrada", icone: "📏", tom: "positivo" }),
      cartaoIndicador({ titulo: "Rodovias federais", valor: numero([...codigos].filter((c) => c.startsWith("BR")).length), detalhe: "SNV com jurisdição federal", icone: "🇧🇷" }),
      cartaoIndicador({ titulo: "Rodovias estaduais", valor: numero([...codigos].filter((c) => c.startsWith("RO")).length), detalhe: "Identificação RO-xxx", icone: "🏛️" }),
      cartaoIndicador({ titulo: "Obras em trechos", valor: numero(dados.obras.filter((o) => o.rodovia).length), detalhe: "Obras vinculadas a uma rodovia", icone: "🏗️", tom: "alerta" })
    );

    destruirGraficos();
    const graficoExtensao = el("div", { className: "grafico" });
    const graficoJurisdicao = el("div", { className: "grafico" });
    areaGraficos.innerHTML = "";
    areaGraficos.append(
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Extensão por rodovia (km cadastrados no SNV)" }),
          etiquetaStatus("REAL"),
        ]),
        graficoExtensao,
      ]),
      el("section", { className: "painel" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: "Extensão por jurisdição" }),
          etiquetaStatus("REAL"),
        ]),
        graficoJurisdicao,
      ])
    );

    const porCodigo = new Map();
    lista.forEach((t) => {
      const codigo = t.codigo_rodovia || "Não informado";
      porCodigo.set(codigo, (porCodigo.get(codigo) || 0) + (t.extensao_km || 0));
    });
    const topRodovias = [...porCodigo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    graficoBarrasHorizontais(graficoExtensao, {
      rotulos: topRodovias.map(([codigo]) => codigo),
      valores: topRodovias.map(([, valor]) => valor),
      formatador: (v) => `${numero(v, 0)} km`,
      cor: "#0b2545",
    });

    graficoRosca(graficoJurisdicao, {
      rotulos: Object.keys(porJurisdicao),
      valores: Object.values(porJurisdicao),
      cores: ["#0b6e4f", "#12355b", "#2e7daf", "#c9a227"],
    });

    areaTabela.innerHTML = "";
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("h3", { className: "painel__titulo", text: "Trechos rodoviários" }),
        etiquetaStatus("REAL", "SNV oficial"),
      ])
    );
    const corpo = el("div");
    areaTabela.append(corpo);

    criarTabela(corpo, {
      colunas: [
        { chave: "codigo_rodovia", rotulo: "Rodovia", largura: "110px" },
        { chave: "jurisdicao", rotulo: "Jurisdição" },
        { chave: "superficie", rotulo: "Pavimento", formatar: (v) => CONDICAO_PAVIMENTO[v]?.nome || "Não informado" },
        { chave: "extensao_km", rotulo: "Extensão", alinhamento: "direita", formatar: (v) => (v ? `${numero(v, 1)} km` : "—") },
        { chave: "km_inicial", rotulo: "Km inicial", alinhamento: "direita", formatar: (v) => (v ?? "—") },
        { chave: "km_final", rotulo: "Km final", alinhamento: "direita", formatar: (v) => (v ?? "—") },
        { chave: "local_inicial", rotulo: "Origem do trecho" },
        { chave: "obras", rotulo: "Obras", alinhamento: "direita", formatar: (v) => (v ? v.quantidade : 0) },
      ],
      linhas: lista.map((t) => ({ ...t, obras: obrasPorRodovia.get(t.codigo_rodovia) })),
      aoClicarLinha: (linha) => abrirTrecho(linha.codigo_snv || linha.codigo_rodovia),
      nomeExportacao: "trechos-rodoviarios-ro",
      porPagina: 20,
    });
  }

  function abrirTrecho(id) {
    const lista = trechos();
    const trechosDoTrecho = lista.filter((t) => t.codigo_snv === id || t.codigo_rodovia === id);
    if (!trechosDoTrecho.length) {
      toast("Trecho não encontrado.", "erro");
      return;
    }
    const primeiro = trechosDoTrecho[0];
    const obras = dados.obras.filter((o) => o.rodovia === primeiro.codigo_rodovia);
    const drawer = abrirDrawer({
      titulo: primeiro.codigo_rodovia || "Trecho rodoviário",
      subtitulo: primeiro.local_inicial ? `${primeiro.local_inicial} → ${primeiro.local_final}` : "Trecho da malha viária",
      conteudo: el("div", { className: "ficha" }),
      largura: "520px",
    });
    const corpo = drawer.corpo;
    corpo.append(el("div", { className: "ficha__topo" }, [etiquetaStatus("REAL", "Dados SNV oficiais")]));

    corpo.append(
      el("section", { className: "ficha__secao" }, [
        el("h3", { text: "Cadastro do trecho" }),
        listaDados([
          { rotulo: "Código SNV", valor: primeiro.codigo_snv || "— (malha estadual)" },
          { rotulo: "Código da rodovia", valor: primeiro.codigo_rodovia },
          { rotulo: "Tipo", valor: primeiro.nome_tipo || "—"},
          { rotulo: "Jurisdição", valor: primeiro.jurisdicao || "—"},
          { rotulo: "Unidade local", valor: primeiro.unidade_local || "—"},
          { rotulo: "Superfície", valor: CONDICAO_PAVIMENTO[primeiro.superficie]?.nome || "Não informado" },
          { rotulo: "Extensão", valor: primeiro.extensao_km ? `${numero(primeiro.extensao_km, 1)} km` : "—" },
          { rotulo: "Km inicial", valor: primeiro.km_inicial ?? "—" },
          { rotulo: "Km final", valor: primeiro.km_final ?? "—" },
          { rotulo: "Versão do SNV", valor: primeiro.versao_snv || "—" },
        ]),
      ])
    );

    if (primeiro.local_inicial) {
      corpo.append(
        el("section", { className: "ficha__secao" }, [
          el("h3", { text: "Referência linear" }),
          listaDados([
            { rotulo: "Ponto inicial", valor: primeiro.local_inicial },
            { rotulo: "Ponto final", valor: primeiro.local_final },
          ]),
        ])
      );
    }

    const secaoObras = el("section", { className: "ficha__secao" }, [el("h3", { text: `Obras no trecho (${obras.length})` })]);
    if (!obras.length) {
      secaoObras.append(el("p", { className: "ficha__vazio", text: "Nenhuma obra (simulada) vinculada a este trecho." }));
    } else {
      const lista = el("ul", { className: "lista-simples" });
      obras.forEach((obra) => {
        lista.append(
          el("li", {}, [
            el("strong", { text: obra.id }),
            el("span", { text: ` — ${obra.titulo} · ${percentual(obra.percentual_execucao_fisica)} executado · ${moedaCompacta(obra.valor_atualizado)}` }),
          ])
        );
      });
      secaoObras.append(lista);
    }
    corpo.append(secaoObras);

    corpo.append(
      el("div", { className: "ficha__acoes" }, [
        el("button", {
          className: "botao botao--secundario",
          type: "button",
          text: "Centralizar no mapa",
          onclick: () => {
            const geometria = primeiro.geometria;
            if (!geometria) return;
            const coords = geometria.type === "LineString" ? geometria.coordinates : geometria.coordinates[0];
            const centro = coords[Math.floor(coords.length / 2)];
            mapa.irPara([centro[0], centro[1]], { zoom: 11 });
          },
        }),
        el("a", { className: "botao botao--secundario", href: "#/obras", text: "Ver obras" }),
      ])
    );
  }

  atualizar();
  mapa.iniciar().catch((erro) => console.warn("[rodovias] mapa não inicializado:", erro));

  container.append(pagina);

  return {
    destruir() {
      mapa.destruir?.();
      destruirGraficos();
    },
  };
}
