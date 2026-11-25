/**
 * CENTRAL INFRA RO 360 — Controlador cartografico (ArcGIS Maps SDK 4.30).
 *
 * Responsavel por: criar a visualizacao 2D/3D, montar as camadas do catalogo,
 * alternar mapas base, medir, identificar feicoes, filtrar por municipio,
 * exportar, imprimir, compartilhar e localizar o usuario.
 */
import esriConfig from "@arcgis/core/config";
import Basemap from "@arcgis/core/Basemap";
import MapaEsri from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Extent from "@arcgis/core/geometry/Extent";
import Sketch from "@arcgis/core/widgets/Sketch";
import { when as quandoReativo } from "@arcgis/core/core/reactiveUtils";

import { config } from "../config.js";
import { caminhoDados } from "../services/data.js";

if (config.apiKey) {
  esriConfig.apiKey = config.apiKey;
}

const CENTRO_ESTADUAL = config.viewInicial.center;

export const ESTADO_VISUALIZACAO = {
  tipo: "2d",
  baseAtual: "streets",
  camadas: new Map(),
  esquema: new Map(),
};

/** Formata o extent para o hash de compartilhamento. */
function extentParaHash(extent) {
  if (!extent) return "";
  const r = (n) => Number(n).toFixed(4);
  return [r(extent.xmin), r(extent.ymin), r(extent.xmax), r(extent.ymax)].join(",");
}

function hashParaExtent(valor) {
  const partes = String(valor || "").split(",").map(Number);
  if (partes.length !== 4 || partes.some((n) => Number.isNaN(n))) return null;
  return new Extent({
    xmin: partes[0],
    ymin: partes[1],
    xmax: partes[2],
    ymax: partes[3],
    spatialReference: { wkid: 4326 },
  });
}

/**
 * Cria o controlador cartografico.
 * @param {HTMLElement} container
 * @param {object} callbacks { aoSelecionar, aoIdentificar, aoMedir, aoErro, aoMudarEstado }
 */
