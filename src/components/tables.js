/**
 * Tabela de dados com ordenacao, paginacao, busca e exportacao.
 */
import { el, limpar } from "../utils/dom.js";
import { paraCsv, baixarTexto, paraGeojson } from "../utils/export.js";
import { normalizar } from "../utils/format.js";

/**
 * Cria uma tabela interativa.
 * @param {HTMLElement} container
 * @param {object} opcoes {
 *   colunas: [{ chave, rotulo, formatar?, alinhamento?, largura? }],
 *   linhas: [],
 *   chave: "id",
 *   titulo, vazio,
 *   paginacao: true, porPagina: 25,
 *   aoClicarLinha: (linha) => {},
 *   exportaveis: true, nomeExportacao: "dados"
 * }
 */
export function criarTabela(container, opcoes) {
  const estado = {
    ordenacao: opcoes.ordenacaoInicial || null,
    direcao: opcoes.direcaoInicial || "asc",
    pagina: 1,
    porPagina: opcoes.paginacao === false ? Infinity : opcoes.porPagina || 25,
    busca: "",
  };

  function filtrarLinhas() {
    const busca = normalizar(estado.busca);
    let linhas = opcoes.linhas || [];
    if (busca) {
      linhas = linhas.filter((linha) =>
        normalizar(
          opcoes.colunas.map((c) => (typeof c.chave === "function" ? c.chave(linha) : linha[c.chave])).join(" ")
        ).includes(busca)
      );
    }
    if (estado.ordenacao) {
      const coluna = opcoes.colunas.find((c) => c.chave === estado.ordenacao);
      const valor = (linha) => {
        const bruto = typeof coluna?.chave === "function" ? coluna.chave(linha) : linha[estado.ordenacao];
        if (typeof bruto === "number") return bruto;
        if (typeof bruto === "string") return normalizar(bruto);
        return bruto ?? -Infinity;
      };
      linhas = [...linhas].sort((a, b) => {
        const va = valor(a);
        const vb = valor(b);
        if (va === vb) return 0;
        const comparacao = va > vb ? 1 : -1;
        return estado.direcao === "asc" ? comparacao : -comparacao;
      });
    }
    return linhas;
  }

  function render() {
    limpar(container);
    const todas = filtrarLinhas();
    const totalPaginas = Math.max(1, Math.ceil(todas.length / estado.porPagina));
    if (estado.pagina > totalPaginas) estado.pagina = totalPaginas;
    const inicio = (estado.pagina - 1) * estado.porPagina;
    const visiveis = Number.isFinite(estado.porPagina) ? todas.slice(inicio, inicio + estado.porPagina) : todas;

    if (opcoes.barraFerramentas !== false) {
      const barra = el("div", { className: "tabela__ferramentas" });
      if (opcoes.busca !== false) {
        const campo = el("input", {
          type: "search",
          className: "campo campo--busca",
          placeholder: opcoes.textoBusca || "Filtrar linhas…",
          "aria-label": opcoes.textoBusca || "Filtrar linhas",
          value: estado.busca,
          oninput: (ev) => {
            estado.busca = ev.target.value;
            estado.pagina = 1;
            render();
            const novo = container.querySelector(".campo--busca");
            novo?.focus();
            novo?.setSelectionRange(novo.value.length, novo.value.length);
          },
        });
        barra.append(campo);
      }
      const acoes = el("div", { className: "tabela__acoes" });
      if (opcoes.exportaveis !== false) {
        acoes.append(
          el("button", {
            className: "botao botao--secundario botao--compacto",
            type: "button",
            text: "CSV",
            title: "Exportar as linhas filtradas em CSV",
            onclick: () => {
              baixarTexto(
                `${opcoes.nomeExportacao || "dados"}.csv`,
                paraCsv(
                  todas.map((linha) => {
                    const saida = {};
                    opcoes.colunas.forEach((c) => {
                      const valor = typeof c.chave === "function" ? c.chave(linha) : linha[c.chave];
                      saida[c.exportar || c.rotulo] = valor;
                    });
                    return saida;
                  })
                ),
                "text/csv;charset=utf-8"
              );
            },
          })
        );
      }
      barra.append(acoes);
      container.append(barra);
    }

    if (!todas.length) {
      container.append(
        el("p", { className: "tabela__vazia", text: opcoes.vazio || "Nenhum registro encontrado para os filtros selecionados." })
      );
      return;
    }

    const tabela = el("table", { className: "tabela" });
    const thead = el("thead");
    const linhaCabecalho = el("tr");
    opcoes.colunas.forEach((coluna) => {
      const th = el("th", {
        scope: "col",
        style: coluna.largura ? { width: coluna.largura } : {},
        className: coluna.alinhamento ? `al-${coluna.alinhamento}` : "",
      });
      const chaveOrdenavel = typeof coluna.chave === "string" ? coluna.chave : null;
      if (chaveOrdenavel) {
        const botao = el("button", {
          className: "tabela__ordenar",
          type: "button",
          text: coluna.rotulo,
          "aria-label": `Ordenar por ${coluna.rotulo}`,
          onclick: () => {
            if (estado.ordenacao === chaveOrdenavel) {
              estado.direcao = estado.direcao === "asc" ? "desc" : "asc";
            } else {
              estado.ordenacao = chaveOrdenavel;
              estado.direcao = "asc";
            }
            render();
          },
        });
        if (estado.ordenacao === chaveOrdenavel) {
          botao.setAttribute("aria-sort", estado.direcao === "asc" ? "ascending" : "descending");
          botao.append(el("span", { className: "tabela__seta", text: estado.direcao === "asc" ? "▲" : "▼", "aria-hidden": "true" }));
        }
        th.append(botao);
      } else {
        th.textContent = coluna.rotulo;
      }
      linhaCabecalho.append(th);
    });
    thead.append(linhaCabecalho);

    const tbody = el("tbody");
    visiveis.forEach((linha) => {
      const tr = el("tr", {
        tabindex: opcoes.aoClicarLinha ? "0" : null,
        role: opcoes.aoClicarLinha ? "button" : null,
        "aria-label": opcoes.aoClicarLinha ? "Abrir registro" : null,
        onclick: opcoes.aoClicarLinha ? () => opcoes.aoClicarLinha(linha) : null,
        onkeydown: opcoes.aoClicarLinha
          ? (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                opcoes.aoClicarLinha(linha);
              }
            }
          : null,
      });
      opcoes.colunas.forEach((coluna) => {
        const valor = typeof coluna.chave === "function" ? coluna.chave(linha) : linha[coluna.chave];
        const td = el("td", { className: coluna.alinhamento ? `al-${coluna.alinhamento}` : "" });
        if (coluna.renderizar) td.append(coluna.renderizar(linha, valor));
        else td.textContent = valor ?? "—";
        tr.append(td);
      });
      tbody.append(tr);
    });

    tabela.append(thead, tbody);
    container.append(tabela);

    if (Number.isFinite(estado.porPagina)) {
      const paginacao = el("div", { className: "paginacao" });
      paginacao.append(
        el("p", {
          className: "paginacao__info",
          text: `${todas.length} registro(s) · página ${estado.pagina} de ${totalPaginas}`,
        })
      );
      const botoes = el("div", { className: "paginacao__botoes" });
      const anterior = el("button", {
        className: "botao botao--secundario botao--compacto",
        type: "button",
        text: "Anterior",
        disabled: estado.pagina <= 1,
        onclick: () => {
          estado.pagina -= 1;
          render();
        },
      });
      const proximo = el("button", {
        className: "botao botao--secundario botao--compacto",
        type: "button",
        text: "Próxima",
        disabled: estado.pagina >= totalPaginas,
        onclick: () => {
          estado.pagina += 1;
          render();
        },
      });
      botoes.append(anterior, proximo);
      paginacao.append(botoes);
      container.append(paginacao);
    }
  }

  render();
  return {
    atualizar(linhas) {
      opcoes.linhas = linhas;
      estado.pagina = 1;
      render();
    },
    render,
  };
}

/** Exporta uma colecao de features em GeoJSON. */
export function exportarGeojson(features, nome) {
  baixarTexto(`${nome}.geojson`, paraGeojson(features), "application/geo+json");
}
