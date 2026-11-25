/**
 * Componentes transversais: avisos (toast), dialogo (modal), painel lateral,
 * etiquetas de status, estados vazios e carregamento.
 */
import { el, limpar, prenderFoco } from "../utils/dom.js";
import { escapar } from "../utils/format.js";

/* ------------------------------------------------------------------- toast */

let areaToast = null;

function garantirAreaToast() {
  if (!areaToast) {
    areaToast = el("div", { className: "area-toast", role: "status", "aria-live": "polite" });
    document.body.append(areaToast);
  }
  return areaToast;
}

/** Exibe um aviso temporario. */
export function toast(mensagem, tipo = "info", duracao = 4200) {
  const area = garantirAreaToast();
  const item = el("div", { className: `toast toast--${tipo}` }, [
    el("span", { className: "toast__icone", text: tipo === "erro" ? "!" : tipo === "sucesso" ? "✓" : "i", "aria-hidden": "true" }),
    el("p", { className: "toast__texto", text: mensagem }),
  ]);
  area.append(item);
  const fechar = () => {
    item.classList.add("toast--saindo");
    setTimeout(() => item.remove(), 220);
  };
  item.addEventListener("click", fechar);
  setTimeout(fechar, duracao);
  return fechar;
}

/* ------------------------------------------------------------------- modal */

let modalAberto = null;

/**
 * Abre um dialogo modal.
 * @param {object} opcoes { titulo, subtitulo, conteudo (Node|string), acoes:[], largura }
 */
export function abrirModal({ titulo, subtitulo = "", conteudo, acoes = [], largura = "720px", aoFechar }) {
  fecharModal();
  const caixa = el("div", { className: "modal__caixa", role: "dialog", "aria-modal": "true", "aria-label": titulo, style: { maxWidth: largura } });
  const cabecalho = el("header", { className: "modal__cabecalho" }, [
    el("div", {}, [
      el("h2", { className: "modal__titulo", text: titulo }),
      subtitulo ? el("p", { className: "modal__subtitulo", text: subtitulo }) : null,
    ]),
    el("button", {
      className: "botao-icone",
      type: "button",
      "aria-label": "Fechar",
      onclick: () => fecharModal(),
      html: "&times;",
    }),
  ]);

  const corpo = el("div", { className: "modal__corpo" });
  if (typeof conteudo === "string") corpo.innerHTML = conteudo;
  else if (conteudo) corpo.append(conteudo);

  const rodape = el("footer", { className: "modal__rodape" });
  acoes.forEach((acao) => {
    rodape.append(
      el("button", {
        className: `botao ${acao.classe || "botao--secundario"}`,
        type: "button",
        text: acao.rotulo,
        onclick: () => acao.aoClicar?.(aoFechar),
      })
    );
  });

  caixa.append(cabecalho, corpo, rodape);
  const fundo = el("div", { className: "modal", onclick: (ev) => { if (ev.target === fundo) fecharModal(); } }, [caixa]);
  document.body.append(fundo);
  document.body.style.overflow = "hidden";
  const soltar = prenderFoco(caixa);
  modalAberto = { fundo, soltar, aoFechar };
  caixa.querySelector("button, [href], input")?.focus();
  return { fechar: fecharModal, corpo };
}

/** Fecha o modal aberto (se houver). */
export function fecharModal() {
  if (!modalAberto) return;
  modalAberto.soltar?.();
  modalAberto.fundo.remove();
  modalAberto.aoFechar?.();
  modalAberto = null;
  document.body.style.overflow = "";
}

document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (modalAberto) fecharModal();
  else if (drawerAberto) fecharDrawer();
});

/* ------------------------------------------------------------------ drawer */

/** Painel lateral deslizante (fichas de obra, filtros, detalhes). */
export function abrirDrawer({ titulo, subtitulo = "", conteudo, largura = "440px" }) {
  fecharDrawer();
  const caixa = el("aside", {
    className: "drawer__caixa",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": titulo,
    style: { width: largura },
  });
  caixa.append(
    el("header", { className: "drawer__cabecalho" }, [
      el("div", {}, [
        el("h2", { className: "drawer__titulo", text: titulo }),
        subtitulo ? el("p", { className: "drawer__subtitulo", text: subtitulo }) : null,
      ]),
      el("button", { className: "botao-icone", type: "button", "aria-label": "Fechar painel", onclick: () => fecharDrawer(), html: "&times;" }),
    ])
  );
  const corpo = el("div", { className: "drawer__corpo" });
  if (typeof conteudo === "string") corpo.innerHTML = conteudo;
  else if (conteudo) corpo.append(conteudo);
  caixa.append(corpo);

  const fundo = el("div", { className: "drawer", onclick: (ev) => { if (ev.target === fundo) fecharDrawer(); } }, [caixa]);
  document.body.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("drawer--aberto"));
  drawerAberto = { fundo, corpo };
  return { fechar: fecharDrawer, corpo };
}

let drawerAberto = null;

export function fecharDrawer() {
  if (!drawerAberto) return;
  drawerAberto.fundo.remove();
  drawerAberto = null;
}

/* --------------------------------------------------------------- etiquetas */

/** Etiqueta de status da fonte de dados (REAL / SIMULADO / INDISPONIVEL). */
export function etiquetaStatus(status, texto = null) {
  const rotulos = { REAL: "DADOS REAIS", SIMULADO: "DADOS SIMULADOS", INDISPONIVEL: "INDISPONÍVEL" };
  const classe = status === "REAL" ? "etiqueta--real" : status === "SIMULADO" ? "etiqueta--simulado" : "etiqueta--indisponivel";
  return el("span", { className: `etiqueta ${classe}`, text: texto || rotulos[status] || status, title: "Origem do dado neste painel" });
}

/** Etiqueta de situacao (obra, contrato, convenio...). */
export function etiquetaSituacao(situacao) {
  const mapa = {
    planejada: "Planejada",
    em_execucao: "Em execução",
    atrasada: "Atrasada",
    paralisada: "Paralisada",
    concluida: "Concluída",
    cancelada: "Cancelada",
    vigente: "Vigente",
    a_vencer: "A vencer",
    atrasado: "Atrasado",
    paralisado: "Paralisado",
    encerrado: "Encerrado",
    rescindido: "Rescindido",
    execucao: "Em execução",
    concluido: "Concluído",
    cancelado: "Cancelado",
    operacional: "Operacional",
    manutencao: "Em manutenção",
    inoperante: "Inoperante",
    afastada: "Afastada",
  };
  return el("span", { className: `etiqueta etiqueta--situacao situacao--${situacao}`, text: mapa[situacao] || situacao });
}

/* ------------------------------------------------------------ estado vazio */

export function estadoVazio(titulo, descricao = "", acao = null) {
  return el("div", { className: "estado-vazio" }, [
    el("h3", { text: titulo }),
    descricao ? el("p", { text: descricao }) : null,
    acao
      ? el("button", { className: "botao botao--secundario", type: "button", text: acao.rotulo, onclick: acao.aoClicar })
      : null,
  ]);
}

export function carregando(texto = "Carregando dados…") {
  return el("div", { className: "carregando-bloco", role: "status" }, [
    el("span", { className: "giro giro--pequeno", "aria-hidden": "true" }),
    el("p", { text: texto }),
  ]);
}

export function blocoAviso(titulo, descricao, tipo = "info") {
  return el("div", { className: `aviso aviso--${tipo}` }, [
    el("strong", { text: titulo }),
    descricao ? el("span", { text: descricao }) : null,
  ]);
}

export { escapar, limpar };
