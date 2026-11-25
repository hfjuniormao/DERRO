/**
 * APP 16 — Dados abertos.
 *
 * Catalogo das bases publicadas pela plataforma: titulo, descricao, fonte,
 * data de atualizacao, responsavel, licenca, metodologia e qualidade.
 *
 * O catalogo vem de data/fontes.json (status REAL/SIMULADO/INDISPONIVEL) e os
 * downloads usam os dados locais efetivamente carregados — CSV para as bases
 * tabulares e GeoJSON para as bases com geometria.
 */
import { el, limpar } from "../utils/dom.js";
import { dados, caminhoDados } from "../services/data.js";
import { config } from "../config.js";
import { cartaoIndicador, listaDados } from "../components/cards.js";
import { criarTabela } from "../components/tables.js";
import { etiquetaStatus, blocoAviso, toast } from "../components/ui.js";
import { paraCsv, baixarTexto, paraGeojson } from "../utils/export.js";
import { numero, data as formatarData } from "../utils/format.js";

const STATUS_FILTRO = [
  { id: "", nome: "Todas as fontes" },
  { id: "REAL", nome: "Dados reais" },
  { id: "SIMULADO", nome: "Dados simulados" },
  { id: "INDISPONIVEL", nome: "Indisponíveis" },
];

/**
 * Downloads Possible: CSV para as bases tabulares e GeoJSON para as bases
 * espaciais que estao carregadas nesta sessao.
 */
