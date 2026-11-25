import { describe, expect, it } from "vitest";
import {
  moeda,
  moedaCompacta,
  numero,
  percentual,
  data,
  dataExtenso,
  mesAno,
  normalizar,
  resumir,
  slug,
  titulo,
  diasEntre,
} from "../../src/utils/format.js";

describe("formatacao de moeda", () => {
  it("formata valores em real", () => {
    expect(moeda(1234.56)).toContain("R$");
    expect(moeda(1234.56, true)).toContain("1.234,56");
  });

  it("usa compactacao para valores grandes", () => {
    expect(moedaCompacta(1_500_000)).toBe("R$ 1,5 mi");
    expect(moedaCompacta(2_000_000_000)).toBe("R$ 2,0 bi");
    expect(moedaCompacta(900)).toBe(moeda(900));
  });

  it("trata valores ausentes", () => {
    expect(moeda(null)).toBe("—");
    expect(moedaCompacta(undefined)).toBe("—");
    expect(numero(null)).toBe("—");
    expect(percentual(Number.NaN)).toBe("—");
  });
});

describe("formatacao de numeros", () => {
  it("usa separador brasileiro", () => {
    expect(numero(1234567)).toBe("1.234.567");
    expect(numero(12.34, 1)).toBe("12,3");
  });
});

describe("formatacao de datas", () => {
  it("formata ISO em dd/mm/aaaa", () => {
    expect(data("2026-11-25")).toBe("25/11/2026");
    expect(dataExtenso("2026-11-25")).toContain("novembro");
  });

  it("devolve marcador para datas invalidas", () => {
    expect(data("")).toBe("—");
    expect(data("sem-data")).toBe("—");
  });

  it("formata mes/ano", () => {
    expect(mesAno("2026-03")).toBe("mar/26");
  });

  it("calcula diferenca em dias", () => {
    expect(diasEntre("2026-01-01", "2026-01-31")).toBe(30);
  });
});

describe("texto", () => {
  it("normaliza acentos", () => {
    expect(normalizar("Ji-Paraná")).toBe("ji-parana");
    expect(normalizar("Porto Velho")).toBe("porto velho");
  });

  it("gera slugs", () => {
    expect(slug("Gestão de Contratos")).toBe("gestao-de-contratos");
  });

  it("capitaliza sem quebrar o resto", () => {
    expect(titulo("obras públicas")).toBe("Obras públicas");
  });

  it("resume sem cortar palavras", () => {
    const texto = "Gestão de obras públicas do estado de Rondônia";
    expect(resumir(texto, 20).endsWith("…")).toBe(true);
    expect(resumir(texto, 200)).toBe(texto);
  });
});