export function criarMapa(container, callbacks = {}) {
  let view = null;
  let sketch = null;
  let modoMedicao = null;
  let camadaDestaque = null;

  const estado = {
    tipo: "2d",
    baseAtual: "streets",
    camadas: new Map(),
    esquema: new Map(),
    destruction: false,
  };

  /**
   * Cria a camada tile de um mapa base.
   * A WebTileLayer 4.30 usa `urlTemplate` (nao `url`).
   */
  function camadaTile(url, titulo) {
    return new WebTileLayer({ urlTemplate: url, title: titulo });
  }

  /** Monta o Basemap correspondente a uma definicao de `config.basemaps`. */
  function montarBasemap(definicao) {
    const imagem = camadaTile(`${definicao.url}${definicao.tiles}`, "Referencia cartografica");
    if (definicao.id === "hybrid") {
      // Hibrido = imagem + rotulos de referencia
      const rotulos = camadaTile(`${config.rotulos.ref}${config.rotulos.tiles}`, "Referencias");
      return new Basemap({ baseLayers: [imagem, rotulos] });
    }
    return new Basemap({ baseLayers: [imagem] });
  }

  const basemapInicial = montarBasemap(config.basemaps[0]);

  const mapa = new MapaEsri({
    // O basemap precisa vir com a camada tile desde a criacao: um Basemap vazio
    // faz a visao nunca requisitar os tiles.
    basemap: basemapInicial,
    layers: [],
  });

  function notificar(evento, payload) {
    callbacks[evento]?.(payload);
  }

  async function criarVisualizacao() {
    const visualizacao = new MapView({
      container,
      map: mapa,
      center: CENTRO_ESTADUAL,
      zoom: config.viewInicial.zoom,
      constraints: { minZoom: 5, maxZoom: 18 },
      ui: { components: ["attribution", "zoom"] },
      // Na SDK 4.30 o popup nativo e pre-obsoleto e competes com o componente
      // proprio (view.on("click") + hitTest). Desligado de proposito.
      popupEnabled: false,
      navigationBreakpoint: 800,
      viewMode: "2d",
    });
    await visualizacao.when();
    return visualizacao;
  }

  /* ------------------------------------------------------------- mapas base */

  async function aplicarMapaBase(id) {
    const definicao = config.basemaps.find((b) => b.id === id) || config.basemaps[0];
    try {
      // `map.basemap` exige uma instancia de Basemap (nao de Map).
      mapa.basemap = montarBasemap(definicao);
      estado.baseAtual = definicao.id;
      notificar("aoMudarEstado", { ...resumoEstado() });
    } catch (erro) {
      notificar("aoErro", { mensagem: `Falha ao carregar o mapa base "${definicao.nome}".`, erro });
    }
  }

  /* ---------------------------------------------------------------- camadas */

  /**
   * Deriva a lista de campos (nome + tipo) de um FeatureCollection.
   *
   * A GeoJSONLayer do ArcGIS Maps SDK 4.30 infere os tipos a partir das
   * features e descarta o que nao consegue tipar (arrays, objetos e colunas
   * com tipos mistos) — o que gerava um aviso no console por camada.
   * Declarando os campos explicitamente o aviso some.
   */
  function derivarCampos(features) {
    const tipos = new Map();
    (features || []).forEach((f) => {
      Object.entries(f.properties || {}).forEach(([nome, valor]) => {
        if (valor === null || valor === undefined) return;
        const tipo = typeof valor;
        // O SDK nao possui um tipo de campo booleano: booleanos sao ignorados
        // (ficam de fora da lista de campos e nao geram erro de validacao).
        if (tipo !== "string" && tipo !== "number") return;
        if (!tipos.has(nome)) tipos.set(nome, tipo);
      });
    });
    return [...tipos].map(([name, tipo]) => ({
      name,
      alias: name,
      type: tipo === "number" ? "double" : "string",
    }));
  }

  async function adicionarCamada(definicao) {
    try {
      // A GeoJSONLayer exige geometria por URL (nao aceita `geojson` embutido).
      // O arquivo e lido uma vez para derivar os tipos dos campos.
      const resposta = await fetch(caminhoDados(definicao.arquivo), { cache: "default" });
      if (!resposta.ok) throw new Error(`Falha ao carregar ${definicao.arquivo} (HTTP ${resposta.status})`);
      const bruto = await resposta.json();
      const campos = derivarCampos(bruto.features);

      const opcoes = {
        id: definicao.id,
        title: definicao.titulo,
        visible: definicao.visivel !== false,
        listMode: "hide",
        popupEnabled: false,
        renderer: definicao.renderer,
        url: caminhoDados(definicao.arquivo),
        ...(campos.length ? { fields: campos } : {}),
        ...(definicao.opcoes || {}),
      };
      const camada = new GeoJSONLayer(opcoes);
      await camada.load();
      if (definicao.legenda) {
        estado.esquema.set(definicao.id, definicao.legenda);
      }
      mapa.add(camada);
      estado.camadas.set(definicao.id, definicao);
      notificar("aoMudarEstado", { ...resumoEstado() });
      return camada;
    } catch (erro) {
      notificar("aoErro", {
        mensagem: `Nao foi possivel carregar a camada "${definicao.titulo}".`,
        erro,
      });
      return null;
    }
  }

  function definirVisibilidade(id, visivel) {
    const camada = mapa.findLayerById(id);
    if (camada) camada.visible = visivel;
  }

  function listarCamadas() {
    return [...estado.camadas.values()];
  }

  /* -------------------------------------------------------------- navegacao */

  async function irPara(destino, opcoes = {}) {
    if (!view) return;
    try {
      if (destino && destino.xmin !== undefined) {
        await view.goTo(destino, { duration: 800 });
        return;
      }
      const [lon, lat] = Array.isArray(destino) ? destino : [destino.longitude, destino.latitude];
      await view.goTo({ center: [lon, lat], zoom: opcoes.zoom ?? 12 });
    } catch (erro) {
      notificar("aoErro", { mensagem: "Nao foi possivel centralizar o mapa no local solicitado.", erro });
    }
  }

  async function voltarAoEstado() {
    await irPara(
      new Extent({
        xmin: -67.0,
        ymin: -13.8,
        xmax: -59.6,
        ymax: -7.8,
        spatialReference: { wkid: 4326 },
      })
    );
  }

  /* ----------------------------------------------------------- identificacao */

  async function identificar(x, y) {
    if (!view) return null;
    try {
      const resposta = await view.hitTest(x, y, { include: mapa.layers });
      const resultado = resposta.results.find((r) => r.graphic && r.graphic.attributes);
      if (!resultado) {
        notificar("aoIdentificar", { vazio: true });
        return null;
      }
      const camada = resultado.graphic.layer || view.layer;
      const feicao = {
        camadaId: camada?.id,
        camadaTitulo: camada?.title,
        atributos: resultado.graphic.attributes,
        geometria: resultado.graphic.geometry,
        ponto: view.toMap({ x, y }),
      };
      notificar("aoIdentificar", feicao);
      return feicao;
    } catch (erro) {
      notificar("aoErro", { mensagem: "Falha ao identificar a feicao no mapa.", erro });
      return null;
    }
  }

  /* ------------------------------------------------------------- medicao */

  async function iniciarMedicao(tipo) {
    if (!view) return;
    modoMedicao = tipo;
    if (sketch) {
      sketch.destroy();
      sketch = null;
    }
    sketch = new Sketch({
      view,
      layout: "none",
      pointerDistance: 12,
      onSketchCreate: async (event) => {
        const geometria = event.geometry;
        const graphic = new Graphic({
          geometry: geometria,
          symbol: {
            type: "simple-line",
            color: tipo === "area" ? "#c9a227" : "#0b6e4f",
            width: 2,
            style: "solid",
          },
        });
        camadaDestaque?.removeAll();
        camadaDestaque.add(graphic);
        const resultado =
          tipo === "area" ? await view.measure?.area?.(geometria) : null;
        const medida = medirGeometria(geometria, tipo);
        notificar("aoMedir", { tipo, geometria, medida });
      },
      onSketchComplete: () => {
        sketch?.destroy();
        sketch = null;
        modoMedicao = null;
      },
    });
    view.add(sketch);
    sketch.start(tipo === "area" ? "draw-polygon" : "draw-polyline");
  }

  function pararMedicao() {
    sketch?.destroy();
    sketch = null;
    modoMedicao = null;
  }

  /** Medida geodesica local (evita depender de widgets do SDK). */
  function medirGeometria(geometria, tipo) {
    const R = 6371.0088;
    const pontos = [];
    if (geometria.type === "Polygon") {
      const anel = geometria.rings[0];
      for (let i = 0; i < anel.length - 1; i += 1) pontos.push(anel[i]);
    } else if (geometria.type === "Polyline") {
      geometria.paths.forEach((p) => p.forEach((pt) => pontos.push(pt)));
    }
    if (!pontos.length) return { valor: 0, texto: "—" };
    if (tipo === "area") {
      let soma = 0;
      for (let i = 0; i < pontos.length; i += 1) {
        const p1 = pontos[i];
        const p2 = pontos[(i + 1) % pontos.length];
        soma +=
          ((p2[0] - p1[0]) * Math.PI) / 180 *
          (2 + Math.sin((p1[1] * Math.PI) / 180) + Math.sin((p2[1] * Math.PI) / 180));
      }
      const km2 = Math.abs((soma * R * R) / 2);
      return { valor: km2, texto: `${km2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km²` };
    }
    let metros = 0;
    for (let i = 0; i < pontos.length - 1; i += 1) {
      metros += distanciaHaversine(pontos[i], pontos[i + 1]);
    }
    const km = metros / 1000;
    return { valor: km, texto: `${km.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km` };
  }

  function distanciaHaversine(a, b) {
    const R = 6371008.8;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLon = ((b[0] - a[0]) * Math.PI) / 180;
    const lat1 = (a[1] * Math.PI) / 180;
    const lat2 = (b[1] * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* ------------------------------------------------------------- destaque */

  async function destacarMunicipio(codigo) {
    if (!view) return;
    const camada = mapa.findLayerById("municipios");
    if (!camada) return;
    try {
      const resultado = await camada.queryFeatures({
        where: `codigo_ibge = '${codigo}'`,
        outFields: ["codigo_ibge", "nome"],
        returnGeometry: true,
      });
      if (!resultado.features.length) return;
      camada.highlight(resultado.features);
      await view.goTo(resultado.features[0].geometry.extent, { duration: 700 });
    } catch (erro) {
      notificar("aoErro", { mensagem: "Nao foi possivel destacar o municipio no mapa.", erro });
    }
  }

  function limparDestaques() {
    mapa.findLayerById("municipios")?.highlight?.();
  }

  /* ------------------------------------------------------------- exportacao */

  async function exportarCamada(id, formato = "geojson") {
    const camada = mapa.findLayerById(id);
    if (!camada) return null;
    const definicao = estado.camadas.get(id);
    const resultado = await camada.queryFeatures({ where: "1=1", outFields: ["*"], returnGeometry: true });
    const features = resultado.features.map((f) => ({
      type: "Feature",
      properties: f.attributes,
      geometry: f.geometry,
    }));
    if (formato === "csv") {
      const linhas = features.map((f) => f.properties);
      return { tipo: "csv", conteudo: linhas };
    }
    return {
      tipo: "geojson",
      conteudo: { type: "FeatureCollection", features, metadata: { camada: definicao?.titulo, status: definicao?.status } },
    };
  }

  /* ------------------------------------------------------------- localizacao */

  function localizarUsuario() {
    if (!navigator.geolocation) {
      notificar("aoErro", { mensagem: "Este dispositivo nao oferece geolocalizacao." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        const ponto = new Point({ longitude: posicao.coords.longitude, latitude: posicao.coords.latitude });
        if (camadaDestaque) {
          camadaDestaque.removeAll();
          camadaDestaque.add(
            new Graphic({
              geometry: ponto,
              symbol: {
                type: "simple-marker",
                style: "circle",
                color: "#0b6e4f",
                size: 12,
                outline: { color: "#ffffff", width: 2 },
              },
            })
          );
        }
        await view.goTo({ center: [ponto.longitude, ponto.latitude], zoom: 15 });
        notificar("aoLocalizar", { longitude: ponto.longitude, latitude: ponto.latitude });
      },
      () => notificar("aoErro", { mensagem: "Permissao de localizacao negada ou indisponivel." }),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  /* ------------------------------------------------------------- 2D / 3D */

  async function alternarDimensionalidade() {
    if (!view) return;
    const novoTipo = estado.tipo === "2d" ? "3d" : "2d";
    const container = view.container;
    const extent = view.extent.clone();
    const centro = view.center;
    const zoom = view.zoom;

    const novoView =
      novoTipo === "3d"
        ? new SceneView({
            container,
            map: mapa,
            center: centro,
            zoom,
            ui: { components: ["attribution", "zoom"] },
            quality: "medium",
            popupEnabled: false,
          })
        : new MapView({
            container,
            map: mapa,
            center: centro,
            zoom,
            constraints: { minZoom: 5, maxZoom: 18 },
            ui: { components: ["attribution", "zoom"] },
            popupEnabled: false,
          });

    await novoView.when();
    view = novoView;
    estado.tipo = novoTipo;
    registrarEventosView();
    notificar("aoMudarEstado", { ...resumoEstado() });
    return novoTipo;
  }

  /* --------------------------------------------------------------- eventos */

  function registrarEventosView() {
    if (!view) return;
    view.on("click", async (event) => {
      if (modoMedicao) return;
      await identificar(event.x, event.y);
    });
    view.on("pointer-move", (event) => {
      callbacks.aoMover?.(event);
    });
  }

  function resumoEstado() {
    return {
      tipo: estado.tipo,
      baseAtual: estado.baseAtual,
      camadas: listarCamadas(),
      esquema: estado.esquema,
    };
  }

  /* --------------------------------------------------------------- ciclo de vida */

  async function iniciar() {
    camadaDestaque = new GraphicsLayer({ id: "destaques", title: "Destaques", listMode: "hide" });
    mapa.add(camadaDestaque);

    view = await criarVisualizacao();
    registrarEventosView();

    // Estado compartilhado por link (#/mapa?...&extent=...)
    const parametros = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const extentHash = hashParaExtent(parametros.get("extent"));
    if (extentHash) {
      try {
        await view.goTo(extentHash, { duration: 0 });
      } catch {
        /* ignora extent invalido */
      }
    }

    // O basemap inicial ja foi montado com a camada tile; so troca se for preciso.
    if (estado.baseAtual !== config.basemaps[0].id) {
      await aplicarMapaBase(config.basemaps[0].id);
    }
    return controller;
  }

  function destruir() {
    estado.destruicao = true;
    pararMedicao();
    view?.destroy?.();
    view = null;
  }

  const controller = {
    iniciar,
    destruir,
    obterView: () => view,
    obterMapa: () => mapa,
    aplicarMapaBase,
    adicionarCamada,
    definirVisibilidade,
    listarCamadas,
    irPara,
    voltarAoEstado,
    identificar,
    iniciarMedicao,
    pararMedicao,
    destacarMunicipio,
    limparDestaques,
    exportarCamada,
    localizarUsuario,
    alternarDimensionalidade,
    resumoEstado,
    extentAtual: () => (view ? view.extent.clone() : null),
    hashVisualizacao: () => (view ? extentParaHash(view.extent) : ""),
    aoMudarView: (callback) => {
      quandoReativo(() => view?.extent, () => callback(view?.extent), { initial: false });
    },
  };

  return controller;
}

export { hashParaExtent, extentParaHash, CENTRO_ESTADUAL };
