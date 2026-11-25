/**
 * Cartoes de indicadores, cartoes de aplicativos e blocos de destaque.
 */
import { el } from "../utils/dom.js";
import { moedaCompacta, numero, percentual } from "../utils/format.js";

/** Cartao de indicador (KPI). */
export function cartaoIndicador({
  titulo,
  valor,
  detalhe,
  variacao = null,
  icone = null,
  aoClicar = null,
  tom = "padrao",
  rodape = null,
}) {
  const node = el(
    "article",
    {
      className: `cartao cartao--kpi cartao--${tom}`,
      tabindex: aoClicar ? "0" : null,
      role: aoClicar ? "button" : null,
      onclick: aoClicar ? () => aoClicar() : null,
      onkeydown: aoClicar
        ? (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              aoClicar();
            }
          }
        : null,
    },
    [
      el("header", { className: "cartao__cabecalho" }, [
        el("h3", { className: "cartao__titulo", text: titulo }),
        icone ? el("span", { className: "cartao__icone", "aria-hidden": "true", html: icone }) : null,
      ]),
      el("p", { className: "cartao__valor", text: valor }),
      detalhe ? el("p", { className: "cartao__detalhe", text: detalhe }) : null,
      variacao
        ? el("p", {
            className: `cartao__variacao cartao__variacao--${variacao.sentido || "neutro"}`,
            text: variacao.texto,
          })
        : null,
      rodape ? el("footer", { className: "cartao__rodape", text: rodape }) : null,
    ]
  );
  return node;
}

/** Cartao de aplicativo (link para um modulo). */
export function cartaoAplicativo({ id, titulo, descricao, icone, status, aoClicar, tags = [] }) {
  return el(
    "a",
    {
      className: "cartao cartao--aplicativo",
      href: `#/${id}`,
      "aria-label": `${titulo} — abrir aplicativo`,
    },
    [
      el("span", { className: "cartao__icone cartao__icone--aplicativo", "aria-hidden": "true", html: icone }),
      el("h3", { className: "cartao__titulo", text: titulo }),
      el("p", { className: "cartao__detalhe", text: descricao }),
      tags.length
        ? el(
            "ul",
            { className: "cartao__tags" },
            tags.map((tag) => el("li", { className: "etiqueta etiqueta--neutra", text: tag }))
          )
        : null,
      status ? el("span", { className: "cartao__status", text: status }) : null,
    ]
  );
}

/** Bloco de destaque (noticias, avisos). */
export function cartaoDestaque({ titulo, descricao, data, aoClicar, categoria }) {
  return el(
    aoClicar ? "button" : "article",
    {
      className: "cartao cartao--destaque",
      type: aoClicar ? "button" : null,
      onclick: aoClicar ? () => aoClicar() : null,
    },
    [
      categoria ? el("span", { className: "cartao__categoria", text: categoria }) : null,
      el("h3", { className: "cartao__titulo", text: titulo }),
      el("p", { className: "cartao__detalhe", text: descricao }),
      data ? el("time", { className: "cartao__data", datetime: data, text: data }) : null,
    ]
  );
}

/** Trilho de indicadores numericos (faixa horizontal). */
export function faixaIndicadores(itens) {
  return el(
    "div",
    { className: "faixa-indicadores" },
    itens.map((item) =>
      el("div", { className: "faixa-indicadores__item" }, [
        el("span", { className: "faixa-indicadores__rotulo", text: item.rotulo }),
        el("strong", { className: "faixa-indicadores__valor", text: item.valor }),
        item.detalhe ? el("span", { className: "faixa-indicadores__detalhe", text: item.detalhe }) : null,
      ])
    )
  );
}

/** Resumo de um registro em pares rotulo/valor. */
export function listaDados(pares, { colunas = 2 } = {}) {
  return el(
    "dl",
    { className: "lista-dados", style: { "--colunas": colunas } },
    pares.filter(Boolean).flatMap((par) => [
      el("dt", { text: par.rotulo }),
      el("dd", {}, par.valor instanceof Node ? [par.valor] : [String(par.valor ?? "—")]),
    ])
  );
}

export { moedaCompacta, numero, percentual };
