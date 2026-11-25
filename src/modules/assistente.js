/**
 * APP 14 — Assistente geoespacial "InfraAI RO".
 *
 * Chat 100% LOCAL: as respostas sao montadas por REGRAS sobre os registros
 * carregados (sem API externa, sem modelo de linguagem). Cada resposta lista
 * os registros com os valores reais da base, informa a fonte (dataset +
 * status REAL/SIMULADO) e oferece um botao para destacar o registro no mapa.
 * Quando nao ha dados suficientes, o assistente diz isso explicitamente.
 */
import { el, limpar } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { config } from "../config.js";
import { normalizar, moeda, moedaCompacta, numero, percentual } from "../utils/format.js";
import { areasAmbiente, cruzarObrasComAreas } from "./_ambiente.js";

/** Sugestoes exibidas no inicio da conversa. */
const SUGESTOES = [
  "Quais obras estão atrasadas em Porto Velho?",
  "Quais municípios possuem maior volume de investimentos?",
  "Quais rodovias devem receber manutenção prioritária?",
  "Quais obras apresentam risco socioambiental?",
  "Quais contratos possuem vigência próxima do encerramento?",
];

/* --------------------------------------------------------------- entidades */

/** Extrai o nome de um municipio mencionado na pergunta. */
function detectarMunicipio(texto) {
  const alvo = normalizar(texto);
  let encontrado = null;
  (dados.municipios || []).forEach((m) => {
    if (!m.nome) return;
    const nome = normalizar(m.nome);
    if (!alvo.includes(nome)) return;
    if (!encontrado || nome.length > encontrado.nome.length) {
      encontrado = { nome: m.nome, codigo: m.codigo_ibge, tamanho: nome.length };
    }
  });
  return encontrado;
}

/** Detecta a categoria de obra citada. */
function detectarCategoria(texto) {
  const alvo = normalizar(texto);
  let encontrada = null;
  config.categoriasObra.forEach((c) => {
    const nome = normalizar(c.nome);
    if (alvo.includes(nome) || alvo.includes(normalizar(c.id))) encontrada = c;
  });
  return encontrada;
}

/** Detecta a situacao citada. */
function detectarSituacao(texto) {
  const alvo = normalizar(texto);
  const opcoes = [
    { id: "atrasada", termos: ["atrasad", "atraso", "atrasadas"] },
    { id: "paralisada", termos: ["paralisad"] },
    { id: "em_execucao", termos: ["em execucao", "em andamento", "executando"] },
    { id: "concluida", termos: ["concluid", "concluido", "finalizada", "terminada"] },
    { id: "planejada", termos: ["planejad"] },
  ];
  return opcoes.find((o) => o.termos.some((t) => alvo.includes(t)))?.id || null;
}

/** Detecta a rodovia citada (aceita "BR-364", "B-364" ou "364"). */
function detectarRodovia(texto) {
  const alvo = normalizar(texto);
  const codigos = new Set();
  dados.obras.forEach((o) => o.rodovia && codigos.add(o.rodovia));
  dados.ativos.forEach((a) => a.rodovia && codigos.add(a.rodovia));
  let encontrada = null;
  codigos.forEach((codigo) => {
    const digitos = codigo.replace(/[^0-9]/g, "");
    if (!digitos) return;
    if (alvo.includes(normalizar(codigo)) || new RegExp(`\\b${digitos}\\b`).test(alvo)) {
      if (!encontrada) encontrada = codigo;
    }
  });
  return encontrada;
}

/** Detecta um ano de referencia. */
function detectarAno(texto) {
  const alvo = normalizar(texto);
  const anos = [...new Set(dados.obras.map((o) => String(o.data_inicio || "").slice(0, 4)).filter(Boolean))];
  return anos.find((ano) => alvo.includes(ano)) || null;
}

/* ---------------------------------------------------------------- respostas */

