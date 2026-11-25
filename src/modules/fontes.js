/**
 * Catalogo de fontes de dados (REAL / SIMULADO / INDISPONIVEL).
 */
import { el } from "../utils/dom.js";
import { dados } from "../services/data.js";
import { etiquetaStatus, blocoAviso, toast } from "../components/ui.js";
import { paraCsv, baixarTexto } from "../utils/export.js";
import { data as formatarData } from "../utils/format.js";

export async function montar(container) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Catálogo de fontes de dados" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Todo conjunto de dados usado pela plataforma é catalogado com origem, órgão responsável, data de " +
            "atualização, licença, metodologia, precisão geográfica e avaliação de qualidade. A classificação " +
            "REAL/SIMULADO/INDISPONÍVEL impede a consolidação enganosa entre bases oficiais e demonstrativas.",
        }),
      ]),
    ])
  );

  const fontes = dados.fontes || [];
  const contagem = fontes.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  pagina.append(
    el("div", { className: "grade grade--3" }, [
      el("div", { className: "cartao cartao--positivo" }, [
        el("h3", { className: "cartao__titulo", text: "Fontes reais" }),
        el("p", { className: "cartao__valor", text: String(contagem.REAL || 0) }),
        el("p", { className: "cartao__detalhe", text: "IBGE, DNIT/SNV e serviços públicos validados." }),
      ]),
      el("div", { className: "cartao cartao--alerta" }, [
        el("h3", { className: "cartao__titulo", text: "Bases simuladas" }),
        el("p", { className: "cartao__valor", text: String(contagem.SIMULADO || 0) }),
        el("p", { className: "cartao__detalhe", text: "Demonstrativas, identificadas na interface." }),
      ]),
      el("div", { className: "cartao" }, [
        el("h3", { className: "cartao__titulo", text: "Fontes indisponíveis" }),
        el("p", { className: "cartao__valor", text: String(contagem.INDISPONIVEL || 0) }),
        el("p", { className: "cartao__detalhe", text: "Exigem autorização do Estado ou credencial." }),
      ]),
    ])
  );

  pagina.append(
    blocoAviso(
      "Como ler este catálogo",
      "Fontes REAIS são consultadas de serviços oficiais públicos e verificadas por scripts/fetch_dados_reais.py. " +
        "Fontes SIMULADAS são bases de demonstração coerentes com os dados oficiais, sempre identificadas como " +
        "DADOS SIMULADOS nas telas. Fontes INDISPONÍVEL dependem de credencial do ArcGIS Enterprise do Estado.",
      "info"
    )
  );

  const grade = el("div", { className: "grade grade--2" });
  fontes.forEach((fonte) => {
    grade.append(
      el("article", { className: "painel fonte" }, [
        el("header", { className: "painel__cabecalho" }, [
          el("h3", { className: "painel__titulo", text: fonte.titulo }),
          etiquetaStatus(fonte.status),
        ]),
        el("p", { className: "painel__descricao", text: fonte.descricao }),
        el("dl", { className: "lista-dados" }, [
          el("dt", { text: "Órgão responsável" }),
          el("dd", { text: fonte.orgao }),
          el("dt", { text: "Fonte" }),
          el("dd", { text: fonte.fonte }),
          el("dt", { text: "Formato" }),
          el("dd", { text: fonte.formato }),
          el("dt", { text: "Atualização" }),
          el("dd", { text: String(fonte.atualizado_em || "—") }),
          el("dt", { text: "Licença" }),
          el("dd", { text: fonte.licenca || "—" }),
          el("dt", { text: "Metodologia" }),
          el("dd", { text: fonte.metodologia || "—" }),
          el("dt", { text: "Precisão geográfica" }),
          el("dd", { text: fonte.precisao_geografica || "—" }),
          el("dt", { text: "Qualidade" }),
          el("dd", { text: fonte.qualidade || "—" }),
        ]),
        fonte.url
          ? el("a", { className: "botao botao--secundario botao--compacto", href: fonte.url, target: "_blank", rel: "noopener noreferrer", text: "Abrir serviço de origem" })
          : null,
      ])
    );
  });
  pagina.append(grade);

  const acoes = el("div", { className: "pagina__acoes" }, [
    el("button", {
      className: "botao botao--secundario",
      type: "button",
      text: "Exportar catálogo (CSV)",
      onclick: () => {
        baixarTexto("catalogo-fontes-ro.csv", paraCsv(fontes), "text/csv;charset=utf-8");
        toast("Catálogo exportado em CSV.", "sucesso");
      },
    }),
  ]);
  pagina.append(acoes);

  container.append(pagina);

  return { destruir() {} };
}
