/**
 * Barra de filtros reutilizavel — alimenta o store global e recalcula
 * indicadores, tabelas, graficos e mapa.
 */
import { el, limpar } from "../utils/dom.js";
import { config } from "../config.js";
import { store, definirFiltros, limparFiltros } from "../services/state.js";
import { dados } from "../services/data.js";
import { moedaCompacta } from "../utils/format.js";

/**
 * Cria a barra de filtros.
 * @param {HTMLElement} container
 * @param {object} opcoes { mostrar: ["municipio","categoria","situacao","periodo","rodovia","orgao","fonte"], aoMudar }
 */
export function criarBarraFiltros(container, opcoes = {}) {
  const mostrar = opcoes.mostrar || ["municipio", "categoria", "situacao", "periodo"];
  const campos = {};

  function campo(rotulo, id) {
    const wrapper = el("div", { className: "campo-grupo" });
    const label = el("label", { className: "campo-rotulo", for: `filtro-${id}`, text: rotulo });
    wrapper.append(label);
    campos[id] = wrapper;
    return wrapper;
  }

  function opcao(valor, texto, selecionado) {
    return el("option", { value: valor, text: texto, selected: !!selecionado });
  }

  if (mostrar.includes("municipio")) {
    const wrapper = campo("Município", "municipio");
    const select = el("select", {
      id: "filtro-municipio",
      className: "campo",
      onchange: (ev) => {
        const codigo = ev.target.value || null;
        const municipio = dados.municipios.find((m) => m.codigo_ibge === codigo);
        definirFiltros({ municipio: codigo, municipioNome: municipio?.nome || null });
        opcoes.aoMudar?.();
      },
    });
    select.append(opcao("", "Todos os municípios"));
    [...dados.municipios]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .forEach((m) => select.append(opcao(m.codigo_ibge, m.nome)));
    wrapper.append(select);
  }

  if (mostrar.includes("categoria")) {
    const wrapper = campo("Categoria de obra", "categoria");
    const select = el("select", {
      id: "filtro-categoria",
      className: "campo",
      onchange: (ev) => {
        definirFiltros({ categoria: ev.target.value || null });
        opcoes.aoMudar?.();
      },
    });
    select.append(opcao("", "Todas as categorias"));
    config.categoriasObra.forEach((c) => select.append(opcao(c.id, c.nome)));
    wrapper.append(select);
  }

  if (mostrar.includes("situacao")) {
    const wrapper = campo("Situação", "situacao");
    const select = el("select", {
      id: "filtro-situacao",
      className: "campo",
      onchange: (ev) => {
        definirFiltros({ situacao: ev.target.value || null });
        opcoes.aoMudar?.();
      },
    });
    select.append(opcao("", "Todas as situações"));
    config.situacoes.obra.forEach((s) => select.append(opcao(s.id, s.nome)));
    wrapper.append(select);
  }

  if (mostrar.includes("rodovia")) {
    const wrapper = campo("Rodovia", "rodovia");
    const select = el("select", {
      id: "filtro-rodovia",
      className: "campo",
      onchange: (ev) => {
        definirFiltros({ rodovia: ev.target.value || null });
        opcoes.aoMudar?.();
      },
    });
    select.append(opcao("", "Todas as rodovias"));
    const codigos = new Set();
    dados.obras.forEach((o) => o.rodovia && codigos.add(o.rodovia));
    dados.rodovias?.forEach?.((r) => r.properties?.codigo_rodovia && codigos.add(r.properties.codigo_rodovia));
    [...codigos].sort().forEach((c) => select.append(opcao(c, c)));
    wrapper.append(select);
  }

  if (mostrar.includes("orgao")) {
    const wrapper = campo("Órgão responsável", "orgao");
    const select = el("select", {
      id: "filtro-orgao",
      className: "campo",
      onchange: (ev) => {
        definirFiltros({ orgao: ev.target.value || null });
        opcoes.aoMudar?.();
      },
    });
    select.append(opcao("", "Todos os órgãos"));
    const orgaos = new Set();
    dados.obras.forEach((o) => o.orgao_responsavel && orgaos.add(o.orgao_responsavel));
    dados.contratos.forEach((c) => c.orgao && orgaos.add(c.orgao));
    [...orgaos].sort().forEach((o) => select.append(opcao(o, o)));
    wrapper.append(select);
  }

  if (mostrar.includes("fonte")) {
    const wrapper = campo("Fonte de recurso", "fonte");
    const select = el("select", {
      id: "filtro-fonte",
      className: "campo",
      onchange: (ev) => {
        definirFiltros({ fonteRecurso: ev.target.value || null });
        opcoes.aoMudar?.();
      },
    });
    select.append(opcao("", "Todas as fontes"));
    const fontes = new Set();
    dados.obras.forEach((o) => o.fonte_recurso && fontes.add(o.fonte_recurso));
    [...fontes].sort().forEach((f) => select.append(opcao(f, f)));
    wrapper.append(select);
  }

  if (mostrar.includes("periodo")) {
    const wrapper = campo("Período", "periodo");
    const anos = el("div", { className: "campo-par" });
    const inicio = el("input", {
      type: "number",
      className: "campo campo--ano",
      min: "2015",
      max: "2030",
      value: store.obter("filtros").anoInicio,
      "aria-label": "Ano inicial",
      onchange: (ev) => {
        definirFiltros({ anoInicio: Number(ev.target.value) });
        opcoes.aoMudar?.();
      },
    });
    const fim = el("input", {
      type: "number",
      className: "campo campo--ano",
      min: "2015",
      max: "2030",
      value: store.obter("filtros").anoFim,
      "aria-label": "Ano final",
      onchange: (ev) => {
        definirFiltros({ anoFim: Number(ev.target.value) });
        opcoes.aoMudar?.();
      },
    });
    anos.append(inicio, el("span", { className: "campo-par__sep", text: "até" }), fim);
    wrapper.append(anos);
  }

  if (mostrar.includes("atrasados")) {
    const wrapper = el("div", { className: "campo-grupo campo-grupo--inline" });
    const id = "filtro-atrasados";
    const input = el("input", {
      type: "checkbox",
      id,
      onchange: (ev) => {
        definirFiltros({ apenasAtrasados: ev.target.checked });
        opcoes.aoMudar?.();
      },
    });
    wrapper.append(input, el("label", { for: id, text: "Somente atrasados/paralisados" }));
    campos.atrasados = wrapper;
  }

  if (mostrar.includes("criticos")) {
    const wrapper = el("div", { className: "campo-grupo campo-grupo--inline" });
    const id = "filtro-criticos";
    const input = el("input", {
      type: "checkbox",
      id,
      onchange: (ev) => {
        definirFiltros({ apenasCriticos: ev.target.checked });
        opcoes.aoMudar?.();
      },
    });
    wrapper.append(input, el("label", { for: id, text: "Somente criticidade alta/crítica" }));
    campos.criticos = wrapper;
  }

  function render() {
    limpar(container);
    const filtros = store.obter("filtros");
    Object.entries(campos).forEach(([chave, node]) => {
      const select = node.querySelector("select");
      if (select) {
        const valor = filtros[chave];
        select.value = valor ?? "";
      }
      const checkbox = node.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = !!filtros[chave];
    });
    // Os campos sao criados uma vez e reaproveitados a cada renderizacao.
    container.append(...Object.values(campos));
  }

  render();
  store.inscrever("filtros", render);

  return {
    render,
    aoMudar: (callback) => store.inscrever("filtros", callback),
    resumo() {
      const f = store.obter("filtros");
      const partes = [];
      if (f.municipioNome) partes.push(f.municipioNome);
      if (f.categoria) partes.push(config.categoriasObra.find((c) => c.id === f.categoria)?.nome);
      if (f.situacao) partes.push(config.situacoes.obra.find((s) => s.id === f.situacao)?.nome);
      if (f.rodovia) partes.push(f.rodovia);
      return partes;
    },
  };
}

