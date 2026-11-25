/**
 * Autenticacao e autorizacao.
 *
 * IMPORTANTE (ver README -> "Autenticacao"): este modulo controla apenas a
 * EXPERIENCIA do usuario (quais acoes aparecem no interface). A seguranca real
 * acontece no backend de producao (FastAPI + ArcGIS Enterprise OAuth 2.0),
 * que valida token, perfil e trilha de auditoria no servidor. Nunca use o
 * frontend como unico mecanismo de controle de acesso.
 */
import { config } from "./config.js";
import { store } from "./services/state.js";

const CHAVE_SESSAO = "central-infra-ro:usuario";
const CHAVE_PKCE = "central-infra-ro:pkce";

/** Permissoes por perfil — espelham as regras do backend. */
export const PERMISSOES = {
  cidadao: ["consulta", "exportar_publico"],
  gestor: ["consulta", "exportar_publico", "indicadores", "comparar"],
  analista: ["consulta", "exportar_publico", "exportar_interno", "camadas", "consulta_espacial"],
  fiscal: ["consulta", "exportar_publico", "vistoriar", "registrar_evidencia"],
  contratos: ["consulta", "exportar_publico", "gestionar_contratos", "exportar_interno"],
  admin: [
    "consulta",
    "exportar_publico",
    "exportar_interno",
    "camadas",
    "consulta_espacial",
    "vistoriar",
    "registrar_evidencia",
    "gestionar_contratos",
    "indicadores",
    "comparar",
    "gerenciar_usuarios",
    "auditoria",
  ],
};

function codigoBase64Url(bytes) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(texto) {
  const dados = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return new Uint8Array(digest);
}

/** Prepara o fluxo OAuth 2.0 Authorization Code + PKCE contra o portal ArcGIS. */
export async function prepararLogin(redirecionApos = window.location.href) {
  if (!config.portalId || !config.clientId) {
    return {
      pronto: false,
      motivo:
        "OAuth 2.0 nao configurado: defina VITE_ARCGIS_PORTAL_ID e VITE_ARCGIS_CLIENT_ID no ambiente de publicacao.",
    };
  }
  const verifier = codigoBase64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = codigoBase64Url(await sha256(verifier));
  const estado = codigoBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(CHAVE_PKCE, JSON.stringify({ verifier, estado, redirecionApos }));

  const url = new URL(`https://${config.portalId}.arcgis.com/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${window.location.origin}${window.location.pathname}`);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", estado);
  url.searchParams.set("expiration", "1440");
  url.searchParams.set("scope", "openid profile email");
  window.location.assign(url.toString());
  return { pronto: true };
}

/** Conclui o login com o codigo autorizado e troca o token no backend. */
export async function concluirLogin() {
  const parametros = new URLSearchParams(window.location.search);
  const codigo = parametros.get("code");
  const estado = parametros.get("state");
  if (!codigo) return null;

  const guardado = sessionStorage.getItem(CHAVE_PKCE);
  sessionStorage.removeItem(CHAVE_PKCE);
  if (!guardado) return null;
  const { verifier, estado: esperado } = JSON.parse(guardado);
  if (estado !== esperado) {
    throw new Error("Estado OAuth invalido: a sessao foi descartada por seguranca.");
  }
  if (!config.apiBaseUrl) {
    throw new Error(
      "Troca de token indisponivel: configure VITE_API_BASE_URL com o backend que realiza a troca (client_secret nunca vai para o frontend)."
    );
  }
  const resposta = await fetch(`${config.apiBaseUrl}/api/auth/arcgis/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codigo, code_verifier: verifier, redirect_uri: `${window.location.origin}${window.location.pathname}` }),
  });
  if (!resposta.ok) throw new Error("Falha na troca de token de autenticacao.");
  const payload = await resposta.json();
  definirSessao(payload);
  window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  return payload;
}

/** Define a sessao local (somente exibicao; a validacao real e no backend). */
export function definirSessao(usuario) {
  const sessao = {
    id: usuario?.id || usuario?.nome || "anonimo",
    nome: usuario?.nome || "Visitante",
    perfil: usuario?.perfil || "cidadao",
    email: usuario?.email || null,
    organizacao: usuario?.organizacao || null,
    emitidoEm: new Date().toISOString(),
  };
  sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  store.definir({ usuario: sessao, permissoes: PERMISSOES[sessao.perfil] || PERMISSOES.cidadao });
  return sessao;
}

/** Le a sessao guardada (apenas apresentacional). */
export function lerSessao() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return null;
    const sessao = JSON.parse(bruto);
    store.definir({ usuario: sessao, permissoes: PERMISSOES[sessao.perfil] || PERMISSOES.cidadao });
    return sessao;
  } catch {
    return null;
  }
}

export function encerrarSessao() {
  sessionStorage.removeItem(CHAVE_SESSAO);
  store.definir({ usuario: null, permissoes: PERMISSOES.cidadao });
}

export function perfilAtual() {
  return store.obter("usuario")?.perfil || "cidadao";
}

export function pode(permissao) {
  const permissoes = store.obter("permissoes") || [];
  return permissoes.includes(permissao);
}

/** Exibe o painel de area restrita. */
export function abrirAreaRestrita() {
  const sessao = store.obter("usuario");
  const corpo = document.createElement("div");
  corpo.className = "area-restrita";
  if (sessao) {
    corpo.innerHTML = `
      <p class="area-restrita__usuario"><strong>${sessao.nome}</strong> — perfil ${sessao.perfil}</p>
      <p class="area-restrita__texto">Sessao ativa neste dispositivo. As permissoes reais sao verificadas no backend a cada operacao.</p>
    `;
  } else {
    corpo.innerHTML = `
      <p class="area-restrita__texto">
        O acesso restrito usa autenticacao ArcGIS Enterprise OAuth 2.0 (Authorization Code + PKCE) ou
        provedor corporativo autorizado. Em modo demonstracao, escolha um perfil para navegar a
        interface com as restricoes de cada perfil.
      </p>
      <div class="area-restrita__perfis" id="area-restrita-perfis"></div>
    `;
  }
  import("./components/ui.js").then(({ abrirModal }) => {
    const modal = abrirModal({
      titulo: "Área restrita",
      subtitulo: "Perfis de acesso da Central INFRA RO 360",
      conteudo: corpo,
      largura: "620px",
      acoes: [
        {
          rotulo: sessao ? "Encerrar sessão" : "Fechar",
          classe: sessao ? "botao--perigo" : "botao--secundario",
          aoClicar: () => {
            if (sessao) encerrarSessao();
            modal.fechar();
          },
        },
        {
          rotulo: "Entrar com ArcGIS",
          classe: "botao--primario",
          aoClicar: async () => {
            const resultado = await prepararLogin();
            if (!resultado.pronto) {
              import("./components/ui.js").then(({ toast }) =>
                toast(resultado.motivo, "erro", 8000)
              );
            }
          },
        },
      ],
    });
    const caixa = corpo.querySelector("#area-restrita-perfis");
    if (caixa) {
      import("./config.js").then(({ config: cfg }) => {
        cfg.perfis.forEach((perfil) => {
          const botao = document.createElement("button");
          botao.className = "botao botao--secundario botao--perfil";
          botao.type = "button";
          botao.innerHTML = `<strong>${perfil.nome}</strong><span>${perfil.descricao}</span>`;
          botao.addEventListener("click", () => {
            definirSessao({ nome: `Usuario ${perfil.nome}`, perfil: perfil.id });
            modal.fechar();
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          });
          caixa.append(botao);
        });
      });
    }
  });
}
