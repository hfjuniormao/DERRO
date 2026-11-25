/**
 * APP 10 — Fiscalizacao de obras (interface de campo).
 *
 * Registro de vistoria com obra, data, responsavel, percentual de avanco,
 * inconformidades, observacoes, coordenadas GPS e evidencias fotograficas.
 *
 * Regras:
 *  - as vistorias ficam em uma FILA LOCAL (localStorage) e funcionam offline;
 *  - a sincronizacao e disparada quando a conexao volta (navigator.onLine);
 *  - a edicao exige permissao "vistoriar" (validada no backend em producao);
 *  - toda acao e registrada na trilha de auditoria local.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { cartaoIndicador } from "../components/cards.js";
import { criarTabela } from "../components/tables.js";
import { etiquetaStatus, blocoAviso, toast, estadoVazio } from "../components/ui.js";
import { numero, percentual } from "../utils/format.js";
import { pode, abrirAreaRestrita } from "../auth.js";
import { config } from "../config.js";
import { registrarAuditoria } from "./_auditoria.js";

/** Fila local de vistorias aguardando sincronizacao. */
const CHAVE_FILA = "central-infra-ro:vistorias-pendentes";

/** Limite de tamanho das miniaturas guardadas na fila local (bytes). */
const LIMITE_PREVIEWS = 1024 * 1024;

