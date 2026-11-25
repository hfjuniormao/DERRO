import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes do servico de dados com o `fetch` simulado — validam que os
 * indicadores sao calculados a partir dos registros (nao de numeros soltos)
 * e que os filtros realmente recortam os conjuntos.
 */
const MUNICIPIOS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "1100203",
      properties: { codigo_ibge: "1100203", nome: "Porto Velho", uf: "RO", area_km2: 9000 },
      geometry: { type: "Polygon", coordinates: [[[-63, -9], [-62, -9], [-62, -8], [-63, -8], [-63, -9]]] },
    },
    {
      type: "Feature",
      id: "1100122",
      properties: { codigo_ibge: "1100122", nome: "Ji-Paraná", uf: "RO", area_km2: 3000 },
      geometry: { type: "Polygon", coordinates: [[[-63, -11], [-62, -11], [-62, -10], [-63, -10], [-63, -11]]] },
    },
  ],
};

const OBRAS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "OBR-1",
      properties: {
        id: "OBR-1",
        titulo: "Pavimentação - Porto Velho",
        categoria: "pavimentacao",
        categoria_nome: "Pavimentacao",
        municipio: "Porto Velho",
        municipio_codigo: "1100203",
        situacao: "em_execucao",
        valor_atualizado: 1000000,
        valor_inicial: 900000,
        percentual_execucao_fisica: 50,
        percentual_execucao_financeira: 40,
        dias_atraso: 0,
        data_inicio: "2025-01-01",
        data_fim_prevista: "2026-12-31",
      },
      geometry: { type: "Point", coordinates: [-63.9, -8.76] },
    },
    {
      type: "Feature",
      id: "OBR-2",
      properties: {
        id: "OBR-2",
        titulo: "Ponte - Ji-Paraná",
        categoria: "pontes",
        categoria_nome: "Pontes",
        municipio: "Ji-Paraná",
        municipio_codigo: "1100122",
        situacao: "atrasada",
        valor_atualizado: 2000000,
        valor_inicial: 2000000,
        percentual_execucao_fisica: 20,
        percentual_execucao_financeira: 30,
        dias_atraso: 120,
        data_inicio: "2024-01-01",
        data_fim_prevista: "2025-12-31",
      },
      geometry: { type: "Point", coordinates: [-63.02, -10.88] },
    },
  ],
};

const CONTRATOS = {
  contratos: [
    {
      id: "CT-1",
      objeto: "Obra de teste",
      contratada: "Construtora Exemplo (ficticia)",
      municipio: "Porto Velho",
      situacao: "vigente",
      valor_inicial: 1000000,
      valor_aditivos: 100000,
      valor_atualizado: 1100000,
      valor_empenhado: 800000,
      valor_liquidado: 500000,
      valor_pago: 400000,
      saldo: 700000,
      dias_para_vencer: 30,
      vigencia_inicio: "2025-01-01",
      vigencia_fim: "2026-12-31",
    },
  ],
};

async function mockFetch() {
  const mapa = {
    "municipios.geojson": MUNICIPIOS,
    "indicadores-municipais.json": {
      ano_populacao: 2022,
      ano_pib: 2023,
      municipios: {
        "1100203": { populacao: 200000, pib_milhoes: 12000 },
        "1100122": { populacao: 120000, pib_milhoes: 8000 },
      },
    },
    "obras-demo.geojson": OBRAS,
    "contratos-demo.json": CONTRATOS,
    "ativos-demo.geojson": { type: "FeatureCollection", features: [] },
    "convenios-demo.json": { convenios: [] },
    "maquinas-demo.json": { maquinas: [] },
    "vistorias-demo.json": { vistorias: [] },
    "serie-investimento-demo.json": { serie: [] },
    "vias-estaduais.geojson": { type: "FeatureCollection", features: [] },
    "rodovias.geojson": {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            codigo_snv: "364BRO1212",
            codigo_rodovia: "B-364",
            extensao_km: 24,
            jurisdicao: "Concessao Federal",
            status: "REAL",
          },
          geometry: { type: "LineString", coordinates: [[-63.9, -8.76], [-63.7, -8.9]] },
        },
      ],
    },
    "ambiente.geojson": {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { nome: "Rio Preto-Jacunda", categoria: "Reserva", status: "REAL" },
          geometry: { type: "Polygon", coordinates: [[[-63, -9], [-62, -9], [-62, -8], [-63, -8], [-63, -9]]] },
        },
      ],
    },
    "fontes.json": { fontes: [] },
  };
  global.fetch = vi.fn(async (url) => {
    const nome = String(url).split("/").pop();
    const conteudo = mapa[nome];
    if (!conteudo) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(conteudo)) };
  });
}

