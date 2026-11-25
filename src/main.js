/**
 * CENTRAL INFRA RO 360 — ponto de entrada da aplicacao.
 */
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/map.css";

import { config } from "./config.js";
import { carregarDados, dados, buscar } from "./services/data.js";
import { store } from "./services/state.js";
import { registrarRota, iniciarRoteador, definirNavegador, analisarHash } from "./router.js";
import { lerSessao, abrirAreaRestrita } from "./auth.js";
import { toast } from "./components/ui.js";
import { el, limpar } from "./utils/dom.js";
import { debounce } from "./utils/dom.js";

/* ------------------------------------------------------------- rotas */

const ROTAS = [
  { id: "inicio", rotulo: "Início", grupo: "Visão geral", icone: "🏠", carga: () => import("./modules/inicio.js") },
  { id: "painel", rotulo: "Painel Executivo", grupo: "Visão geral", icone: "📊", carga: () => import("./modules/painel.js") },
  { id: "municipios", rotulo: "Municípios", grupo: "Visão geral", icone: "🏛️", carga: () => import("./modules/municipios.js") },

  { id: "rodovias", rotulo: "Sistema Rodoviário", grupo: "Infraestrutura", icone: "🛣️", carga: () => import("./modules/rodovias.js") },
  { id: "obras", rotulo: "Obras 360", grupo: "Infraestrutura", icone: "🏗️", carga: () => import("./modules/obras.js") },
  { id: "ativos", rotulo: "Pontes e Ativos", grupo: "Infraestrutura", icone: "🌉", carga: () => import("./modules/ativos.js") },
  { id: "contratos", rotulo: "Contratos", grupo: "Infraestrutura", icone: "📄", carga: () => import("./modules/contratos.js") },
  { id: "convenios", rotulo: "Convênios", grupo: "Infraestrutura", icone: "🤝", carga: () => import("./modules/convenios.js") },
  { id: "maquinas", rotulo: "Máquinas", grupo: "Infraestrutura", icone: "🚜", carga: () => import("./modules/maquinas.js") },

  { id: "logistica", rotulo: "Logística", grupo: "Análises", icone: "🚚", carga: () => import("./modules/logistica.js") },
  { id: "meioambiente", rotulo: "Meio Ambiente", grupo: "Análises", icone: "🌿", carga: () => import("./modules/meioambiente.js") },
  { id: "planejamento", rotulo: "Planejamento", grupo: "Análises", icone: "🧭", carga: () => import("./modules/planejamento.js") },
  { id: "geoai", rotulo: "GeoAI", grupo: "Análises", icone: "🤖", carga: () => import("./modules/geoai.js") },
  { id: "assistente", rotulo: "InfraAI RO", grupo: "Análises", icone: "💬", carga: () => import("./modules/assistente.js") },

  { id: "mapa", rotulo: "Geoportal", grupo: "Serviços", icone: "🗺️", carga: () => import("./modules/mapa.js") },
  { id: "fiscalizacao", rotulo: "Fiscalização", grupo: "Serviços", icone: "📋", carga: () => import("./modules/fiscalizacao.js") },
  { id: "dados-abertos", rotulo: "Dados Abertos", grupo: "Serviços", icone: "📦", carga: () => import("./modules/dados-abertos.js") },
  { id: "fontes", rotulo: "Fontes", grupo: "Serviços", icone: "🔎", carga: () => import("./modules/fontes.js") },
  { id: "admin", rotulo: "Administração", grupo: "Serviços", icone: "🔐", carga: () => import("./modules/admin.js") },
  { id: "documentacao", rotulo: "Documentação", grupo: "Serviços", icone: "📚", carga: () => import("./modules/documentacao.js") },
];

ROTAS.forEach((rota) => {
  registrarRota(rota.id, rota.carga, { rotulo: rota.rotulo });
});

/* ------------------------------------------------------- navegacao principal */

function construirNavegacao() {
  const lista = document.getElementById("lista-navegacao");
  if (!lista) return;
  limpar(lista);
  const grupos = [...new Set(ROTAS.map((r) => r.grupo))];
  grupos.forEach((grupo) => {
    const itens = ROTAS.filter((r) => r.grupo === grupo);
    if (itens.length === 1) {
      const [item] = itens;
      lista.append(
        el("li", {}, [
          el("a", { href: `#/${item.id}`, dataset: { rota: item.id } }, [
            el("span", { "aria-hidden": "true", text: item.icone }),
            el("span", { text: item.rotulo }),
          ]),
        ])
      );
      return;
    }
    const submenu = el("ul", { className: "navegacao__submenu" });
    itens.forEach((item) => {
      submenu.append(
        el("li", {}, [
          el("a", { href: `#/${item.id}`, dataset: { rota: item.id } }, [
            el("span", { "aria-hidden": "true", text: item.icone }),
            el("span", { text: item.rotulo }),
          ]),
        ])
      );
    });
    const botao = el("a", { href: `#/${itens[0].id}`, dataset: { rota: itens[0].id } }, [
      el("span", { "aria-hidden": "true", text: itens[0].icone }),
      el("span", { text: grupo }),
    ]);
    lista.append(el("li", { className: "navegacao__grupo" }, [botao, submenu]));
  });
}

