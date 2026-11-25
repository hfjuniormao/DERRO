import { beforeEach, describe, expect, it } from "vitest";
import { store, definirFiltros, limparFiltros, selecionar, limparSelecao } from "../../src/services/state.js";

describe("store de estado", () => {
  beforeEach(() => {
    store.definir({
      filtros: {
        municipio: null,
        municipioNome: null,
        categoria: null,
        situacao: null,
        rodovia: null,
        orgao: null,
        fonteRecurso: null,
        anoInicio: 2019,
        anoFim: 2026,
        apenasAtrasados: false,
        apenasCriticos: false,
        busca: "",
      },
      selecao: null,
    });
  });

  it("notifica os inscritos na chave alterada", () => {
    let chamadas = 0;
    const cancelar = store.inscrever("filtros", () => {
      chamadas += 1;
    });
    definirFiltros({ municipio: "1100203" });
    expect(chamadas).toBe(1);
    expect(store.obter("filtros").municipio).toBe("1100203");
    cancelar();
    definirFiltros({ municipio: null });
    expect(chamadas).toBe(1);
  });

  it("preserva os demais filtros ao alterar um campo", () => {
    definirFiltros({ anoInicio: 2020 });
    definirFiltros({ situacao: "atrasada" });
    expect(store.obter("filtros").anoInicio).toBe(2020);
    expect(store.obter("filtros").situacao).toBe("atrasada");
  });

  it("limpa filtros mantendo o periodo", () => {
    definirFiltros({ anoInicio: 2021, anoFim: 2024, municipio: "1100203" });
    limparFiltros();
    expect(store.obter("filtros").municipio).toBeNull();
    expect(store.obter("filtros").anoInicio).toBe(2021);
    expect(store.obter("filtros").anoFim).toBe(2024);
  });

  it("controla a selecao ativa", () => {
    selecionar("obra", "OBR-1");
    expect(store.obter("selecao")).toEqual({ tipo: "obra", id: "OBR-1" });
    limparSelecao();
    expect(store.obter("selecao")).toBeNull();
  });
});