function montarDownloads() {
  return {
    municipios: {
      rotulo: "Municipios (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.municipios || []).map((m) => ({
            codigo_ibge: m.codigo_ibge,
            nome: m.nome,
            uf: m.uf,
            area_km2: m.area_km2,
            centroide_lon: m.centroide?.[0],
            centroide_lat: m.centroide?.[1],
          }))
        ),
      nome: "municipios-ro.csv",
    },
    "indicadores-municipais": {
      rotulo: "Indicadores municipais (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          Object.entries(dados.indicadoresMunicipais || {}).map(([codigo, indicadores]) => ({
            codigo_ibge: codigo,
            populacao: indicadores.populacao,
            pib_milhoes: indicadores.pib_milhoes,
          }))
        ),
      nome: "indicadores-municipais.csv",
    },
    obras: {
      rotulo: "Obras (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.obras || []).map((o) => ({
            id: o.id,
            titulo: o.titulo,
            categoria: o.categoria,
            municipio: o.municipio,
            municipio_codigo: o.municipio_codigo,
            rodovia: o.rodovia,
            km: o.km,
            valor_inicial: o.valor_inicial,
            valor_atualizado: o.valor_atualizado,
            percentual_execucao_fisica: o.percentual_execucao_fisica,
            percentual_execucao_financeira: o.percentual_execucao_financeira,
            situacao: o.situacao,
            data_inicio: o.data_inicio,
            data_fim_prevista: o.data_fim_prevista,
            dias_atraso: o.dias_atraso,
            lat: o.localizacao?.lat,
            lon: o.localizacao?.lon,
          }))
        ),
      nome: "obras.csv",
    },
    "obras-geojson": {
      rotulo: "Obras (GeoJSON)",
      tipo: "geojson",
      conteudo: () =>
        paraGeojson(
          (dados.obras || []).map((o) =>
            criarFeature(
              {
                id: o.id,
                titulo: o.titulo,
                categoria: o.categoria,
                municipio: o.municipio,
                situacao: o.situacao,
                valor_atualizado: o.valor_atualizado,
              },
              o.geometria
            )
          )
        ),
      nome: "obras.geojson",
    },
    contratos: {
      rotulo: "Contratos (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.contratos || []).map((c) => ({
            id: c.id,
            objeto: c.objeto,
            contratada: c.contratada,
            orgao: c.orgao,
            municipio: c.municipio,
            vigencia_inicio: c.vigencia_inicio,
            vigencia_fim: c.vigencia_fim,
            valor_inicial: c.valor_inicial,
            valor_aditivos: c.valor_aditivos,
            valor_atualizado: c.valor_atualizado,
            valor_empenhado: c.valor_empenhado,
            valor_liquidado: c.valor_liquidado,
            valor_pago: c.valor_pago,
            saldo: c.saldo,
            situacao: c.situacao,
            modalidade: c.modalidade,
          }))
        ),
      nome: "contratos.csv",
    },
    ativos: {
      rotulo: "Ativos (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.ativos || []).map((a) => ({
            id: a.id,
            tipo: a.tipo_nome,
            municipio: a.municipio,
            rodovia: a.rodovia,
            km: a.km,
            condicao: a.condicao,
            criticidade: a.criticidade,
            ano_implantacao: a.ano_implantacao,
            ultima_inspecao: a.ultima_inspecao,
            lat: a.localizacao?.lat,
            lon: a.localizacao?.lon,
          }))
        ),
      nome: "ativos.csv",
    },
    "ativos-geojson": {
      rotulo: "Ativos (GeoJSON)",
      tipo: "geojson",
      conteudo: () =>
        paraGeojson(
          (dados.ativos || []).map((a) =>
            criarFeature(
              {
                id: a.id,
                tipo: a.tipo_nome,
                municipio: a.municipio,
                condicao: a.condicao,
                criticidade: a.criticidade,
              },
              a.geometria
            )
          )
        ),
      nome: "ativos.geojson",
    },
    convenios: {
      rotulo: "Convênios (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.convenios || []).map((c) => ({
            id: c.id,
            objeto: c.objeto,
            orgao_concedente: c.orgao_concedente,
            beneficiario: c.beneficiario,
            municipio: c.municipio,
            valor: c.valor,
            contrapartida: c.contrapartida,
            desembolsado: c.desembolsado,
            saldo: c.saldo,
            vigencia_inicio: c.vigencia_inicio,
            vigencia_fim: c.vigencia_fim,
            situacao: c.situacao,
            lat: c.localizacao?.lat,
            lon: c.localizacao?.lon,
          }))
        ),
      nome: "convenios.csv",
    },
    maquinas: {
      rotulo: "Máquinas (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.maquinas || []).map((m) => ({
            id: m.id,
            tipo: m.tipo_nome,
            patrimonial: m.patrimonial,
            unidade_responsavel: m.unidade_responsavel,
            municipio: m.municipio,
            disponibilidade: m.disponibilidade,
            situacao: m.situacao,
            horas_operacao: m.horas_operacao,
            ultima_manutencao: m.ultima_manutencao,
            lat: m.localizacao?.lat,
            lon: m.localizacao?.lon,
          }))
        ),
      nome: "maquinas.csv",
    },
    vistorias: {
      rotulo: "Vistorias (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.vistorias || []).map((v) => ({
            id: v.id,
            obra_id: v.obra_id,
            municipio: v.municipio,
            data: v.data,
            responsavel: v.responsavel,
            percentual_avanco: v.percentual_avanco,
            inconformidades: v.inconformidades,
            observacoes: v.observacoes,
            situacao: v.situacao,
          }))
        ),
      nome: "vistorias.csv",
    },
    "serie-investimento": {
      rotulo: "Série de investimento (CSV)",
      tipo: "csv",
      conteudo: () =>
        paraCsv(
          (dados.serieInvestimento || []).map((p) => ({
            ano: p.ano,
            mes: p.mes,
            valor: p.valor,
            fonte: p.fonte,
          }))
        ),
      nome: "serie-investimento.csv",
    },
    rodovias: {
      rotulo: "SNV (GeoJSON)",
      tipo: "geojson",
      conteudo: () =>
        paraGeojson(
          (dados.rodovias || []).map((f) => ({
            type: "Feature",
            properties: f.properties,
            geometry: f.geometry,
          }))
        ),
      nome: "snv-rodovias.geojson",
    },
    "vias-estaduais": {
      rotulo: "Vias estaduais (GeoJSON)",
      tipo: "geojson",
      conteudo: () =>
        paraGeojson(
          (dados.viasEstaduais || []).map((f) => ({
            type: "Feature",
            properties: f.properties,
            geometry: f.geometry,
          }))
        ),
      nome: "vias-estaduais.geojson",
    },
  };
}