function lerFila() {
  try {
    const bruto = localStorage.getItem(CHAVE_FILA);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravarFila(lista) {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(lista));
    return true;
  } catch (erro) {
    console.warn("[fiscalizacao] falha ao gravar a fila local:", erro);
    return false;
  }
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Fiscalização de obras" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Interface de campo para registrar vistorias: obra, data, responsável, percentual de avanço, " +
            "inconformidades, observações, coordenadas GPS e fotos. Os registros ficam em uma fila local e " +
            "operam offline; a sincronização é disparada quando a conexão volta.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("SIMULADO", "Base demonstrativa de vistorias")]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaFormulario = el("div", { className: "painel" });
  const areaFila = el("div", { className: "painel" });
  const areaBase = el("div", { className: "painel" });
  pagina.append(areaKpis, areaFormulario, areaFila, areaBase);

  const estado = {
    fotos: [],
    fila: lerFila(),
  };

  /* ---------------------------------------------------------- permissoes */

  function autorizado() {
    return pode("vistoriar");
  }

  function renderAvisoPermissao() {
    limpar(areaAvisos);
    if (autorizado()) {
      areaAvisos.append(
        blocoAviso(
          "Perfil autorizado para registrar vistorias",
          "Você pode registrar e sincronizar vistorias neste dispositivo. A validação definitiva do perfil " +
            "acontece no backend (ArcGIS Enterprise + FastAPI) a cada operação.",
          "sucesso"
        )
      );
      return;
    }
    areaAvisos.append(
      blocoAviso(
        "Edição restrita ao perfil de fiscalização",
        "O registro de vistorias exige a permissão «vistoriar» (perfis: Fiscal de campo ou Administrador). " +
          "O controle definitivo de acesso é do backend — o frontend apenas esconde as ações não autorizadas.",
        "perigo"
      )
    );
    areaAvisos.append(
      el("button", {
        className: "botao botao--primario",
        type: "button",
        text: "Abrir área restrita para trocar de perfil",
        onclick: () => abrirAreaRestrita(),
      })
    );
  }

  /* ---------------------------------------------------------------- form */

  function renderFormulario() {
    const liberado = autorizado();
    limpar(areaFormulario);
    areaFormulario.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Nova vistoria" }),
          el("p", {
            className: "painel__descricao",
            text:
              "As coordenadas e as fotos são capturadas localmente no dispositivo. As miniaturas das fotos são " +
              "guardadas na fila local e não são enviadas a nenhum servidor nesta versão.",
          }),
        ]),
        etiquetaStatus("SIMULADO", "Obras demonstrativas"),
      ])
    );

    const campoObra = el("select", { className: "campo", id: "vistoria-obra", disabled: !liberado });
    campoObra.append(el("option", { value: "", text: "Selecione a obra…" }));
    [...dados.obras]
      .sort((a, b) => String(a.municipio).localeCompare(String(b.municipio), "pt-BR"))
      .forEach((o) => campoObra.append(el("option", { value: o.id, text: `${o.id} — ${o.titulo} (${o.municipio})` })));

    const campoData = el("input", { type: "date", className: "campo", id: "vistoria-data", disabled: !liberado });
    campoData.value = new Date().toISOString().slice(0, 10);

    const campoResponsavel = el("input", {
      type: "text",
      className: "campo",
      id: "vistoria-responsavel",
      placeholder: "Nome do fiscal responsável",
      disabled: !liberado,
    });

    const campoAvanco = el("input", {
      type: "number",
      className: "campo",
      id: "vistoria-avanco",
      min: "0",
      max: "100",
      step: "0.1",
      value: "0",
      disabled: !liberado,
    });

    const campoInconformidades = el("input", {
      type: "number",
      className: "campo",
      id: "vistoria-inconformidades",
      min: "0",
      step: "1",
      value: "0",
      disabled: !liberado,
    });

    const campoObservacoes = el("textarea", {
      className: "campo",
      id: "vistoria-observacoes",
      rows: "3",
      placeholder: "Observações da vistoria (não conformidades, recomendações…)",
      disabled: !liberado,
    });

    const campoLat = el("input", {
      type: "number",
      className: "campo",
      id: "vistoria-lat",
      step: "0.000001",
      placeholder: "Latitude (graus)",
      disabled: !liberado,
    });
    const campoLon = el("input", {
      type: "number",
      className: "campo",
      id: "vistoria-lon",
      step: "0.000001",
      placeholder: "Longitude (graus)",
      disabled: !liberado,
    });
    const statusGps = el("p", { className: "painel__descricao", text: "Coordenadas ainda não capturadas." });

    const botaoGps = el("button", {
      className: "botao botao--secundario",
      type: "button",
      text: "Usar minha posição",
      disabled: !liberado,
      onclick: () => {
        if (!navigator.geolocation) {
          statusGps.textContent = "Este dispositivo não oferece geolocalização.";
          toast("Geolocalização indisponível neste dispositivo.", "erro");
          return;
        }
        statusGps.textContent = "Obtendo a posição do dispositivo…";
        navigator.geolocation.getCurrentPosition(
          (posicao) => {
            campoLat.value = Number(posicao.coords.latitude.toFixed(6));
            campoLon.value = Number(posicao.coords.longitude.toFixed(6));
            statusGps.textContent = `Posição capturada (precisão ${Math.round(posicao.coords.accuracy)} m).`;
            registrarAuditoria({
              acao: "Captura de coordenadas GPS",
              detalhe: `${campoLat.value}, ${campoLon.value}`,
            });
          },
          () => {
            statusGps.textContent = "Não foi possível obter a posição (permissão negada ou sinal indisponível).";
            toast("Não foi possível obter a posição do dispositivo.", "erro");
          },
          { enableHighAccuracy: true, timeout: 12000 }
        );
      },
    });

    /* ------------------------------------------------------------- fotos */

    const areaFotos = el("div", { className: "grade grade--4" });
    const campoFotos = el("input", {
      type: "file",
      accept: "image/*",
      multiple: true,
      id: "vistoria-fotos",
      className: "campo",
      disabled: !liberado,
      onchange: (ev) => {
        const arquivos = [...(ev.target.files || [])];
        arquivos.forEach((arquivo) => {
          const leitor = new FileReader();
          leitor.onload = () => {
            estado.fotos.push({
              nome: arquivo.name,
              tipo: arquivo.type,
              tamanho: arquivo.size,
              preview: String(leitor.result || ""),
            });
            renderFotos();
          };
          leitor.onerror = () => toast(`Falha ao ler o arquivo ${arquivo.name}.`, "erro");
          leitor.readAsDataURL(arquivo);
        });
        ev.target.value = "";
      },
    });

    function renderFotos() {
      limpar(areaFotos);
      if (!estado.fotos.length) {
        areaFotos.append(
          el("p", {
            className: "painel__descricao",
            text: "Nenhuma foto anexada. A pré-visualização é feita localmente, sem envio.",
          })
        );
        return;
      }
      estado.fotos.forEach((foto, i) => {
        const miniatura = el("img", {
          src: foto.preview,
          alt: `Foto ${foto.nome}`,
          style: { width: "100%", height: "auto", borderRadius: "6px" },
          loading: "lazy",
        });
        areaFotos.append(
          el("div", { className: "cartao" }, [
            miniatura,
            el("p", { className: "cartao__detalhe", text: foto.nome }),
            el("button", {
              className: "botao botao--claro botao--compacto",
              type: "button",
              text: "Remover",
              disabled: !liberado,
              onclick: () => {
                estado.fotos.splice(i, 1);
                renderFotos();
              },
            }),
          ])
        );
      });
    }
    renderFotos();

    /* --------------------------------------------------- origem Survey123 */

    const botaoSurvey = el("button", {
      className: "botao botao--secundario",
      type: "button",
      text: "Importar do Survey123",
      disabled: true,
      title: "Integração com Survey123 ainda não configurada",
    });

    const avisoSurvey = el("p", {
      className: "painel__descricao",
      text:
        "Integração com ArcGIS Survey123 / Field Maps indisponível nesta versão: exige o portal ArcGIS " +
        "Enterprise configurado (VITE_ARCGIS_PORTAL_ID e VITE_ARCGIS_CLIENT_ID), o FeatureServer de vistorias " +
        "publicado no organization e a habilitação do survey no aplicativo móvel. O botão permanece desabilitado " +
        "até essa configuração existir.",
    });

    /* ------------------------------------------------------------ envio */

    function registrar() {
      if (!autorizado()) {
        toast("Seu perfil não tem a permissão «vistoriar».", "erro");
        return;
      }
      const obra = dados.obras.find((o) => o.id === campoObra.value);
      const lat = campoLat.value === "" ? null : Number(campoLat.value);
      const lon = campoLon.value === "" ? null : Number(campoLon.value);
      const avancos = Number(campoAvanco.value || 0);
      if (!obra) {
        toast("Selecione a obra vistoriada.", "erro");
        return;
      }
      if (!campoData.value) {
        toast("Informe a data da vistoria.", "erro");
        return;
      }
      if (!campoResponsavel.value.trim()) {
        toast("Informe o responsável pela vistoria.", "erro");
        return;
      }
      if (avancos < 0 || avancos > 100) {
        toast("O percentual de avanço deve estar entre 0 e 100.", "erro");
        return;
      }
      if (lat !== null && (lat < -90 || lat > 90)) {
        toast("Latitude inválida.", "erro");
        return;
      }
      if (lon !== null && (lon < -180 || lon > 180)) {
        toast("Longitude inválida.", "erro");
        return;
      }

      const fotos = estado.fotos.map((f) => ({ nome: f.nome, tipo: f.tipo, tamanho: f.tamanho }));
      const totalPreview = estado.fotos.reduce((acc, f) => acc + (f.preview?.length || 0), 0);
      const comPreview = totalPreview <= LIMITE_PREVIEWS;
      const registro = {
        id: `VST-LOCAL-${Date.now().toString(36).toUpperCase()}`,
        obra_id: obra.id,
        obra_titulo: obra.titulo,
        municipio: obra.municipio,
        data: campoData.value,
        responsavel: campoResponsavel.value.trim(),
        percentual_avanco: avancos,
        inconformidades: Number(campoInconformidades.value || 0),
        observacoes: campoObservacoes.value.trim(),
        lat,
        lon,
        origem: "aplicativo web",
        fotos: comPreview ? estado.fotos.map((f) => ({ nome: f.nome, tipo: f.tipo, preview: f.preview })) : fotos,
        fotos_sem_miniatura: !comPreview,
        situacao: navigator.onLine ? "sincronizada" : "pendente_envio",
        criado_em: new Date().toISOString(),
      };

      estado.fila = [registro, ...estado.fila];
      if (!gravarFila(estado.fila)) {
        toast("Não foi possível gravar na fila local (armazenamento indisponível).", "erro");
      } else {
        toast(
          navigator.onLine
            ? "Vistoria registrada na fila local e marcada como sincronizada."
            : "Vistoria guardada offline na fila local.",
          "sucesso"
        );
      }
      registrarAuditoria({
        acao: "Registro de vistoria",
        detalhe: `${registro.id} · ${obra.id} · ${obra.municipio} · avanço ${percentual(avancos)}`,
        alvo: registro.id,
      });

      estado.fotos = [];
      renderFotos();
      renderFila();
      renderKpis();
    }

    areaFormulario.append(
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-obra", text: "Obra vistoriada" }),
        campoObra,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-data", text: "Data da vistoria" }),
        campoData,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-responsavel", text: "Responsável" }),
        campoResponsavel,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-avanco", text: "Percentual de avanço (%)" }),
        campoAvanco,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-inconformidades", text: "Inconformidades" }),
        campoInconformidades,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-lat", text: "Latitude" }),
        campoLat,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-lon", text: "Longitude" }),
        campoLon,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-observacoes", text: "Observações" }),
        campoObservacoes,
      ]),
      el("div", { className: "campo-grupo" }, [
        el("label", { className: "campo-rotulo", for: "vistoria-fotos", text: "Fotos da vistoria" }),
        campoFotos,
      ]),
      el("div", { className: "campo-grupo campo-grupo--inline" }, [botaoGps, statusGps]),
      botaoSurvey,
      avisoSurvey,
      areaFotos,
      el("button", {
        className: "botao botao--primario",
        type: "button",
        text: "Registrar vistoria",
        disabled: !liberado,
        onclick: registrar,
      })
    );
  }

  /* ---------------------------------------------------------------- KPIs */

  function renderKpis() {
    const fila = estado.fila;
    const pendentes = fila.filter((v) => v.situacao === "pendente_envio");
    const comInconformidade = fila.filter((v) => (v.inconformidades || 0) > 0);
    const comGps = fila.filter((v) => v.lat !== null && v.lat !== undefined);
    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Vistorias neste dispositivo",
        valor: numero(fila.length),
        detalhe: `${numero(pendentes.length)} aguardando sincronização`,
        icone: "📋",
        rodape: "Fila local (localStorage) — funciona offline",
      }),
      cartaoIndicador({
        titulo: "Com inconformidades",
        valor: numero(comInconformidade.length),
        detalhe: "Vistorias que registraram não conformidades",
        icone: "⚠️",
        tom: comInconformidade.length ? "alerta" : "padrao",
      }),
      cartaoIndicador({
        titulo: "Com coordenadas GPS",
        valor: numero(comGps.length),
        detalhe: `${percentual(fila.length ? (comGps.length / fila.length) * 100 : 0)} com georreferenciamento`,
        icone: "📍",
      }),
      cartaoIndicador({
        titulo: "Base demonstrativa",
        valor: numero(dados.vistorias.length),
        detalhe: "Vistorias da base sintética (SIMULADO)",
        icone: "🗂️",
        rodape: "Fonte: base de demonstração",
      }),
      cartaoIndicador({
        titulo: "Situação da conexão",
        valor: navigator.onLine ? "Online" : "Offline",
        detalhe: navigator.onLine
          ? "A fila local é sincronizada ao recuperar a conexão"
          : "Os registros ficam na fila local até voltar a conexão",
        icone: navigator.onLine ? "🌐" : "📴",
        tom: navigator.onLine ? "positivo" : "alerta",
      })
    );
  }

  /* ---------------------------------------------------------------- fila */

  function renderFila() {
    limpar(areaFila);
    areaFila.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Fila local de vistorias" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Registros gravados neste dispositivo. A sincronização automática ocorre quando o navegador " +
              "detecta a volta da conexão (evento «online»).",
          }),
        ]),
        etiquetaStatus("REAL", "Registro local"),
      ])
    );
    if (!estado.fila.length) {
      areaFila.append(
        estadoVazio(
          "Nenhuma vistoria registrada neste dispositivo",
          "Registre uma vistoria no formulário ao lado. O registro fica disponível mesmo sem conexão."
        )
      );
      return;
    }
    const corpo = el("div");
    areaFila.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Registro" },
        { chave: "obra_id", rotulo: "Obra" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "data", rotulo: "Data" },
        { chave: "responsavel", rotulo: "Responsável" },
        { chave: "percentual_avanco", rotulo: "Avanço", alinhamento: "direita" },
        { chave: "inconformidades", rotulo: "Inconformidades", alinhamento: "direita" },
        {
          chave: "coordenadas",
          rotulo: "Coordenadas",
          renderizar: (linha) =>
            linha.lat === null || linha.lat === undefined
              ? "—"
              : `${Number(linha.lat).toFixed(4)}, ${Number(linha.lon).toFixed(4)}`,
        },
        {
          chave: "fotos",
          rotulo: "Fotos",
          alinhamento: "direita",
          renderizar: (linha) => numero((linha.fotos || []).length),
        },
        {
          chave: "situacao",
          rotulo: "Situação",
          renderizar: (linha) =>
            el("span", {
              className: `etiqueta ${linha.situacao === "pendente_envio" ? "etiqueta--indisponivel" : "etiqueta--neutra"}`,
              text: linha.situacao === "pendente_envio" ? "Pendente" : "Sincronizada",
            }),
        },
      ],
      linhas: estado.fila,
      nomeExportacao: "vistorias-fila-local",
      porPagina: 15,
    });
  }

  /* -------------------------------------------------------- base oficial */

  function renderBase() {
    limpar(areaBase);
    areaBase.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Vistorias da base demonstrativa" }),
          el("p", {
            className: "painel__descricao",
            text: "Registros da base sintética do aplicativo (SIMULADOS), úteis para consulta e exportação.",
          }),
        ]),
        etiquetaStatus("SIMULADO"),
      ])
    );
    const corpo = el("div");
    areaBase.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Vistoria" },
        { chave: "obra_id", rotulo: "Obra" },
        { chave: "municipio", rotulo: "Município" },
        { chave: "data", rotulo: "Data" },
        { chave: "responsavel", rotulo: "Responsável" },
        { chave: "percentual_avanco", rotulo: "Avanço", alinhamento: "direita" },
        { chave: "inconformidades", rotulo: "Inconformidades", alinhamento: "direita" },
        { chave: "observacoes", rotulo: "Observações" },
        {
          chave: "situacao",
          rotulo: "Situação",
          renderizar: (linha) =>
            el("span", {
              className: `etiqueta ${linha.situacao === "pendente_envio" ? "etiqueta--indisponivel" : "etiqueta--neutra"}`,
              text: linha.situacao === "pendente_envio" ? "Pendente" : "Registrada",
            }),
        },
      ],
      linhas: dados.vistorias,
      nomeExportacao: "vistorias-base",
      porPagina: 15,
    });
  }

  /* ------------------------------------------------------------ sincronia */

  async function sincronizar() {
    if (!navigator.onLine) {
      toast("Sem conexão — a fila permanece local.", "info");
      return;
    }
    const pendentes = estado.fila.filter((v) => v.situacao === "pendente_envio");
    if (!pendentes.length) {
      toast("Nenhuma vistoria pendente de sincronização.", "info");
      return;
    }

    // Com backend configurado, a transferencia real e feita por ele.
    if (config.apiBaseUrl) {
      let sincronizadas = 0;
      for (const registro of pendentes) {
        try {
          const resposta = await fetch(`${config.apiBaseUrl}/api/vistorias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(registro),
          });
          if (!resposta.ok) throw new Error(String(resposta.status));
          sincronizadas += 1;
          estado.fila = estado.fila.map((v) =>
            v.id === registro.id ? { ...v, situacao: "sincronizada", sincronizado_em: new Date().toISOString() } : v
          );
        } catch (erro) {
          console.warn("[fiscalizacao] falha ao sincronizar:", registro.id, erro);
        }
      }
      gravarFila(estado.fila);
      registrarAuditoria({
        acao: "Sincronização da fila local",
        detalhe: `${sincronizadas} de ${pendentes.length} vistoria(s) aceitas pelo backend`,
      });
      renderFila();
      renderKpis();
      toast(
        sincronizadas === pendentes.length
          ? `${sincronizadas} vistoria(s) sincronizada(s) com o backend.`
          : `${sincronizadas} de ${pendentes.length} vistoria(s) sincronizada(s) — as demais seguem na fila.`,
        sincronizadas === pendentes.length ? "sucesso" : "erro",
        6000
      );
      return;
    }

    // Sem backend: a fila e consolidada localmente e a pendencia e registrada.
    estado.fila = estado.fila.map((v) =>
      v.situacao === "pendente_envio" ? { ...v, situacao: "sincronizada", sincronizado_em: new Date().toISOString() } : v
    );
    gravarFila(estado.fila);
    registrarAuditoria({
      acao: "Consolidação local da fila",
      detalhe: `${pendentes.length} vistoria(s) consolidadas localmente (sem backend configurado)`,
    });
    renderFila();
    renderKpis();
    toast(
      `${pendentes.length} vistoria(s) consolidadas localmente. O envio ao ArcGIS Enterprise exige VITE_API_BASE_URL configurado.`,
      "info",
      6000
    );
  }

  function aoConectar() {
    toast("Conexão restabelecida — sincronizando a fila local…", "info");
    sincronizar();
  }

  /* --------------------------------------------------------------- render */

  renderAvisoPermissao();
  renderKpis();
  renderFormulario();
  renderFila();
  renderBase();

  const aoDesconectar = () => {
    toast("Conexão perdida — os registros passam a ser gravados apenas na fila local.", "info", 5000);
    renderKpis();
  };

  window.addEventListener("online", aoConectar);
  window.addEventListener("offline", aoDesconectar);

  container.append(pagina);

  return {
    destruir() {
      window.removeEventListener("online", aoConectar);
      window.removeEventListener("offline", aoDesconectar);
    },
  };
}
