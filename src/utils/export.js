/**
 * Exportacao de dados (CSV e GeoJSON) e download de arquivos.
 */
import { escapar } from "./format.js";

/** Converte array de objetos em CSV (separador ; e BOM para Excel pt-BR). */
export function paraCsv(linhas, colunas = null) {
  if (!linhas || !linhas.length) return "";
  const chaves = colunas || Object.keys(linhas[0]);
  const escaparCelula = (v) => {
    if (v === null || v === undefined) return "";
    const texto = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const cabecalho = chaves.join(";");
  const corpo = linhas.map((linha) => chaves.map((c) => escaparCelula(linha[c])).join(";")).join("\n");
  return `\uFEFF${cabecalho}\n${corpo}`;
}

/** Baixa um texto como arquivo. */
export function baixarTexto(nomeArquivo, conteudo, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([conteudo], { type: tipo });
  baixarBlob(nomeArquivo, blob);
}

/** Baixa um blob como arquivo. */
export function baixarBlob(nomeArquivo, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Gera FeatureCollection GeoJSON a partir de features. */
export function paraGeojson(features) {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      metadata: {
        gerado_em: new Date().toISOString(),
        origem: "CENTRAL INFRA RO 360",
        aviso: "Dados de infraestruturasao demonstrativos (SIMULADOS).",
      },
      features,
    },
    null,
    1
  );
}

/** Gera um HTML autonomo de impressao de mapa. */
export function paginaImpressao({ titulo, subtitulo, corpoHtml, rodape }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Segoe UI", system-ui, Arial, sans-serif; color:#1f2a35; margin:0; }
  header { border-bottom: 3px solid #0b6e4f; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 18px; margin:0 0 2px; color:#0b2545; }
  .sub { font-size: 11px; color:#4d5a66; }
  .mapa img { width:100%; height:auto; border:1px solid #dde3e8; }
  footer { margin-top:10px; font-size:9px; color:#6b7a88; border-top:1px solid #dde3e8; padding-top:6px; }
</style></head><body>${corpoHtml}<footer>${escapar(rodape || "CENTRAL INFRA RO 360 — impressao gerada pelo usuario")}</footer></body></html>`;
}

/** Imprime um documento HTML em nova aba. */
export function imprimirHtml(html) {
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 600);
  return true;
}