/** Resumo chips dos filtros ativos (usado no topo dos aplicativos). */
export function criarChipsFiltros(container, aoRemover) {
  function render() {
    limpar(container);
    const f = store.obter("filtros");
    const chips = [];
    if (f.municipioNome) chips.push({ chave: "municipio", rotulo: f.municipioNome });
    if (f.categoria)
      chips.push({ chave: "categoria", rotulo: config.categoriasObra.find((c) => c.id === f.categoria)?.nome });
    if (f.situacao) chips.push({ chave: "situacao", rotulo: config.situacoes.obra.find((s) => s.id === f.situacao)?.nome });
    if (f.rodovia) chips.push({ chave: "rodovia", rotulo: f.rodovia });
    if (f.apenasAtrasados) chips.push({ chave: "apenasAtrasados", rotulo: "Somente atrasados" });
    if (f.apenasCriticos) chips.push({ chave: "apenasCriticos", rotulo: "Somente críticos" });

    if (!chips.length) {
      container.append(el("span", { className: "chips__vazio", text: "Nenhum filtro aplicado — exibindo o statewide." }));
      return;
    }
    chips.forEach((chip) => {
      container.append(
        el("button", {
          className: "chip",
          type: "button",
          title: "Remover filtro",
          onclick: () => aoRemover(chip.chave),
        }, [el("span", { text: chip.rotulo }), el("span", { className: "chip__x", text: "×", "aria-hidden": "true" })])
      );
    });
    container.append(
      el("button", {
        className: "chip chip--limpar",
        type: "button",
        text: "Limpar filtros",
        onclick: () => limparFiltros(),
      })
    );
  }
  render();
  store.inscrever("filtros", render);
  return { render };
}

/** Painel de resumo dos filtros (valores do recorte atual). */
export function cartaoResumoFiltros(indicadores) {
  return el("div", { className: "cartao cartao--resumo" }, [
    el("div", { className: "cartao__titulo", text: "Recorte atual" }),
    el("ul", { className: "lista-resumo" }, [
      el("li", {}, [el("span", { text: "Obras no recorte" }), el("strong", { text: String(indicadores.obras) })]),
      el("li", {}, [el("span", { text: "Investimento no recorte" }), el("strong", { text: moedaCompacta(indicadores.valorObras) })]),
      el("li", {}, [el("span", { text: "Municípios atingidos" }), el("strong", { text: `${indicadores.municipiosAtendidos} de ${indicadores.totalMunicipios}` })]),
      el("li", {}, [el("span", { text: "Execução física média" }), el("strong", { text: `${indicadores.execucaoMedia.toFixed(1)}%` })]),
    ]),
  ]);
}