describe("servico de dados", () => {
  beforeEach(async () => {
    vi.resetModules();
    await mockFetch();
  });

  it("carrega as bases e classifica a origem dos dados", async () => {
    const mod = await import("../../src/services/data.js");
    const resultado = await mod.carregarDados();
    expect(resultado.estado).toBe("completo");
    expect(mod.dados.municipios).toHaveLength(2);
    expect(mod.dados.obras).toHaveLength(2);
    expect(mod.dados.obras[0].status).toBe("SIMULADO");
  });

  it("carrega as bases REAIS de malha rodoviaria e areas de protecao", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    // Features GeoJSON: os modulos leem `f.properties` e `f.geometry`.
    expect(mod.dados.rodovias).toHaveLength(1);
    expect(mod.dados.rodovias[0].properties.codigo_rodovia).toBe("B-364");
    expect(mod.dados.rodoviasExtensaoKm).toBe(24);
    expect(mod.dados.ambiente).toHaveLength(1);
    expect(mod.dados.ambiente[0].properties.nome).toBe("Rio Preto-Jacunda");
  });

  it("filtra obras por município", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    const recorte = mod.recortar({ municipio: "1100122", anoInicio: 2019, anoFim: 2026 });
    expect(recorte.obras).toHaveLength(1);
    expect(recorte.obras[0].id).toBe("OBR-2");
  });

  it("filtra obras por situação e por atraso", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    const recorte = mod.recortar({
      municipio: null,
      situacao: "atrasada",
      apenasAtrasados: true,
      anoInicio: 2019,
      anoFim: 2026,
    });
    expect(recorte.obras).toHaveLength(1);
    expect(recorte.obras[0].id).toBe("OBR-2");
  });

  it("calcula indicadores a partir dos registros", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    const filtros = { municipio: null, anoInicio: 2019, anoFim: 2026 };
    const indicadores = mod.calcularIndicadores(mod.recortar(filtros), filtros);
    expect(indicadores.obras).toBe(2);
    expect(indicadores.valorObras).toBe(3000000);
    expect(indicadores.municipiosAtendidos).toBe(2);
    expect(indicadores.execucaoMedia).toBeCloseTo(35, 1);
    expect(indicadores.populacaoAtendida).toBe(320000);
    expect(indicadores.situacoes.atrasada).toBe(1);
  });

  it("agrega por município ordenando por valor", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    const agrupado = mod.porMunicipio(mod.dados.obras);
    expect(agrupado[0].municipio).toBe("Ji-Paraná");
    expect(agrupado[0].valor).toBe(2000000);
  });

  it("monta a ficha do município com indicadores e registros", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    const ficha = mod.fichaMunicipio("1100203");
    expect(ficha.municipio.nome).toBe("Porto Velho");
    expect(ficha.indicadores.populacao).toBe(200000);
    expect(ficha.obras).toHaveLength(1);
  });

  it("busca registros na base local", async () => {
    const mod = await import("../../src/services/data.js");
    await mod.carregarDados();
    const resultados = mod.buscar("ji-paraná");
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].tipo).toBe("municipio");
  });
});
