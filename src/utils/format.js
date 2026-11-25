/**
 * Utilitarios de formatacao (moeda, data, numero, texto) em padrao pt-BR.
 */

const fmtMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const fmtMoedaPrecisa = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});
const fmtNumero = new Intl.NumberFormat("pt-BR");
const fmtNumero1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const fmtPercentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function moeda(valor, precisa = false) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return precisa ? fmtMoedaPrecisa.format(valor) : fmtMoeda.format(valor);
}

/** Formata valores grandes de forma compacta (R$ 12,3 mi / R$ 1,2 bi). */
export function moedaCompacta(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  const abs = Math.abs(valor);
  if (abs >= 1e9) return `R$ ${fmtNumero1.format(valor / 1e9)} bi`;
  if (abs >= 1e6) return `R$ ${fmtNumero1.format(valor / 1e6)} mi`;
  if (abs >= 1e3) return `R$ ${fmtNumero1.format(valor / 1e3)} mil`;
  return fmtMoeda.format(valor);
}

export function numero(valor, casas = 0) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return casas ? fmtNumero1.format(valor) : fmtNumero.format(valor);
}

export function percentual(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return `${fmtPercentual.format(valor)}%`;
}

export function data(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtData.format(d);
}

export function dataCurta(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtDataCurta.format(d);
}

export function dataExtenso(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Converte "2024-01" em rotulo curto. */
export function mesAno(chave) {
  if (!chave) return "—";
  const [ano, mes] = chave.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(mes) - 1] ?? mes}/${String(ano).slice(2)}`;
}

export function slug(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function titulo(texto) {
  if (!texto) return "";
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/** Remove acentos e normaliza para comparacao/busca. */
export function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Escapa HTML — usado em templates construidos por string. */
export function escapar(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Trunca sem cortar palavras. */
export function resumir(texto, max = 160) {
  const t = (texto || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, t.lastIndexOf(" ", max) > 0 ? t.lastIndexOf(" ", max) : max)}…`;
}

/** Diferenca em dias entre duas datas ISO. */
export function diasEntre(isoA, isoB) {
  const a = new Date(`${isoA}T12:00:00`);
  const b = new Date(`${isoB}T12:00:00`);
  return Math.round((b - a) / 86400000);
}