function marcarRotaAtiva(id) {
  document.querySelectorAll("#lista-navegacao a").forEach((link) => {
    if (link.dataset.rota === id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

definirNavegador((id) => {
  marcarRotaAtiva(id);
  const rota = ROTAS.find((r) => r.id === id);
  document.title = rota ? `${rota.rotulo} — ${config.app.nome}` : config.app.nome;
});

/* ------------------------------------------------------------- busca global */

function ligarBuscaGlobal() {
  const form = document.getElementById("form-busca-global");
  const campo = document.getElementById("busca-global");
  const resultados = document.getElementById("resultados-busca");
  if (!form || !campo || !resultados) return;

  const render = debounce(() => {
    const termo = campo.value.trim();
    limpar(resultados);
    if (termo.length < 2) {
      resultados.hidden = true;
      campo.setAttribute("aria-expanded", "false");
      return;
    }
    const encontrados = buscar(termo, 10);
    if (!encontrados.length) {
      resultados.append(el("li", { className: "busca-global__vazio", text: "Nenhum resultado para esta busca." }));
    } else {
      encontrados.forEach((item) => {
        resultados.append(
          el(
            "li",
            {
              role: "option",
              tabindex: "0",
              onclick: () => {
                window.location.hash = item.rota;
                limpar(resultados);
                resultados.hidden = true;
                campo.value = "";
              },
              onkeydown: (ev) => {
                if (ev.key === "Enter") ev.target.click();
              },
            },
            [
              el("span", { text: item.titulo }),
              el("span", { className: "tipo", text: item.tipo }),
            ]
          )
        );
      });
    }
    resultados.hidden = false;
    campo.setAttribute("aria-expanded", "true");
  }, 220);

  campo.addEventListener("input", render);
  campo.addEventListener("focus", () => {
    if (campo.value.trim().length >= 2) render();
  });
  document.addEventListener("click", (ev) => {
    if (!form.contains(ev.target)) {
      resultados.hidden = true;
      campo.setAttribute("aria-expanded", "false");
    }
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const primeiro = resultados.querySelector("li[role=option]");
    primeiro?.click();
  });
}

/* ------------------------------------------------------------- menu movel */

function ligarMenuMovel() {
  const botao = document.getElementById("btn-menu");
  const navegacao = document.getElementById("navegacao-principal");
  if (!botao || !navegacao) return;
  botao.addEventListener("click", () => {
    const aberta = navegacao.classList.toggle("aberta");
    botao.setAttribute("aria-expanded", String(aberta));
  });
}

/* ----------------------------------------------------------------- PWA */

async function registrarServiceWorker() {
  if (!config.pwaAtivo) return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  try {
    const base = import.meta.env.BASE_URL || "/";
    await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  } catch (erro) {
    console.warn("[pwa] service worker não registrado:", erro);
  }
}

/* ------------------------------------------------------------------ boot */

async function iniciar() {
  const status = document.getElementById("status-dados");
  const carregando = document.getElementById("carregando-inicial");
  const rodapeAno = document.getElementById("rodape-ano");
  if (rodapeAno) rodapeAno.textContent = `© ${new Date().getFullYear()} — Governo do Estado de Rondônia.`;

  construirNavegacao();
  ligarBuscaGlobal();
  ligarMenuMovel();
  document.getElementById("btn-area-restrita")?.addEventListener("click", abrirAreaRestrita);
  lerSessao();

  let resultado;
  try {
    resultado = await carregarDados();
  } catch (erro) {
    console.error("[app] falha crítica ao carregar dados:", erro);
    status.textContent = "Falha ao carregar dados";
    status.dataset.pronto = "false";
    if (carregando) {
      carregando.querySelector("p").textContent = "Não foi possível carregar as bases de dados. Verifique a conexão e recarregue.";
    }
    return;
  }

  store.definir({ dadosCarregados: true, erroDados: resultado.estado === "parcial" ? resultado.relatorio.falhas : null });
  if (status) {
    status.textContent =
      resultado.estado === "parcial"
        ? `Dados carregados com ${resultado.relatorio.falhas.length} falha(s)`
        : "Dados carregados";
    status.dataset.pronto = resultado.estado !== "parcial";
  }
  if (resultado.estado === "parcial") {
    toast(
      `Parte das bases não carregou: ${resultado.relatorio.falhas.map((f) => f.arquivo).join(", ")}`,
      "erro",
      8000
    );
  }

  // pre-carrega as bases espaciais usadas pelo mapa
  await Promise.all(
    ["rodovias", "vias-estaduais", "ambiente"].map(async (nome) => {
      try {
        const resposta = await fetch(`${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/data/${nome}.geojson`);
        if (!resposta.ok) throw new Error(String(resposta.status));
        const geojson = await resposta.json();
        if (nome === "rodovias") dados.rodovias = geojson.features || [];
        if (nome === "vias-estaduais") dados.viasEstaduais = geojson.features || [];
        if (nome === "ambiente") dados.ambiente = geojson.features || [];
      } catch (erro) {
        console.warn(`[app] base espacial não carregada: ${nome}`, erro);
      }
    })
  );

  const conteudo = document.getElementById("conteudo");
  await iniciarRoteador(conteudo);
  if (carregando) carregando.hidden = true;
  registrarServiceWorker();
}

iniciar().catch((erro) => {
  console.error("[app] falha na inicialização:", erro);
  const carregando = document.getElementById("carregando-inicial");
  if (carregando) {
    carregando.querySelector("p").textContent = "Erro ao iniciar a plataforma. Recarregue a página.";
  }
});

export { ROTAS, analisarHash };
