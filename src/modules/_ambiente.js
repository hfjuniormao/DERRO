/**
 * Areas de protecao e cruzamento espacial com as obras.
 *
 * As areas vem de data/ambiente.geojson (geometria oficial, status REAL).
 * O cruzamento e SIMPLES: conta os pontos de obra contidos em cada poligono
 * (ponto-em-poligono local). Serve como leitura exploratoria e nao substitui
 * pareceres ambientais oficiais.
 */
import { dados, caminhoDados } from "../services/data.js";
import { pontoEmGeometria, centroidePoligono, distanciaHaversine, areaPoligono } from "./_geoespacial.js";

let cacheAreas = null;

/** Carrega (uma vez) as areas de protecao com geometria oficial. */
export async function areasAmbiente() {
  if (cacheAreas) return cacheAreas;

  const doStore = dados.ambiente || [];
  let features = doStore;
  if (!features.length) {
    try {
      const resposta = await fetch(caminhoDados("ambiente.geojson"), { cache: "no-cache" });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const geojson = await resposta.json();
      features = geojson.features || [];
    } catch (erro) {
      console.warn("[ambiente] falha ao carregar as áreas de proteção:", erro);
      features = [];
    }
  }

  cacheAreas = features.map((f) => ({
    nome: f.properties?.nome || "Área sem nome",
    categoria: f.properties?.categoria || "Não classificada",
    jurisdicao: f.properties?.jurisdicao || "—",
    ano: f.properties?.ano_criacao || "—",
    status: f.properties?.status || "REAL",
    geometria: f.geometry,
    centro: centroidePoligono(f.geometry),
    areaKm2: Number(areaPoligono(f.geometry).toFixed(1)),
  }));
  return cacheAreas;
}

/**
 * Cruza as obras (com ponto de cadastro) com as areas de protecao.
 * @returns {{ areas: Array, riscoPorObra: Map<string, {dentro:boolean, distanciaKm:number|null}> }}
 */
export function cruzarObrasComAreas(obras, areas) {
  const pontos = obras
    .map((obra) => ({
      obra,
      lon: obra.localizacao?.lon ?? obra.geometria?.coordinates?.[0],
      lat: obra.localizacao?.lat ?? obra.geometria?.coordinates?.[1],
    }))
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));

  const riscoPorObra = new Map();

  const resultado = areas.map((area) => {
    const dentro = pontos.filter((p) => pontoEmGeometria(p.lon, p.lat, area.geometria));
    dentro.forEach((p) => {
      const atual = riscoPorObra.get(p.obra.id) || { dentro: false, distanciaKm: null };
      atual.dentro = true;
      atual.distanciaKm = 0;
      riscoPorObra.set(p.obra.id, atual);
    });

    let maisProxima = null;
    if (area.centro) {
      pontos.forEach((p) => {
        const d = distanciaHaversine(area.centro, [p.lon, p.lat]);
        if (!maisProxima || d < maisProxima.distancia) {
          maisProxima = { obra: p.obra, distancia: d };
        }
      });
      if (maisProxima) {
        const atual = riscoPorObra.get(maisProxima.obra.id) || { dentro: false, distanciaKm: null };
        if (atual.distanciaKm === null) atual.distanciaKm = Number(maisProxima.distancia.toFixed(1));
        riscoPorObra.set(maisProxima.obra.id, atual);
      }
    }

    return {
      nome: area.nome,
      categoria: area.categoria,
      jurisdicao: area.jurisdicao,
      ano: area.ano,
      areaKm2: area.areaKm2,
      obrasDentro: dentro.length,
      obras: dentro.map((p) => p.obra),
      obraProxima: maisProxima?.obra?.id || "—",
      obraProximaTitulo: maisProxima?.obra?.titulo || "—",
      obraProximaMunicipio: maisProxima?.obra?.municipio || "—",
      distanciaProxima: maisProxima ? Number(maisProxima.distancia.toFixed(1)) : null,
    };
  });

  return { areas: resultado, riscoPorObra };
}

/**
 * Classifica o risco socioambiental de uma obra.
 * 1,0 = dentro de area de protecao; 0,6 = a menos de 15 km; 0,15 = demais.
 */
export function classificarRiscoAmbiental(registroRisco) {
  if (!registroRisco) return 0.15;
  if (registroRisco.dentro) return 1;
  if (registroRisco.distanciaKm !== null && registroRisco.distanciaKm <= 15) return 0.6;
  return 0.15;
}
