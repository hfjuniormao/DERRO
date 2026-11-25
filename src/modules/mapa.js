/**
 * APP 15 — Geoportal integrado.
 * Visualizador centralizado com catalogo de camadas agrupadas, combinacao de
 * camadas e consulta espacial (selecao de feicoes por area desenhada).
 */
import { el } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { criarInterfaceMapa } from "../components/mapa.js";
import { toast, abrirModal, etiquetaStatus } from "../components/ui.js";
import { numero, moedaCompacta } from "../utils/format.js";

export async function montar(container, ctx) {
  const parametros = ctx?.parametros || {};
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Geoportal integrado" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Catálogo completo de camadas do Estado de Rondônia — limites administrativos, rodovia, obras, " +
            "contratos, ativos, logística, convênios, máquinas, meio ambiente, indicadores, planejamento e riscos — " +
            "com consulta espacial, exportação e compartilhamento de visualizações.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        etiquetaStatus("REAL", "Camadas oficiais"),
        etiquetaStatus("SIMULADO", "Camadas demonstrativas"),
      ]),
    ])
  );

  const areaMapa = el("div", { className: "painel" });
  const areaConsulta = el("div", { className: "painel" });
  pagina.append(areaMapa, areaConsulta);

  const mapa = criarInterfaceMapa(areaMapa, {
    titulo: "Catálogo de camadas",
    aoSelecionarFeicao: (feicao) => {
      if (!feicao || feicao.vazio) return;
      const titulo = feicao.atributos?.titulo || feicao.atributos?.nome || feicao.atributos?.codigo_rodovia || "Feição";
      abrirModal({
        titulo,
        subtitulo: feicao.camadaTitulo || "",
        largura: "620px",
        conteudo: tabelaAtributos(feicao.atributos),
      });
    },
  });

  function tabelaAtributos(atributos) {
    const tabela = el("table", { className: "tabela tabela--compacta" });
    Object.entries(atributos || {})
      .filter(([chave, valor]) => !["geometria", "geometry"].includes(chave) && typeof valor !== "object")
      .forEach(([chave, valor]) => {
        tabela.append(
          el("tr", {}, [
            el("th", { scope: "row", text: chave.replace(/_/g, " ") }),
            el("td", { text: String(valor ?? "—") }),
          ])
        );
      });
    return tabela;
  }

  /* --------------------------------------------------- consulta espacial */
  areaConsulta.append(
    el("header", { className: "painel__cabecalho" }, [
      el("h3", { className: "painel__titulo", text: "Consulta espacial" }),
      el("span", { className: "etiqueta etiqueta--neutra", text: "GeoJSON local" }),
    ])
  );

  const areaResultado = el("div");
  areaConsulta.append(
    el("p", {
      className: "painel__descricao",
      text:
        "Desenhe um círculo ou polígono no mapa para listar as feições da camada ativa contidas na área " +
        "selecionada. O resultado usa queryFeatures do ArcGIS Maps SDK sobre as camadas carregadas.",
    }),
    el("div", { className: "pagina__acoes" }, [
      el("button", {
        className: "botao botao--primario",
        type: "button",
        text: "Selecionar por círculo",
        onclick: () => iniciarConsulta("circle"),
      }),
      el("button", {
        className: "botao botao--secundario",
        type: "button",
        text: "Selecionar por polígono",
        onclick: () => iniciarConsulta("polygon"),
      }),
      el("button", {
        className: "botao botao--secundario",
        type: "button",
        text: "Limpar resultado",
        onclick: () => {
          areaResultado.innerHTML = "";
        },
      }),
    ]),
    areaResultado
  );

  async function iniciarConsulta(tipo) {
    const controlador = mapa.obterControlador();
    if (!controlador) {
      toast("Mapa ainda não carregou.", "erro");
      return;
    }
    const SketchModule = await import("@arcgis/core/widgets/Sketch");
    const GraphicModule = await import("@arcgis/core/Graphic");
    const Sketch = SketchModule.default;
    const Graphic = GraphicModule.default;

    const view = controlador.obterView();
    const sketch = new Sketch({
      view,
      layer: null,
      geometryTypes: [tipo],
      onSketchCreate: async (event) => {
        const controller = mapa.obterControlador();
        const gerenciado = controller.obterMapa();
        let total = 0;
        const detalhes = [];
        for (const camada of gerenciado.layers) {
          if (!camada.queryFeatures) continue;
          try {
            const resultado = await camada.queryFeatures({
              geometry: event.geometry,
              geometryType: "esriGeometryPolygon",
              spatialRel: "esriSpatialRelIntersects",
              outFields: ["*"],
              returnGeometry: false,
            });
            if (!resultado.features.length) continue;
            total += resultado.features.length;
            detalhes.push({ camada: camada.title, quantidade: resultado.features.length });
          } catch (erro) {
            console.warn("[geoportal] consulta espacial falhou:", erro);
          }
        }
        areaResultado.innerHTML = "";
        areaResultado.append(
          el("div", { className: "resultado-consulta" }, [
            el("h4", { text: `${total} feição(ões) na área desenhada` }),
            detalhes.length
              ? el(
                  "ul",
                  { className: "lista-simples" },
                  detalhes.map((d) => el("li", { text: `${d.camada}: ${d.quantidade} registro(s)` }))
                )
              : el("p", { className: "ficha__vazio", text: "Nenhuma feição encontrada na área selecionada." }),
          ])
        );
        sketch.destroy();
      },
    });
    view.add(sketch);
    sketch.start(tipo);
    toast(`Desenhe uma área no mapa para consultar (${tipo === "circle" ? "círculo" : "polígono"}).`, "info", 3200);
  }

  container.append(pagina);

  await mapa.iniciar();
  if (parametros.camada) {
    toast(`Camada "${parametros.camada}" destacada no catálogo de camadas.`, "info", 4000);
  }
  if (parametros.foco) {
    const registro = dados.obras.find((o) => o.id === parametros.foco);
    if (registro) {
      mapa.irPara([registro.localizacao.lon, registro.localizacao.lat], { zoom: 13 });
    }
  }

  return {
    destruir() {
      mapa.destruir?.();
    },
  };
}
