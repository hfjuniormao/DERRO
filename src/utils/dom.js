/**
 * Utilitarios de DOM — criacao de elementos, eventos e helpers de foco.
 */

/**
 * Cria um elemento com atributos e filhos.
 * @param {string} tag
 * @param {object} [props] atributos, className, text, html, dataset, on*
 * @param {Array|Node|string} [filhos]
 */
export function el(tag, props = {}, filhos = []) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined || valor === false) return;
    if (chave === "className" || chave === "class") node.className = valor;
    else if (chave === "text") node.textContent = valor;
    else if (chave === "html") node.innerHTML = valor;
    else if (chave === "dataset") Object.assign(node.dataset, valor);
    else if (chave === "style" && typeof valor === "object") Object.assign(node.style, valor);
    else if (chave.startsWith("on") && typeof valor === "function")
      node.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (valor === true) node.setAttribute(chave, "");
    else node.setAttribute(chave, valor);
  });
  const lista = Array.isArray(filhos) ? filhos : [filhos];
  lista.flat().forEach((filho) => {
    if (filho === null || filho === undefined || filho === false) return;
    node.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  });
  return node;
}

/** Remove todos os filhos de um nó. */
export function limpar(no) {
  while (no && no.firstChild) no.removeChild(no.firstChild);
  return no;
}

/** Delegação de eventos: captura cliques em elementos com [data-acao]. */
export function delegar(raiz, evento, seletor, manipulador) {
  raiz.addEventListener(evento, (ev) => {
    const alvo = ev.target.closest(seletor);
    if (alvo && raiz.contains(alvo)) manipulador(ev, alvo);
  });
}

/** Foca o primeiro campo focoavel de um container. */
export function focarPrimeiro(container) {
  const alvo = container.querySelector(
    "input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex='-1'])"
  );
  if (alvo) alvo.focus();
}

/** Mantem o foco dentro do container enquanto o modal estiver aberto. */
export function prenderFoco(container) {
  const aoTeclar = (ev) => {
    if (ev.key !== "Tab") return;
    const focaveis = [...container.querySelectorAll("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
      (n) => n.offsetParent !== null
    );
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primeiro.focus();
    }
  };
  container.addEventListener("keydown", aoTeclar);
  return () => container.removeEventListener("keydown", aoTeclar);
}

/** Debounce simples. */
export function debounce(fn, espera = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), espera);
  };
}

/** Converte string para slug de anchor/navegacao. */
export function ancora(id) {
  return String(id || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
