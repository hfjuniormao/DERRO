/**
 * Componente cartografico reutilizavel: painel de camadas, legenda dinamica,
 * ferramentas (medir, imprimir, compartilhar, exportar, GPS), busca e
 * identificacao de feicoes com ficha propria.
 */
import { el, limpar } from "../utils/dom.js";
import { config } from "../config.js";
import { criarMapa } from "../maps/mapview.js";
import { CAMADAS, camadasPorGrupo } from "../maps/layers.js";
import * as geocode from "../maps/geocode.js";
import { dados } from "../services/data.js";
import { etiquetaStatus, toast, abrirModal, estadoVazio } from "./ui.js";
import { paraCsv, baixarTexto, paraGeojson, paginaImpressao, imprimirHtml } from "../utils/export.js";
import { escapar } from "../utils/format.js";

const ICONES = {
  camadas: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3 2 8l10 5 10-5-10-5Zm0 7.2L5.7 8 12 5.3 18.3 8 12 10.2Zm0 4.4L4 11l1.9-.9L12 13.7l6.1-3.6L20 11l-8 3.6Z"/></svg>',
  lupa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/></svg>',
  medida: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2 12 7 7h3v10H7l-5-5Zm5.5-3.5h1v7h-1v-7ZM11 7h3v10h-3V7Zm4.5 0h1v7h-1v-7ZM17 7h3l5 5-5 5h-3V7Z"/></svg>',
  impressora: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 3h12v4H6V3Zm0 6h12a3 3 0 0 1 3 3v6h-4v3H7v-3H3v-6a3 3 0 0 1 3-3Zm2 9v3h8v-3H8Zm9-6.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>',
  compartilhar: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.4 1.2l-7-3.9a3 3 0 0 0 0-1.7l7-3.9A3 3 0 1 0 15 6l-7 3.9a3 3 0 1 0 0 4.2l7 3.9A3 3 0 1 0 18 16Z"/></svg>',
  exportar: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3 7.5 7.5 9 9l2-2v8h2V7l2 2 1.5-1.5L12 3ZM5 18v2h14v-2H5Z"/></svg>',
  gps: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21v-2ZM12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z"/></svg>',
  expandir: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"/></svg>',
  cubo: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 2.3L5.5 8 12 11.7 18.5 8 12 4.3ZM5 9.7v6.6l6 3.3v-6.6L5 9.7Zm8 9.9 6-3.3V9.7l-6 3.3v6.6Z"/></svg>',
  base: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3 2 8l10 5 10-5-10-5Zm0 7.2L5.7 8 12 5.3 18.3 8 12 10.2ZM2 12l-1.4-.7V17l10 5 1.4-.7L2 16.6V12Zm20 0v4.6L12 21l-1.4.7L21 17v-5.7L22 12Z"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6v3l4.5-4L12 1v3Z"/></svg>',
  filtro: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></svg>',
};

const ROTULOS_TIPOS = {
  obra: "Obra",
  contrato: "Contrato",
  ativo: "Ativo",
  convenio: "Convênio",
  maquina: "Máquina",
  vistoria: "Vistoria",
  municipio: "Município",
  rodovia: "Rodovia",
};

/**
 * Monta a interface cartografica completa.
 * @param {HTMLElement} container
 * @param {object} opcoes { titulo, mostrar: [...], aoSelecionarFeicao, municipioInicial }
 */
