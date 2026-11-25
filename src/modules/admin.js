/**
 * APP 17 — Administracao.
 *
 * Perfis de acesso (config.perfis) com as permissoes reais (PERMISSOES em
 * src/auth.js), trilha de auditoria local (localStorage) e formulario de
 * usuario apenas visual.
 *
 * IMPORTANTE: o controle real de acesso e a gravacao oficial da trilha de
 * auditoria pertencem ao backend (ArcGIS Enterprise + FastAPI). O frontend
 * apenas apresenta e registra localmente.
 */
import { el, limpar } from "../utils/dom.js";
import { config } from "../config.js";
import { store } from "../services/state.js";
import { cartaoIndicador, listaDados } from "../components/cards.js";
import { criarTabela } from "../components/tables.js";
import { etiquetaStatus, blocoAviso, toast, abrirModal } from "../components/ui.js";
import { numero, data as formatarData } from "../utils/format.js";
import { PERMISSOES, abrirAreaRestrita } from "../auth.js";
import { lerAuditoria, registrarAuditoria, limparAuditoria } from "./_auditoria.js";

/** Rotulos amigaveis para as permissoes do backend. */
const ROTULOS_PERMISSAO = {
  consulta: "Consultar dados",
  exportar_publico: "Exportar dados públicos",
  exportar_interno: "Exportar dados internos",
  indicadores: "Ver indicadores consolidados",
  comparar: "Comparar períodos e recortes",
  camadas: "Gerenciar camadas do geoportal",
  consulta_espacial: "Executar consultas espaciais",
  vistoriar: "Registrar vistorias",
  registrar_evidencia: "Registrar evidências",
  gestionar_contratos: "Gerenciar contratos",
  gerenciar_usuarios: "Gerenciar usuários",
  auditoria: "Consultar trilha de auditoria",
};

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Administração" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Perfis de acesso e as permissões que cada um carrega, trilha de auditoria das ações realizadas " +
            "neste dispositivo e formulário de usuário. A gravação oficial de usuários e da trilha de auditoria " +
            "exige o backend ArcGIS Enterprise do Estado.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        el("span", { className: "etiqueta etiqueta--neutra", text: "Apresentação" }),
      ]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    blocoAviso(
      "Controle de acesso real fica no backend",
      "As permissões exibidas aqui espelham as regras do servidor. Selecionar um perfil no frontend apenas muda " +
        "a interface: o backend valida token, perfil e operação a cada requisição.",
      "alerta"
    )
  );

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaPerfis = el("div", { className: "painel" });
  const areaCartoes = el("div", { className: "grade grade--3" });
  const areaUsuario = el("div", { className: "painel" });
  const areaAuditoria = el("div", { className: "painel" });
  pagina.append(areaKpis, areaPerfis, areaCartoes, areaUsuario, areaAuditoria);

  /* -------------------------------------------------------------- perfis */

  function renderPerfis() {
    limpar(areaPerfis);
    areaPerfis.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Perfis de acesso" }),
          el("p", {
            className: "painel__descricao",
            text: "Cada perfil reúne as permissões verificadas pelo backend em cada operação.",
          }),
        ]),
        etiquetaStatus("REAL", "Regras do servidor"),
      ])
    );
    const corpo = el("div");
    areaPerfis.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "nome", rotulo: "Perfil" },
        { chave: "id", rotulo: "Identificador" },
        { chave: "descricao", rotulo: "Descrição" },
        { chave: "permissoes", rotulo: "Permissões" },
        { chave: "quantidade", rotulo: "Nº de permissões", alinhamento: "direita" },
      ],
      linhas: config.perfis.map((perfil) => ({
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao,
        permissoes: (PERMISSOES[perfil.id] || []).map((p) => ROTULOS_PERMISSAO[p] || p).join(", "),
        quantidade: (PERMISSOES[perfil.id] || []).length,
      })),
      nomeExportacao: "perfis-de-acesso",
      porPagina: 10,
    });
  }

  function renderCartoesPerfis() {
    limpar(areaCartoes);
    const usuario = store.obter("usuario");
    config.perfis.forEach((perfil) => {
      const permissoes = PERMISSOES[perfil.id] || [];
      const ativo = usuario?.perfil === perfil.id;
      areaCartoes.append(
        el("article", { className: `cartao ${ativo ? "cartao--positivo" : "cartao--kpi"}` }, [
          el("header", { className: "cartao__cabecalho" }, [
            el("h3", { className: "cartao__titulo", text: perfil.nome }),
            ativo ? el("span", { className: "etiqueta etiqueta--real", text: "Perfil ativo" }) : null,
          ]),
          el("p", { className: "cartao__detalhe", text: perfil.descricao }),
          listaDados(
            permissoes.map((p) => ({ rotulo: ROTULOS_PERMISSAO[p] || p, valor: "Permitido" })),
            { colunas: 1 }
          ),
          el("button", {
            className: "botao botao--secundario botao--compacto",
            type: "button",
            text: ativo ? "Trocar de perfil" : "Usar este perfil",
            onclick: () => {
              registrarAuditoria({
                acao: "Seleção de perfil",
                detalhe: `${perfil.nome} (${perfil.id})`,
              });
              abrirAreaRestrita();
              render();
            },
          }),
        ])
      );
    });
  }

  /* ------------------------------------------------------------- usuario */

  function renderUsuario() {
    const usuario = store.obter("usuario");
    limpar(areaUsuario);
    areaUsuario.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Cadastro de usuário (formulário visual)" }),
          el("p", {
            className: "painel__descricao",
            text:
              "O formulário simula a criação de um usuário e registra a ação na trilha local. A gravação real " +
              "exige o backend ArcGIS Enterprise (não há persistência no navegador).",
          }),
        ]),
        etiquetaStatus("SIMULADO", "Sem persistência"),
      ])
    );

    const campoNome = el("input", { type: "text", className: "campo", id: "usuario-nome", placeholder: "Nome completo" });
    const campoEmail = el("input", { type: "email", className: "campo", id: "usuario-email", placeholder: "email@exemplo.gov.br" });
    const campoOrganizacao = el("input", {
      type: "text",
      className: "campo",
      id: "usuario-organizacao",
      placeholder: "Órgão / unidade",
    });
    const campoPerfil = el("select", { className: "campo", id: "usuario-perfil" });
    config.perfis.forEach((perfil) => campoPerfil.append(el("option", { value: perfil.id, text: perfil.nome })));

    const aviso = el("div");

    const botao = el("button", {
      className: "botao botao--primario",
      type: "button",
      text: "Registrar usuário",
      onclick: () => {
        const nome = campoNome.value.trim();
        if (!nome) {
          toast("Informe o nome do usuário.", "erro");
          return;
        }
        const email = campoEmail.value.trim();
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          toast("E-mail inválido.", "erro");
          return;
        }
        const organizacao = campoOrganizacao.value.trim();
        registrarAuditoria({
          acao: "Criação de usuário (simulada)",
          detalhe:
            `${nome} · ${campoPerfil.options[campoPerfil.selectedIndex].text}` +
            `${email ? ` · ${email}` : ""}${organizacao ? ` · ${organizacao}` : ""}`,
          alvo: nome,
        });
        limpar(aviso);
        aviso.append(
          blocoAviso(
            "A gravação real exige o backend ArcGIS Enterprise",
            "O registro do usuário foi apenas anotado na trilha de auditoria local deste dispositivo. " +
              "Para persistir o usuário de verdade, configure VITE_API_BASE_URL e o serviço de identidade do " +
              "ArcGIS Enterprise (OAuth 2.0 / ArcGIS Online for Organizations).",
            "perigo"
          )
        );
        campoNome.value = "";
        campoEmail.value = "";
        campoOrganizacao.value = "";
        renderAuditoria();
        renderKpis();
      },
    });

    areaUsuario.append(
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "usuario-nome", text: "Nome" }),
        campoNome,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "usuario-email", text: "E-mail" }),
        campoEmail,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "usuario-organizacao", text: "Órgão / unidade" }),
        campoOrganizacao,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "usuario-perfil", text: "Perfil de acesso" }),
        campoPerfil,
      ]),
      botao,
      aviso
    );

    if (usuario) {
      areaUsuario.append(
        listaDados(
          [
            { rotulo: "Sessão ativa neste dispositivo", valor: usuario.nome },
            { rotulo: "Perfil", valor: usuario.perfil },
            { rotulo: "E-mail", valor: usuario.email || "—" },
            { rotulo: "Emitido em", valor: formatarData(usuario.emitidoEm?.slice(0, 10)) },
          ],
          { colunas: 2 }
        )
      );
    }
  }

  /* ----------------------------------------------------------- auditoria */

  function renderAuditoria() {
    const registros = lerAuditoria();
    limpar(areaAuditoria);
    areaAuditoria.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Trilha de auditoria local" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Ações registradas neste dispositivo (usuário, perfil, data, ação e detalhe). A trilha oficial, " +
              "com carimbo do servidor, fica no backend.",
          }),
        ]),
        el("div", { className: "pagina__acoes" }, [
          el("button", {
            className: "botao botao--perigo botao--compacto",
            type: "button",
            text: "Limpar trilha local",
            disabled: !registros.length,
            onclick: confirmarLimpeza,
          }),
        ]),
      ])
    );
    if (!registros.length) {
      areaAuditoria.append(
        el("p", {
          className: "painel__descricao",
          text: "Nenhum registro na trilha local. As ações realizadas neste dispositivo passam a aparecer aqui.",
        })
      );
      return;
    }
    const corpo = el("div");
    areaAuditoria.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "data", rotulo: "Data e hora" },
        { chave: "usuario", rotulo: "Usuário" },
        { chave: "perfil", rotulo: "Perfil" },
        { chave: "acao", rotulo: "Ação" },
        { chave: "detalhe", rotulo: "Detalhe" },
      ],
      linhas: registros.map((registro) => ({
        ...registro,
        data: new Date(registro.data).toLocaleString("pt-BR"),
      })),
      nomeExportacao: "trilha-auditoria-local",
      porPagina: 20,
    });
  }

  function confirmarLimpeza() {
    const total = lerAuditoria().length;
    let modal = null;
    modal = abrirModal({
      titulo: "Limpar a trilha de auditoria local",
      subtitulo: `${total} registro(s) serão apagados deste dispositivo`,
      conteudo:
        "<p>Esta ação remove definitivamente os registros guardados no localStorage deste navegador. " +
        "A trilha oficial do servidor não é afetada — e só existe quando o backend ArcGIS Enterprise está " +
        "configurado.</p>",
      largura: "560px",
      acoes: [
        { rotulo: "Cancelar", classe: "botao--secundario", aoClicar: () => modal.fechar() },
        {
          rotulo: "Limpar trilha",
          classe: "botao--perigo",
          aoClicar: () => {
            limparAuditoria();
            registrarAuditoria({
              acao: "Limpeza da trilha de auditoria",
              detalhe: `${total} registro(s) removidos do armazenamento local`,
            });
            modal.fechar();
            renderAuditoria();
            renderKpis();
            toast("Trilha de auditoria local limpa.", "sucesso");
          },
        },
      ],
    });
    return modal;
  }

  /* ---------------------------------------------------------------- KPIs */

  function renderKpis() {
    const registros = lerAuditoria();
    const usuario = store.obter("usuario");
    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Perfis de acesso",
        valor: numero(config.perfis.length),
        detalhe: `${numero(Object.keys(PERMISSOES).length)} conjuntos de permissões mapeados`,
        icone: "🔐",
        rodape: "Permissões espelham as regras do backend",
      }),
      cartaoIndicador({
        titulo: "Permissões por perfil",
        valor: numero(Math.max(...config.perfis.map((p) => (PERMISSOES[p.id] || []).length))),
        detalhe: "Maior conjunto do catálogo (administrador)",
        icone: "🗝️",
      }),
      cartaoIndicador({
        titulo: "Registros na trilha local",
        valor: numero(registros.length),
        detalhe: "Ações registradas neste dispositivo",
        icone: "🧾",
        tom: registros.length ? "alerta" : "padrao",
      }),
      cartaoIndicador({
        titulo: "Sessão ativa",
        valor: usuario ? usuario.nome : "Visitante",
        detalhe: usuario ? `Perfil ${usuario.perfil}` : "Nenhum usuário autenticado",
        icone: "👤",
        tom: usuario ? "positivo" : "alerta",
      })
    );
  }

  /* --------------------------------------------------------------- render */

  renderKpis();
  renderPerfis();
  renderCartoesPerfis();
  renderUsuario();
  renderAuditoria();

  container.append(pagina);

  return {
    destruir() {
      limpar(areaCartoes);
    },
  };
}