/** Monta um cartao com os registros de uma resposta. */
function cartaoRegistros({ titulo, fonte, status, registros, colunas, destaque }) {
  const painel = el("section", { className: "painel" });
  painel.append(
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: titulo }),
        el("p", { className: "painel__descricao", text: `Fonte: ${fonte}` }),
      ]),
      el("span", {
        className: `etiqueta ${status === "REAL" ? "etiqueta--real" : "etiqueta--simulado"}`,
        text: status === "REAL" ? "DADOS REAIS" : "DADOS SIMULADOS",
      }),
    ])
  );

  if (!registros.length) {
    painel.append(el("p", { className: "painel__descricao", text: "Nenhum registro encontrado para este recorte." }));
    return painel;
  }

  const lista = el("ul", { className: "lista-resumo" });
  registros.forEach((registro) => {
    const linha = el("li", {}, [
      el("span", { text: registro.titulo }),
      el("strong", { text: registro.detalhe }),
    ]);
    if (destaque) {
      linha.append(
        el("button", {
          className: "botao botao--secundario botao--compacto",
          type: "button",
          text: "Destacar no mapa",
          onclick: () => destaque(registro),
        })
      );
    }
    lista.append(linha);
  });
  painel.append(lista);

  if (colunas) {
    painel.append(
      el("p", {
        className: "painel__descricao",
        text: `Total encontrado: ${numero(registros.length)}. ${colunas}`,
      })
    );
  }
  return painel;
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "InfraAI RO — assistente geoespacial" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Assistente conversacional 100% local. As respostas são montadas por regras sobre os registros " +
            "carregados na plataforma — não há API externa, modelo de linguagem ou resposta gerada. Cada " +
            "resultado aponta a base consultada e permite destacar o registro no geoportal.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [el("span", { className: "etiqueta etiqueta--neutra", text: "Regras locais" })]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);
  areaAvisos.append(
    el("p", {
      className: "aviso aviso--alerta",
      html: "<strong>Assistente determinístico</strong><span>As respostas seguem regras fixas sobre os dados da plataforma. Perguntas fora do padrão são respondidas com a indicação de que não há dados suficientes — o assistente nunca inventa valores.</span>",
    })
  );

  const areaChat = el("div", { className: "painel" });
  pagina.append(areaChat);
  container.append(pagina);

  const areas = await areasAmbiente();

  /* --------------------------------------------------------------- helpers */

  function navegarPara(tipo, id, camada) {
    if (tipo === "mapa") {
      ctx.navegar?.("mapa", { camada: camada || "obras", foco: id });
      return;
    }
    ctx.navegar?.(tipo, { foco: id });
  }

  function destaqueObra(obra) {
    navegarPara("obras", obra.id, "obras");
  }

  function destaqueAtivo(ativo) {
    navegarPara("ativos", ativo.id, "ativos");
  }

  function destaqueContrato(contrato) {
    navegarPara("contratos", contrato.id, "contratos");
  }

  function destaqueConvenio(convenio) {
    navegarPara("convenios", convenio.id, "convenios");
  }

  function destaqueMaquina(maquina) {
    navegarPara("maquinas", maquina.id, "maquinas");
  }

  function destaqueMunicipio(codigo) {
    navegarPara("mapa", codigo, "municipios");
  }

  /* --------------------------------------------------------------- intents */

  function responder(pergunta) {
    const texto = normalizar(pergunta);
    const municipio = detectarMunicipio(pergunta);
    const categoria = detectarCategoria(pergunta);
    const situacao = detectarSituacao(pergunta);
    const rodovia = detectarRodovia(pergunta);
    const ano = detectarAno(pergunta);

    const filtroObras = (obra) => {
      if (municipio && String(obra.municipio_codigo) !== String(municipio.codigo)) return false;
      if (categoria && obra.categoria !== categoria.id) return false;
      if (rodovia && obra.rodovia !== rodovia) return false;
      if (ano && String(obra.data_inicio || "").slice(0, 4) !== ano) return false;
      return true;
    };

    /* (1) obras atrasadas ------------------------------------------------- */
    if (texto.includes("atrasad") || texto.includes("atraso") || texto.includes("paralisad")) {
      const obras = dados.obras
        .filter((o) => filtroObras(o) && (o.situacao === "atrasada" || o.situacao === "paralisada" || (o.dias_atraso || 0) > 0))
        .sort((a, b) => (b.dias_atraso || 0) - (a.dias_atraso || 0));
      const escopo = municipio ? ` em ${municipio.nome}` : "";
      return {
        texto:
          `Encontrei ${numero(obras.length)} obra(s) em atraso ou paralisada${escopo}. ` +
          "O atraso é o próprio campo registrado na base de obras (dias entre o prazo previsto e a data de referência).",
        cartao: cartaoRegistros({
          titulo: `Obras em atraso${escopo}`,
          fonte: "Obras 360 — base demonstrativa (SIMULADO)",
          status: "SIMULADO",
          colunas: "O valor exibido é o valor atualizado do contrato vinculado.",
          registros: obras.slice(0, 10).map((o) => ({
            id: o.id,
            titulo: `${o.id} — ${o.titulo} (${o.municipio})`,
            detalhe: `${numero(o.dias_atraso || 0)} dias de atraso · ${percentual(o.percentual_execucao_fisica)} executado · ${moedaCompacta(o.valor_atualizado)}`,
          })),
          destaque: (registro) => {
            const obra = dados.obras.find((o) => o.id === registro.id);
            if (obra) destaqueObra(obra);
          },
        }),
      };
    }

    /* (2) investimento por municipio -------------------------------------- */
    if (
      (texto.includes("investimento") || texto.includes("investid") || texto.includes("recursos") || texto.includes("maior volume")) &&
      (texto.includes("municipio") || texto.includes("municipios") || texto.includes("cidades") || texto.includes("volume"))
    ) {
      const mapa = new Map();
      dados.obras.forEach((o) => {
        const atual = mapa.get(o.municipio) || { municipio: o.municipio, codigo: o.municipio_codigo, quantidade: 0, valor: 0 };
        atual.quantidade += 1;
        atual.valor += o.valor_atualizado || 0;
        mapa.set(o.municipio, atual);
      });
      const ranking = [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, 10);
      return {
        texto:
          `O ranking abaixo soma o valor atualizado das obras de cada município (${numero(dados.obras.length)} ` +
          "obras na base). É um retrato da carteira demonstrativa, não do orçamento oficial do Estado.",
        cartao: cartaoRegistros({
          titulo: "Municípios por volume de investimento",
          fonte: "Obras 360 — base demonstrativa (SIMULADO)",
          status: "SIMULADO",
          colunas: "Soma do campo «valor atualizado» de todas as obras do município.",
          registros: ranking.map((m) => ({
            id: m.codigo,
            titulo: m.municipio,
            detalhe: `${moedaCompacta(m.valor)} em ${numero(m.quantidade)} obra(s)`,
          })),
          destaque: (registro) => destaqueMunicipio(registro.id),
        }),
      };
    }

    /* (3) manutencao prioritaria de rodovias -------------------------------- */
    if (texto.includes("manutencao") || (texto.includes("rodovia") && (texto.includes("priorit") || texto.includes("deterior")))) {
      const ativos = dados.ativos
        .filter((a) => (!municipio || String(a.municipio_codigo) === String(municipio.codigo)) && (!rodovia || a.rodovia === rodovia))
        .map((a) => ({
          ativo: a,
          pontuacao:
            (a.condicao === "critica" ? 1 : a.condicao === "ruim" ? 0.75 : a.condicao === "regular" ? 0.4 : 0.1) * 0.65 +
            (a.criticidade === "critica" ? 1 : a.criticidade === "alta" ? 0.75 : a.criticidade === "media" ? 0.4 : 0.15) * 0.35,
        }))
        .sort((x, y) => y.pontuacao - x.pontuacao)
        .slice(0, 10);
      const escopo = rodovia ? ` na ${rodovia}` : municipio ? ` em ${municipio.nome}` : "";
      return {
        texto:
          `Ordenei os ativos${escopo} por prioridade de manutenção. A ordem combina a condição registrada " +
          "(65%) e a criticidade (35%) — não há previsão de falha: é um ranqueamento pelo estado atual do ativo.`,
        cartao: cartaoRegistros({
          titulo: `Ativos que pedem manutenção prioritária${escopo}`,
          fonte: "Pontes e Ativos — base demonstrativa (SIMULADO)",
          status: "SIMULADO",
          colunas: "Prioridade = 0,65 × condição + 0,35 × criticidade.",
          registros: ativos.map(({ ativo, pontuacao }) => ({
            id: ativo.id,
            titulo: `${ativo.id} — ${ativo.tipo_nome} (${ativo.municipio})`,
            detalhe: `Condição ${ativo.condicao_nome || ativo.condicao} · criticidade ${ativo.criticidade} · prioridade ${percentual(pontuacao * 100)}`,
          })),
          destaque: (registro) => {
            const ativo = dados.ativos.find((a) => a.id === registro.id);
            if (ativo) destaqueAtivo(ativo);
          },
        }),
      };
    }

    /* (4) risco socioambiental --------------------------------------------- */
    if (texto.includes("ambiental") || texto.includes("area de protecao") || texto.includes("impacto")) {
      const obras = dados.obras.filter(filtroObras);
      const { areas: areasCruizadas } = cruzarObrasComAreas(obras, areas);
      const interferencia = areasCruizadas.filter((a) => a.obrasDentro > 0);
      const registros = interferencia.flatMap((a) =>
        a.obras.map((obra) => ({
          id: obra.id,
          titulo: `${obra.id} — ${obra.titulo}`,
          detalhe: `Dentro de ${a.nome} (${a.categoria}) · ${obra.municipio}`,
        }))
      );
      const escopo = municipio ? ` em ${municipio.nome}` : "";
      return {
        texto:
          `O cruzamento ponto-em-polígono entre as obras${escopo} e as áreas de proteção oficiais encontrou ` +
          `${numero(registros.length)} obra(s) dentro de ${numero(interferencia.length)} área(s). É uma leitura ` +
          "geométrica exploratória: não substitui avaliação de impacto ambiental.",
        cartao: cartaoRegistros({
          titulo: `Obras dentro de áreas de proteção${escopo}`,
          fonte: "Áreas de proteção (REAL) × Obras 360 (SIMULADO)",
          status: "SIMULADO",
          colunas: "O cruzamento é feito sobre a geometria oficial da área de proteção.",
          registros: registros.slice(0, 10),
          destaque: (registro) => {
            const obra = dados.obras.find((o) => o.id === registro.id);
            if (obra) destaqueObra(obra);
          },
        }),
      };
    }

    /* (5) contratos com vigencia proxima do encerramento --------------------- */
    if (texto.includes("vigencia") || texto.includes("vencimento") || texto.includes("vencendo") || (texto.includes("contrato") && texto.includes("encerra"))) {
      const contratos = dados.contratos
        .filter((c) => !municipio || c.municipio === municipio.nome)
        .map((c) => ({ contrato: c, dias: Number.isFinite(c.dias_para_vencer) ? c.dias_para_vencer : null }))
        .filter((c) => c.dias !== null && c.dias >= 0 && c.dias <= 180 && c.contrato.situacao !== "encerrado")
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 10);
      const escopo = municipio ? ` de ${municipio.nome}` : "";
      return {
        texto:
          `Há ${numero(contratos.length)} contrato(s)${escopo} com vigência encerrando nos próximos 180 dias, ` +
          "considerando o campo «dias para vencer» da base e excluindo os contratos já encerrados.",
        cartao: cartaoRegistros({
          titulo: `Contratos com vigência próxima do encerramento${escopo}`,
          fonte: "Gestão de Contratos — base demonstrativa (SIMULADO)",
          status: "SIMULADO",
          colunas: "Janela de 180 dias a partir da data de referência da base.",
          registros: contratos.map(({ contrato, dias }) => ({
            id: contrato.id,
            titulo: `${contrato.id} — ${contrato.objeto}`,
            detalhe: `${dias} dias para encerrar · ${moedaCompacta(contrato.valor_atualizado)} · ${contrato.municipio}`,
          })),
          destaque: (registro) => {
            const contrato = dados.contratos.find((c) => c.id === registro.id);
            if (contrato) destaqueContrato(contrato);
          },
        }),
      };
    }

    /* (6) convenios -------------------------------------------------------- */
    if (texto.includes("convenio") || texto.includes("transferencia")) {
      const convenios = dados.convenios
        .filter((c) => !municipio || String(c.municipio_codigo) === String(municipio.codigo))
        .sort((a, b) => (b.valor || 0) - (a.valor || 0))
        .slice(0, 10);
      const escopo = municipio ? ` em ${municipio.nome}` : "";
      return {
        texto:
          `A base tem ${numero(dados.convenios.length)} convênios; abaixo os ${numero(convenios.length)} de maior ` +
          `valor${escopo}. Os convênios carregam valor, contrapartida e desembolsos.`,
        cartao: cartaoRegistros({
          titulo: `Convênios${escopo}`,
          fonte: "Convênios e transferências — base demonstrativa (SIMULADO)",
          status: "SIMULADO",
          colunas: "Situação, valor e desembolsos vêm do próprio registro do convênio.",
          registros: convenios.map((c) => ({
            id: c.id,
            titulo: `${c.id} — ${c.objeto}`,
            detalhe: `${moedaCompacta(c.valor)} · desembolsado ${percentual(c.valor ? (c.desembolsado / c.valor) * 100 : 0)} · ${c.situacao}`,
          })),
          destaque: (registro) => {
            const convenio = dados.convenios.find((c) => c.id === registro.id);
            if (convenio) destaqueConvenio(convenio);
          },
        }),
      };
    }

    /* (7) maquinas --------------------------------------------------------- */
    if (texto.includes("maquina") || texto.includes("frota") || texto.includes("equipamento")) {
      const maquinas = dados.maquinas
        .filter((m) => !municipio || String(m.municipio_codigo) === String(municipio.codigo))
        .sort((a, b) => (a.disponibilidade || 0) - (b.disponibilidade || 0))
        .slice(0, 10);
      const escopo = municipio ? ` em ${municipio.nome}` : "";
      return {
        texto:
          `A frota registrada tem ${numero(dados.maquinas.length)} equipamentos; abaixo os ${numero(maquinas.length)} ` +
          `de menor disponibilidade${escopo}.`,
        cartao: cartaoRegistros({
          titulo: `Máquinas com menor disponibilidade${escopo}`,
          fonte: "Máquinas e equipamentos — base demonstrativa (SIMULADO)",
          status: "SIMULADO",
          colunas: "Disponibilidade e horas de operação vêm do cadastro da máquina.",
          registros: maquinas.map((m) => ({
            id: m.id,
            titulo: `${m.patrimonial} — ${m.tipo_nome} (${m.municipio})`,
            detalhe: `Disponibilidade ${percentual((m.disponibilidade || 0) * 100)} · ${m.situacao} · ${numero(m.horas_operacao)} h`,
          })),
          destaque: (registro) => {
            const maquina = dados.maquinas.find((m) => m.id === registro.id);
            if (maquina) destaqueMaquina(maquina);
          },
        }),
      };
    }

    /* (8) perfil de municipio ----------------------------------------------- */
    if (municipio && !texto.includes("obra") && !texto.includes("contrato") && !texto.includes("convenio") && !texto.includes("maquina")) {
      const obras = dados.obras.filter((o) => String(o.municipio_codigo) === String(municipio.codigo));
      const contratos = dados.contratos.filter((c) => c.municipio === municipio.nome);
      const ativos = dados.ativos.filter((a) => String(a.municipio_codigo) === String(municipio.codigo));
      const indicadores = dados.indicadoresMunicipais?.[municipio.codigo] || {};
      const valor = obras.reduce((acc, o) => acc + (o.valor_atualizado || 0), 0);
      return {
        texto:
          `Resumo de ${municipio.nome} com os dados carregados: ${numero(obras.length)} obra(s), ` +
          `${numero(contratos.length)} contrato(s) e ${numero(ativos.length)} ativo(s) no inventário.`,
        cartao: cartaoRegistros({
          titulo: `Perfil de ${municipio.nome}`,
          fonte: "Obras, Contratos e Ativos (SIMULADO) + IBGE (REAL)",
          status: "SIMULADO",
          colunas: `População ${numero(indicadores.populacao || 0)} (IBGE, REAL) · PIB ${numero(indicadores.pib_milhoes || 0, 1)} mi (IBGE, REAL).`,
          registros: [
            {
              id: municipio.codigo,
              titulo: "Investimento em obras",
              detalhe: `${moeda(valor)} · execução física média ${percentual(
                obras.length ? obras.reduce((acc, o) => acc + (o.percentual_execucao_fisica || 0), 0) / obras.length : 0
              )}`,
            },
            {
              id: municipio.codigo,
              titulo: "Contratos",
              detalhe: `${numero(contratos.length)} contrato(s) · ${moedaCompacta(
                contratos.reduce((acc, c) => acc + (c.valor_atualizado || 0), 0)
              )}`,
            },
            {
              id: municipio.codigo,
              titulo: "Ativos inventariados",
              detalhe: `${numero(ativos.length)} ativo(s) · ${numero(
                ativos.filter((a) => a.criticidade === "alta" || a.criticidade === "critica").length
              )} de criticidade alta/crítica`,
            },
          ],
          destaque: () => destaqueMunicipio(municipio.codigo),
        }),
      };
    }

    /* (9) panorama geral --------------------------------------------------- */
    if (texto.includes("resumo") || texto.includes("panorama") || texto.includes("quantas obras") || texto.includes("geral")) {
      return {
        texto:
          `A plataforma carrega ${numero(dados.obras.length)} obras, ${numero(dados.contratos.length)} contratos, ` +
          `${numero(dados.ativos.length)} ativos, ${numero(dados.convenios.length)} convênios e ` +
          `${numero(dados.maquinas.length)} máquinas — todos da base demonstrativa (SIMULADO).`,
        cartao: cartaoRegistros({
          titulo: "Panorama das bases carregadas",
          fonte: "Serviço de dados da plataforma",
          status: "SIMULADO",
          colunas: "O SNV (malha rodoviaria), os limites municipais do IBGE e os indicadores municipais são dados REAIS.",
          registros: [
            { id: "municipios", titulo: "Municípios", detalhe: `${numero(dados.municipios.length)} limites oficiais (IBGE, REAL)` },
            {
              id: "obras",
              titulo: "Obras",
              detalhe: `${numero(dados.obras.length)} registros · ${moedaCompacta(
                dados.obras.reduce((acc, o) => acc + (o.valor_atualizado || 0), 0)
              )}`,
            },
            {
              id: "contratos",
              titulo: "Contratos",
              detalhe: `${numero(dados.contratos.length)} registros · ${moedaCompacta(
                dados.contratos.reduce((acc, c) => acc + (c.valor_atualizado || 0), 0)
              )}`,
            },
            {
              id: "ativos",
              titulo: "Ativos",
              detalhe: `${numero(dados.ativos.length)} registros · ${numero(
                dados.ativos.filter((a) => a.criticidade === "alta" || a.criticidade === "critica").length
              )} de criticidade alta/crítica`,
            },
          ],
          destaque: (registro) => {
            if (registro.id === "municipios") navegarPara("mapa", "1100205", "municipios");
            else navegarPara(registro.id, "", registro.id);
          },
        }),
      };
    }

    /* (10) sem dados suficientes -------------------------------------------- */
    return {
      texto:
        "Não há dados suficientes na plataforma para responder a essa pergunta. O assistente só responde com base " +
        "nos registros carregados (obras, contratos, ativos, convênios, máquinas, municípios, malha do SNV e áreas " +
        "de proteção) e não estima, não completa e não inventa números.",
      cartao: cartaoRegistros({
        titulo: "O que o assistente sabe responder",
        fonte: "Regras locais sobre as bases carregadas",
        status: "SIMULADO",
        colunas: "Tente reformular a pergunta usando município, categoria, rodovia ou situação.",
        registros: [
          { id: "1", titulo: "Obras atrasadas", detalhe: "«Quais obras estão atrasadas em Porto Velho?»" },
          { id: "2", titulo: "Investimento por município", detalhe: "«Quais municípios possuem maior volume de investimentos?»" },
          { id: "3", titulo: "Manutenção prioritária", detalhe: "«Quais rodovias devem receber manutenção prioritária?»" },
          { id: "4", titulo: "Risco socioambiental", detalhe: "«Quais obras apresentam risco socioambiental?»" },
          { id: "5", titulo: "Vigência de contratos", detalhe: "«Quais contratos possuem vigência próxima do encerramento?»" },
        ],
      }),
    };
  }

  /* ----------------------------------------------------------------- chat */

  const historico = el("div", { className: "lista-dados", style: { "--colunas": "1" } });

  function mensagemUsuario(texto) {
    historico.append(
      el("article", { className: "cartao cartao--resumo" }, [
        el("h3", { className: "cartao__titulo", text: "Você" }),
        el("p", { className: "cartao__detalhe", text: texto }),
      ])
    );
  }

  function mensagemAssistente(resposta) {
    const bloco = el("article", { className: "cartao cartao--destaque" }, [
      el("h3", { className: "cartao__titulo", text: "InfraAI RO" }),
      el("p", { className: "cartao__detalhe", text: resposta.texto }),
    ]);
    historico.append(bloco);
    historico.append(resposta.cartao);
  }

  function perguntar(texto) {
    const pergunta = (texto || "").trim();
    if (!pergunta) return;
    mensagemUsuario(pergunta);
    let resposta;
    try {
      resposta = responder(pergunta);
    } catch (erro) {
      console.warn("[assistente] falha ao responder:", erro);
      resposta = {
        texto: "Não foi possível responder a essa pergunta com os dados carregados.",
        cartao: cartaoRegistros({
          titulo: "Sem resposta",
          fonte: "Regras locais",
          status: "SIMULADO",
          registros: [],
        }),
      };
    }
    mensagemAssistente(resposta);
    historico.scrollIntoView?.({ block: "nearest" });
  }

  const campo = el("input", {
    type: "text",
    className: "campo campo--busca",
    id: "assistente-pergunta",
    placeholder: "Ex.: quais obras estão atrasadas em Porto Velho?",
    "aria-label": "Escreva a pergunta para o InfraAI RO",
  });

  const botao = el("button", {
    className: "botao botao--primario",
    type: "button",
    text: "Perguntar",
    onclick: () => {
      const texto = campo.value;
      campo.value = "";
      perguntar(texto);
      campo.focus();
    },
  });

  campo.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      botao.click();
    }
  });

  areaChat.append(
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: "Conversa" }),
        el("p", { className: "painel__descricao", text: "As respostas usam apenas os registros carregados na plataforma." }),
      ]),
    ]),
    historico,
    el("div", { className: "campo-grupo" }, [
      el("label", { className: "campo-rotulo", for: "assistente-pergunta", text: "Sua pergunta" }),
      campo,
    ]),
    botao
  );

  const areaSugestoes = el("div", { className: "chips" });
  SUGESTOES.forEach((sugestao) => {
    areaSugestoes.append(
      el("button", {
        className: "chip",
        type: "button",
        text: sugestao,
        onclick: () => perguntar(sugestao),
      })
    );
  });
  pagina.insertBefore(
    el("section", { className: "painel" }, [
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Sugestões de pergunta" }),
          el("p", { className: "painel__descricao", text: "Clique em uma sugestão para executá-la imediatamente." }),
        ]),
      ]),
      areaSugestoes,
    ]),
    areaChat
  );

  mensagemAssistente({
    texto:
      "Olá! Sou o InfraAI RO. Respondo a partir das bases carregadas nesta plataforma (obras, contratos, ativos, " +
      "convênios, máquinas, municípios, malha do SNV e áreas de proteção) e sempre informo a fonte de cada número.",
    cartao: cartaoRegistros({
      titulo: "Bases disponíveis para consulta",
      fonte: "Serviço de dados da plataforma",
      status: "SIMULADO",
      colunas: "Malha rodoviaria (SNV), limites municipais e indicadores do IBGE são dados REAIS.",
      registros: [
        { id: "obras", titulo: "Obras 360", detalhe: `${numero(dados.obras.length)} registros` },
        { id: "contratos", titulo: "Gestão de Contratos", detalhe: `${numero(dados.contratos.length)} registros` },
        { id: "ativos", titulo: "Pontes e Ativos", detalhe: `${numero(dados.ativos.length)} registros` },
        { id: "convenios", titulo: "Convênios", detalhe: `${numero(dados.convenios.length)} registros` },
        { id: "maquinas", titulo: "Máquinas", detalhe: `${numero(dados.maquinas.length)} registros` },
      ],
    }),
  });

  return {
    destruir() {
      limpar(historico);
    },
  };
}