export function criarInterfaceMapa(container, opcoes = {}) {
  const estado = {
    aba: "camadas",
    camadasAtivas: new Set(),
    mostrar: opcoes.mostrar || ["camadas", "legenda", "ferramentas", "busca"],
    controlador: null,
  };

  const estrutura = el("div", { className: "mapa-interface" });
  const painel = el("aside", { className: "mapa-painel", "aria-label": "Painel cartográfico" });
  const areaMapa = el("div", { className: "mapa-area" });
  const barraFerramentas = el("div", { className: "mapa-ferramentas", role: "toolbar", "aria-label": "Ferramentas do mapa" });
  const painelInfo = el("div", { className: "mapa-info", hidden: true, "aria-live": "polite" });

  estrutura.append(painel, el("div", { className: "mapa-principal" }, [barraFerramentas, areaMapa, painelInfo]));
  container.append(estrutura);

  /* ----------------------------------------------------------- painel lateral */

  const abas = [
    { id: "camadas", rotulo: "Camadas", icone: ICONES.camadas },
    { id: "legenda", rotulo: "Legenda", icone: ICONES.lupa },
    { id: "busca", rotulo: "Busca", icone: ICONES.lupa },
    { id: "ferramentas", rotulo: "Ferramentas", icone: ICONES.filtro },
  ];
  const listaAbas = el("ul", { className: "mapa-abas", role: "tablist" });
  const corpoPainel = el("div", { className: "mapa-painel__corpo" });

  abas.forEach((aba) => {
    const botao = el("button", {
      className: "mapa-abas__botao",
      type: "button",
      role: "tab",
      "aria-selected": aba.id === estado.aba ? "true" : "false",
      onclick: () => {
        estado.aba = aba.id;
        listaAbas.querySelectorAll(".mapa-abas__botao").forEach((b) => b.setAttribute("aria-selected", "false"));
        botao.setAttribute("aria-selected", "true");
        renderPainel();
      },
    }, [el("span", { html: aba.icone, "aria-hidden": "true" }), el("span", { text: aba.rotulo })]);
    listaAbas.append(el("li", {}, [botao]));
  });

  painel.append(el("div", { className: "mapa-painel__topo" }, [
    el("h2", { className: "mapa-painel__titulo", text: opcoes.titulo || "Mapa" }),
    listaAbas,
  ]), corpoPainel);

  function renderPainel() {
    limpar(corpoPainel);
    if (estado.aba === "camadas") renderCamadas();
    else if (estado.aba === "legenda") renderLegenda();
    else if (estado.aba === "busca") renderBusca();
    else renderFerramentas();
  }

  /** Busca por municipio, rodovia, endereco ou coordenadas. */
  function renderBusca() {
    const { pesquisar, interpretarCoordenadas } = geocode;
    const campo = el("input", {
      type: "search",
      className: "campo",
      id: "busca-mapa",
      placeholder: "Município, rodovia, endereço ou lat, lon",
      "aria-label": "Pesquisar no mapa",
    });
    const resultados = el("ul", { className: "lista-resultados-busca", role: "listbox" });
    const orientacao = el("p", {
      className: "mapa-painel__nota",
      text:
        "Pesquisa por município e rodovia nas bases oficiais de Rondônia; endereços e topônimos são " +
        "geocodificados pelo serviço oficial da Esri. Coordenadas podem ser informadas em WGS84 (ex.: -11.05, -63.80).",
    });

    const buscar = async () => {
      const termo = campo.value.trim();
      resultados.innerHTML = "";
      if (termo.length < 2) return;
      const encontrados = await pesquisar(termo);
      if (!encontrados.length) {
        resultados.append(el("li", { className: "lista-resultados-busca__vazio", text: "Nenhum resultado encontrado." }));
        return;
      }
      encontrados.forEach((item) => {
        const botao = el(
          "li",
          {
            role: "option",
            tabindex: "0",
            onclick: () => aplicarResultado(item),
            onkeydown: (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                aplicarResultado(item);
              }
            },
          },
          [
            el("strong", { text: item.titulo }),
            el("span", { className: "lista-resultados-busca__detalhe", text: item.detalle }),
            el("span", { className: "lista-resultados-busca__fonte", text: item.fonte }),
          ]
        );
        resultados.append(botao);
      });
    };

    campo.addEventListener("change", buscar);
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        buscar();
      }
    });

    corpoPainel.append(el("div", { className: "mapa-busca" }, [campo, resultados]), orientacao);
  }

  /** Aplica o resultado da busca no mapa. */
  function aplicarResultado(item) {
    const controlador = estado.controlador;
    if (!controlador) return;
    if (item.tipo === "municipio") {
      controlador.destacarMunicipio(item.id);
      return;
    }
    if (item.tipo === "rodovia") {
      const trecho = (dados.rodovias || []).find(
        (r) => (r.properties?.codigo_rodovia || "").toUpperCase() === String(item.id).toUpperCase()
      );
      if (trecho) {
        const coords = trecho.geometry.type === "LineString" ? trecho.geometry.coordinates : trecho.geometry.coordinates[0];
        const centro = coords[Math.floor(coords.length / 2)];
        controlador.irPara([centro[0], centro[1]], { zoom: 10 });
        return;
      }
      controlador.irPara([-63.0, -11.0], { zoom: 8 });
      return;
    }
    if (item.posicao) {
      controlador.irPara([item.posicao[0], item.posicao[1]], { zoom: 13 });
    }
  }

  function renderCamadas() {
    if (!estado.controlador) {
      corpoPainel.append(el("p", { className: "mapa-painel__vazio", text: "Carregando catálogo de camadas…" }));
      return;
    }
    const grupos = camadasPorGrupo();
    grupos.forEach((grupo) => {
      if (!grupo.camadas.length) return;
      const bloco = el("section", { className: "grupo-camadas" });
      bloco.append(el("h3", { className: "grupo-camadas__titulo", text: grupo.nome }));
      const lista = el("ul", { className: "grupo-camadas__lista" });
      grupo.camadas.forEach((camada) => {
        const id = `camada-${camada.id}`;
        const checkbox = el("input", {
          type: "checkbox",
          id,
          checked: estado.camadasAtivas.has(camada.id),
          onchange: (ev) => {
            if (ev.target.checked) {
              estado.camadasAtivas.add(camada.id);
              estado.controlador.definirVisibilidade(camada.id, true);
            } else {
              estado.camadasAtivas.delete(camada.id);
              estado.controlador.definirVisibilidade(camada.id, false);
            }
            renderLegenda();
          },
        });
        const item = el("li", { className: "camada-item" }, [
          el("label", { for: id, className: "camada-item__rotulo" }, [
            checkbox,
            el("span", { className: "camada-item__nome", text: camada.titulo }),
            etiquetaStatus(camada.status),
          ]),
        ]);
        lista.append(item);
      });
      bloco.append(lista);
      corpoPainel.append(bloco);
    });
    corpoPainel.append(
      el("p", { className: "mapa-painel__nota", text: "Camadas com dados oficiais estão marcadas como DADOS REAIS; as bases de demonstração estão marcadas como DADOS SIMULADOS." })
    );
  }

  function renderLegenda() {
    if (!estado.controlador) return;
    const esquema = estado.controlador.resumoEstado().esquema;
    const visiveis = [...estado.camadasAtivas];
    if (!visiveis.length) {
      corpoPainel.append(estadoVazio("Nenhuma camada visível", "Ative camadas no painel para ver a legenda."));
      return;
    }
    visiveis.forEach((id) => {
      const definicao = CAMADAS.find((c) => c.id === id);
      const itens = esquema.get(id) || [];
      const bloco = el("section", { className: "legenda-bloco" }, [
        el("h3", { className: "legenda-bloco__titulo", text: definicao?.titulo || id }),
      ]);
      if (!itens.length) {
        bloco.append(el("p", { className: "legenda-bloco__vazio", text: "Sem legenda detalhada." }));
      }
      itens.forEach((item) => {
        bloco.append(
          el("div", { className: "legenda-item" }, [
            el("span", { className: `legenda-item__simbolo legenda-item__simbolo--${item.tipo || "ponto"}`, style: { background: item.cor } }),
            el("span", { className: "legenda-item__rotulo", text: item.rotulo }),
          ])
        );
      });
      corpoPainel.append(bloco);
    });
  }

  function renderFerramentas() {
    const lista = el("ul", { className: "lista-ferramentas" });
    const item = (rotulo, descricao, icone, aoClicar) =>
      el("li", {}, [
        el("button", { className: "ferramenta", type: "button", onclick: aoClicar }, [
          el("span", { className: "ferramenta__icone", html: icone, "aria-hidden": "true" }),
          el("span", {}, [el("strong", { text: rotulo }), el("small", { text: descricao })]),
        ]),
      ]);
    lista.append(
      item("Identificar", "Clique no mapa para ver os detalhes da feição", ICONES.lupa, () => {
        toast("Modo identificação ativo: clique em uma feição do mapa.", "info", 3200);
      }),
      item("Medir distância", "Trace uma linha para medir em quilômetros", ICONES.medida, () => {
        estado.controlador.iniciarMedicao("distancia");
        toast("Desenhe uma linha no mapa para medir a distância.", "info", 3200);
      }),
      item("Medir área", "Desenhe um polígono para medir a área", ICONES.medida, () => {
        estado.controlador.iniciarMedicao("area");
        toast("Desenhe um polígono no mapa para medir a área.", "info", 3200);
      }),
      item("Galeria de mapas base", "Alterne entre os mapas base oficiais da Esri", ICONES.base, abrirGaleriaBase),
      item("Imprimir mapa", "Gera uma página A4 com a visualização atual", ICONES.impressora, imprimirMapa),
      item("Compartilhar visualização", "Cria um link com a extensão atual", ICONES.compartilhar, compartilharVisualizacao),
      item("Exportar dados", "Exporta a camada visível em GeoJSON ou CSV", ICONES.exportar, exportarCamadaVisivel),
      item("Minha localização", "Centraliza no GPS do dispositivo", ICONES.gps, () => estado.controlador.localizarUsuario()),
      item("Visão estadual", "Retorna à extensão completa de Rondônia", ICONES.voltar, () => estado.controlador.voltarAoEstado()),
      item("Tela cheia", "Alterna a visualização em tela cheia", ICONES.expandir, alternarTelaCheia)
    );
    corpoPainel.append(lista);
    corpoPainel.append(
      el("p", { className: "mapa-painel__nota", text: "A comparação temporal de imagens exige um serviço de imagery histórico (ArcGIS Enterprise) — nesta versão o recorte por período atualiza as camadas por data de início." })
    );
  }

  /* ---------------------------------------------------------- barra de acoes */

  function botaoFerramenta(icone, rotulo, aoClicar) {
    return el("button", {
      className: "mapa-ferramentas__botao",
      type: "button",
      title: rotulo,
      "aria-label": rotulo,
      onclick: aoClicar,
      html: icone,
    });
  }

  barraFerramentas.append(
    botaoFerramenta(ICONES.camadas, "Camadas", () => {
      painel.classList.toggle("mapa-painel--aberto");
    }),
    botaoFerramenta(ICONES.medida, "Medir", () => {
      estado.controlador?.iniciarMedicao("distancia");
    }),
    botaoFerramenta(ICONES.impressora, "Imprimir", imprimirMapa),
    botaoFerramenta(ICONES.compartilhar, "Compartilhar", compartilharVisualizacao),
    botaoFerramenta(ICONES.exportar, "Exportar", exportarCamadaVisivel),
    botaoFerramenta(ICONES.gps, "Minha localizacao", () => estado.controlador?.localizarUsuario()),
    botaoFerramenta(ICONES.cubo, "Alternar 2D / 3D", alternarDimensionalidade),
    botaoFerramenta(ICONES.voltar, "Visao estadual", () => estado.controlador?.voltarAoEstado()),
    botaoFerramenta(ICONES.expandir, "Tela cheia", alternarTelaCheia)
  );

  /* -------------------------------------------------------------- acoes */

  function alternarDimensionalidade() {
    estado.controlador?.alternarDimensionalidade().then((tipo) => {
      toast(`Visualização em ${tipo === "3d" ? "3D" : "2D"} ativada.`, "sucesso");
    });
  }

  function alternarTelaCheia() {
    const alvo = estrutura;
    if (!document.fullscreenElement) alvo.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  async function abrirGaleriaBase() {
    const corpo = el("div", { className: "galeria-base" });
    config.basemaps.forEach((base) => {
      const miniatura = el("img", {
        src: `https://services.arcgisonline.com/ArcGIS/rest/services/${
          base.id === "gray" ? "Canvas/World_Light_Gray_Base" :
          base.id === "dark" ? "Canvas/World_Dark_Gray_Base" :
          base.id === "terrain" ? "World_Terrain_Base" :
          base.id === "satellite" ? "World_Imagery" :
          base.id === "hybrid" ? "World_Imagery" :
          base.id === "topographic" ? "World_Topo_Map" :
          base.id === "osm" ? "OpenStreetMap" : "World_Street_Map"
        }/MapServer/tile/4/6/24`,
        alt: `Pré-visualização do mapa base ${base.nome}`,
        loading: "lazy",
      });
      const botao = el("button", {
        className: "galeria-base__item",
        type: "button",
        onclick: () => {
          estado.controlador.aplicarMapaBase(base.id);
          modal.fechar();
          toast(`Mapa base "${base.nome}" aplicado.`, "sucesso");
        },
      }, [miniatura, el("span", { text: base.nome })]);
      corpo.append(botao);
    });
    const modal = abrirModal({ titulo: "Mapas base oficiais", subtitulo: "Esri — Street, Satellite, Hybrid, Topographic, Light Gray, Dark Gray, Terrain", conteudo: corpo, largura: "760px" });
  }

  function imprimirMapa() {
    const view = estado.controlador?.obterView?.();
    if (!view) return;
    try {
      const canvas = view.canvas;
      const imagem = canvas.toDataURL("image/png");
      const html = paginaImpressao({
        titulo: opcoes.titulo || "Central INFRA RO 360",
        subtitulo: new Date().toLocaleString("pt-BR"),
        corpoHtml: `<header><h1>${escapar(opcoes.titulo || "Central INFRA RO 360")}</h1><div class="sub">Gerado em ${escapar(new Date().toLocaleString("pt-BR"))} — Esri, HERE, Garmin, FAO, NOAA, USGS</div></header><div class="mapa"><img src="${imagem}" alt="Captura do mapa atual"></div>`,
        rodape: "CENTRAL INFRA RO 360 — dados demonstrativos de infraestrutura (SIMULADOS); limites e SNV são dados oficiais.",
      });
      imprimirHtml(html);
    } catch (erro) {
      toast("Não foi possível gerar a impressão do mapa.", "erro");
    }
  }

  async function compartilharVisualizacao() {
    const hash = estado.controlador?.hashVisualizacao?.();
    const url = `${window.location.origin}${window.location.pathname}#/mapa?extent=${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link da visualização copiado para a área de transferência.", "sucesso");
    } catch {
      abrirModal({
        titulo: "Compartilhar visualização",
        conteudo: `<p>Copie o link abaixo:</p><input class="campo" readonly value="${escapar(url)}">`,
        largura: "560px",
      });
    }
  }

  async function exportarCamadaVisivel() {
    const visiveis = [...estado.camadasAtivas];
    if (!visiveis.length) {
      toast("Ative uma camada para exportar.", "erro");
      return;
    }
    const id = visiveis[visiveis.length - 1];
    const resultado = await estado.controlador.exportarCamada(id, "geojson");
    if (!resultado) return;
    const nome = CAMADAS.find((c) => c.id === id)?.titulo || id;
    baixarTexto(`${id}.geojson`, paraGeojson(resultado.conteudo.features), "application/geo+json");
    toast(`Camada "${nome}" exportada em GeoJSON.`, "sucesso");
  }

  function mostrarInformacao(feicao) {
    limpar(painelInfo);
    painelInfo.hidden = false;
    const atributos = feicao.atributos || {};
    const titulo = atributos.titulo || atributos.nome || atributos.codigo_rodovia || feicao.camadaTitulo || "Feição";
    painelInfo.append(
      el("header", { className: "mapa-info__cabecalho" }, [
        el("h3", { text: titulo }),
        el("button", { className: "botao-icone", type: "button", "aria-label": "Fechar detalhes", html: "&times;", onclick: () => { painelInfo.hidden = true; } }),
      ])
    );
    const tabela = el("table", { className: "tabela tabela--compacta" });
    Object.entries(atributos)
      .filter(([chave]) => !["geometria", "geometry"].includes(chave))
      .slice(0, 22)
      .forEach(([chave, valor]) => {
        if (valor === null || valor === undefined || typeof valor === "object") return;
        tabela.append(
          el("tr", {}, [
            el("th", { scope: "row", text: chave.replace(/_/g, " ") }),
            el("td", { text: String(valor) }),
          ])
        );
      });
    painelInfo.append(el("div", { className: "mapa-info__corpo" }, [tabela]));
    if (opcoes.aoSelecionarFeicao) {
      painelInfo.append(
        el("button", {
          className: "botao botao--primario botao--compacto",
          type: "button",
          text: "Abrir ficha completa",
          onclick: () => opcoes.aoSelecionarFeicao(feicao),
        })
      );
    }
  }

  /* --------------------------------------------------------------- inicio */

  async function iniciar() {
    const controlador = criarMapa(areaMapa, {
      aoIdentificar: (feicao) => {
        if (!feicao || feicao.vazio) {
          painelInfo.hidden = true;
          return;
        }
        mostrarInformacao(feicao);
        opcoes.aoSelecionarFeicao?.(feicao);
      },
      aoMedir: ({ tipo, medida }) => {
        toast(`Medição (${tipo === "area" ? "área" : "distância"}): ${medida.texto}`, "sucesso", 6000);
      },
      aoErro: ({ mensagem }) => toast(mensagem, "erro", 6000),
      aoMudarEstado: () => renderPainel(),
    });
    estado.controlador = controlador;
    await controlador.iniciar();

    for (const definicao of CAMADAS) {
      try {
        const camada = await controlador.adicionarCamada(definicao);
        if (!camada) continue;
        if (estado.camadasAtivas.has(definicao.id)) continue;
        if (definicao.visivel !== false) {
          estado.camadasAtivas.add(definicao.id);
        } else {
          controlador.definirVisibilidade(definicao.id, false);
        }
      } catch (erro) {
        console.warn("[mapa] camada não carregada:", definicao.id, erro);
      }
    }
    renderPainel();
    return controlador;
  }

  return {
    iniciar,
    obterControlador: () => estado.controlador,
    destacarMunicipio: (codigo) => estado.controlador?.destacarMunicipio(codigo),
    irPara: (destino, opcoes) => estado.controlador?.irPara(destino, opcoes),
    atualizarCamadas: () => renderPainel(),
    destruir() {
      estado.controlador?.destruir?.();
    },
    ROTULOS_TIPOS,
  };
}

export { ICONES };