function criarFeature(propriedades, geometria) {
  return { type: "Feature", properties: propriedades, geometry: geometria || null };
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Dados abertos" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Catálogo das bases publicadas pela plataforma com título, descrição, fonte, data de atualização, " +
            "responsável, licença, metodologia e qualidade. As fontes marcadas como REAIS são consultáveis " +
            "publicamente; as SIMULADAS são bases demonstrativas; as INDISPONÍVEIS aguardam autorização oficial.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [etiquetaStatus("REAL", "Catálogo de fontes")]),
    ])
  );

  const areaAvisos = el("div");
  pagina.append(areaAvisos);

  const areaKpis = el("div", { className: "grade grade--kpi" });
  const areaCartoes = el("div", { className: "grade grade--2" });
  const areaTabela = el("div", { className: "painel" });
  const areaDownloads = el("div", { className: "painel" });
  const areaServicos = el("div", { className: "painel" });
  pagina.append(areaKpis, areaCartoes, areaTabela, areaDownloads, areaServicos);

  /* -------------------------------------------------------------- fontes */

  let fontes = dados.fontes || [];
  if (!fontes.length) {
    try {
      const resposta = await fetch(caminhoDados("fontes.json"), { cache: "no-cache" });
      if (resposta.ok) {
        const json = await resposta.json();
        fontes = json.fontes || [];
      }
    } catch (erro) {
      console.warn("[dados-abertos] falha ao carregar o catálogo de fontes:", erro);
    }
  }

  const downloads = montarDownloads();
  let statusFiltro = "";

  /* -------------------------------------------------------------- render */

  function render() {
    const lista = fontes.filter((f) => !statusFiltro || f.status === statusFiltro);

    limpar(areaAvisos);
    areaAvisos.append(
      blocoAviso(
        "Formato aberto e licenças",
        "Os downloads são gerados no navegador a partir dos dados carregados nesta sessão: CSV com separador " +
          "ponto e vírgula e BOM UTF-8 (pronto para o Excel em português) e GeoJSON no padrão RFC 7946. " +
          "As licenças originais de cada fonte estão na tabela do catálogo.",
        "sucesso"
      )
    );

    limpar(areaKpis);
    areaKpis.append(
      cartaoIndicador({
        titulo: "Fontes catalogadas",
        valor: numero(fontes.length),
        detalhe: `${numero(fontes.filter((f) => f.status === "REAL").length)} reais · ${numero(
          fontes.filter((f) => f.status === "SIMULADO").length
        )} simuladas · ${numero(fontes.filter((f) => f.status === "INDISPONIVEL").length)} indisponíveis`,
        icone: "📦",
        rodape: "Catálogo mantido em data/fontes.json",
      }),
      cartaoIndicador({
        titulo: "Bases locais para download",
        valor: numero(Object.keys(downloads).length),
        detalhe: "CSV e GeoJSON gerados nesta sessão",
        icone: "⬇️",
        tom: "positivo",
      }),
      cartaoIndicador({
        titulo: "Serviços públicos geográficos",
        valor: numero(config.endpointsAbertos.length),
        detalhe: "Endpoints REST oficiais ligados abaixo",
        icone: "🌐",
        rodape: "SNV, malha viária, municípios, sedes e IBGE",
      }),
      cartaoIndicador({
        titulo: "Atualização do catálogo",
        valor: fontes[0]?.atualizado_em_execucao ? formatarData(fontes[0].atualizado_em_execucao) : "—",
        detalhe: "Gerado na preparação das bases",
        icone: "🗓️",
      })
    );

    renderCartoes(lista);
    renderTabela(lista);
    renderDownloads();
    renderServicos();
  }

  function renderCartoes(lista) {
    limpar(areaCartoes);
    if (!lista.length) {
      areaCartoes.append(el("p", { className: "painel__descricao", text: "Nenhuma fonte para o filtro selecionado." }));
      return;
    }
    lista.forEach((fonte) => {
      areaCartoes.append(
        el("article", { className: "cartao cartao--destaque" }, [
          el("header", { className: "cartao__cabecalho" }, [
            el("h3", { className: "cartao__titulo", text: fonte.titulo }),
            el("span", {
              className: `etiqueta ${
                fonte.status === "REAL" ? "etiqueta--real" : fonte.status === "SIMULADO" ? "etiqueta--simulado" : "etiqueta--indisponivel"
              }`,
              text: fonte.status,
            }),
          ]),
          el("p", { className: "cartao__detalhe", text: fonte.descricao }),
          listaDados(
            [
              { rotulo: "Órgão responsável", valor: fonte.orgao || "—" },
              { rotulo: "Atualizado em", valor: fonte.atualizado_em || "—" },
              { rotulo: "Formato", valor: fonte.formato || "—" },
              { rotulo: "Licença", valor: fonte.licenca || "—" },
              { rotulo: "Metodologia", valor: fonte.metodologia || "—" },
              { rotulo: "Qualidade", valor: fonte.qualidade || "—" },
              { rotulo: "Precisão geográfica", valor: fonte.precisao_geografica || "—" },
              {
                rotulo: "Repositório",
                valor: fonte.url
                  ? el("a", { href: fonte.url, target: "_blank", rel: "noopener noreferrer", text: fonte.url })
                  : "—",
              },
            ],
            { colunas: 2 }
          ),
        ])
      );
    });
  }

  function renderTabela(lista) {
    limpar(areaTabela);
    areaTabela.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Catálogo completo" }),
          el("p", { className: "painel__descricao", text: "Busque, ordene e exporte o catálogo em CSV." }),
        ]),
        el("div", { className: "campo-grupo" }, [
          el("label", { className: "campo-rotulo", for: "filtro-status-fonte", text: "Filtrar por status" }),
          el(
            "select",
            {
              className: "campo",
              id: "filtro-status-fonte",
              onchange: (ev) => {
                statusFiltro = ev.target.value;
                render();
              },
            },
            STATUS_FILTRO.map((opcao) =>
              el("option", { value: opcao.id, text: opcao.nome, selected: opcao.id === statusFiltro })
            )
          ),
        ]),
      ])
    );
    const corpo = el("div");
    areaTabela.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "id", rotulo: "Identificador" },
        { chave: "titulo", rotulo: "Título" },
        { chave: "descricao", rotulo: "Descrição" },
        { chave: "status", rotulo: "Status" },
        { chave: "orgao", rotulo: "Órgão responsável" },
        { chave: "fonte", rotulo: "Fonte" },
        { chave: "formato", rotulo: "Formato" },
        { chave: "atualizado_em", rotulo: "Atualizado em" },
        { chave: "licenca", rotulo: "Licença" },
        { chave: "metodologia", rotulo: "Metodologia" },
        { chave: "qualidade", rotulo: "Qualidade" },
      ],
      linhas: lista,
      nomeExportacao: "catalogo-de-fontes",
      porPagina: 15,
    });
  }

  function renderDownloads() {
    limpar(areaDownloads);
    areaDownloads.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Downloads das bases locais" }),
          el("p", {
            className: "painel__descricao",
            text:
              "Os arquivos são montados no navegador a partir dos dados carregados. Bases sem geometria são " +
              "oferecidas em CSV; as bases espaciais também em GeoJSON.",
          }),
        ]),
      ])
    );
    const grade = el("div", { className: "grade grade--4" });
    Object.entries(downloads).forEach(([chave, item]) => {
      const botao = el("button", {
        className: "botao botao--secundario",
        type: "button",
        text: item.rotulo,
        onclick: () => {
          try {
            baixarTexto(
              item.nome,
              item.conteudo(),
              item.tipo === "geojson" ? "application/geo+json" : "text/csv;charset=utf-8"
            );
            toast(`${item.rotulo} baixado.`, "sucesso");
          } catch (erro) {
            console.warn("[dados-abertos] falha ao gerar o download:", erro);
            toast("Não foi possível gerar o arquivo.", "erro");
          }
        },
      });
      grade.append(
        el("div", { className: "cartao cartao--resumo" }, [
          el("h3", { className: "cartao__titulo", text: item.rotulo }),
          el("p", { className: "cartao__detalhe", text: item.tipo === "geojson" ? "GeoJSON (RFC 7946)" : "CSV (; com BOM UTF-8)" }),
          botao,
        ])
      );
    });
    areaDownloads.append(grade);
  }

  function renderServicos() {
    limpar(areaServicos);
    areaServicos.append(
      el("header", { className: "painel__cabecalho" }, [
        el("div", {}, [
          el("h3", { className: "painel__titulo", text: "Serviços geográficos públicos" }),
          el("p", {
            className: "painel__descricao",
            text: "Endpoints REST oficiais consultáveis diretamente — a base real por trás de boa parte do geoportal.",
          }),
        ]),
        etiquetaStatus("REAL", "Serviços públicos"),
      ])
    );
    const corpo = el("div");
    areaServicos.append(corpo);
    criarTabela(corpo, {
      colunas: [
        { chave: "titulo", rotulo: "Serviço" },
        { chave: "formato", rotulo: "Formato" },
        { chave: "status", rotulo: "Status" },
        {
          chave: "url",
          rotulo: "Endpoint",
          renderizar: (linha) =>
            el("a", { href: linha.url, target: "_blank", rel: "noopener noreferrer", text: linha.url }),
        },
      ],
      linhas: config.endpointsAbertos,
      nomeExportacao: "servicos-geograficos-publicos",
      porPagina: 10,
    });
  }

  render();
  container.append(pagina);

  return {
    destruir() {
      limpar(areaCartoes);
    },
  };
}
