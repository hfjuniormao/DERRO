/**
 * Roteador por hash (#/rota) com carregamento sob demanda dos aplicativos.
 */
import { fecharDrawer, fecharModal } from "./components/ui.js";

const rotas = new Map();
let aoNavegar = null;
let rotaAtiva = null;

export function registrarRota(id, carregador, opcoes = {}) {
  rotas.set(id, { id, carregador, ...opcoes });
}

export function obterRota(id) {
  return rotas.get(id) || null;
}

export function definirNavegador(callback) {
  aoNavegar = callback;
}

/** Interpreta o hash atual -> { id, parametros }. */
export function analisarHash(hash = window.location.hash) {
  const bruto = (hash || "").replace(/^#\/?/, "");
  const [caminho, consulta] = bruto.split("?");
  const partes = caminho.split("/").filter(Boolean);
  const id = partes[0] || "inicio";
  const parametros = Object.fromEntries(new URLSearchParams(consulta || ""));
  return { id, partes, parametros };
}

/** Navega para uma rota interna. */
export function navegar(id, parametros = {}) {
  const query = new URLSearchParams(parametros).toString();
  const destino = `#/${id}${query ? `?${query}` : ""}`;
  if (window.location.hash === destino) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = destino;
}

export function rotaAtual() {
  return rotaAtiva;
}

/**
 * Executa a rota do hash atual: carrega o modulo, monta e devolve o controle.
 * @param {HTMLElement} container
 */
export async function executarRota(container, hash = window.location.hash) {
  const { id, parametros } = analisarHash(hash);
  const definicao = rotas.get(id) || rotas.get("inicio");
  if (!definicao) return null;

  if (rotaAtiva?.destruir) {
    try {
      rotaAtiva.destruir();
    } catch (erro) {
      console.error("[router] erro ao destruir rota anterior:", erro);
    }
  }
  // Painel lateral e dialogo nao sobrevivem a troca de rota.
  fecharDrawer();
  fecharModal();
  container.innerHTML = "";
  container.scrollTop = 0;

  let modulo;
  try {
    modulo = await definicao.carregador();
  } catch (erro) {
    console.error("[router] falha ao carregar o modulo:", erro);
    container.innerHTML = `
      <section class="pagina">
        <h1>Não foi possível carregar este aplicativo</h1>
        <p>O módulo solicitado não está disponível neste ambiente. Tente recarregar a página.</p>
        <p class="erro-tecnico">${String(erro.message || erro)}</p>
      </section>`;
    return null;
  }

  const contexto = { parametros, rota: id, navegar };
  const controle = await modulo.montar(container, contexto);
  rotaAtiva = {
    id,
    parametros,
    destruir: async () => {
      await controle?.destruir?.();
    },
  };
  aoNavegar?.(id, parametros);
  return controle;
}

/** Inicia o roteador: escuta mudancas de hash. */
export function iniciarRoteador(container) {
  const processar = () => executarRota(container);
  window.addEventListener("hashchange", processar);
  if (!window.location.hash) window.location.hash = "#/inicio";
  return processar();
}
