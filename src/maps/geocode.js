/**
 * Servico de geocodificacao e pesquisa cartografica.
 *
 * Combina:
 *  - base local (municipios de RO e codigos de rodovia do SNV);
 *  - geocodificador oficial da Esri (enderecos e topônimos);
 *  - busca por coordenadas ("lat, lon" / "-63.0 -11.0").
 *
 * Nenhum endereço inventado: resultados sempre trazem a fonte e o score.
 */
import { config } from "../config.js";
import { dados } from "../services/data.js";
import { normalizar } from "../utils/format.js";

const GEOCODIFICADOR = config.servicos.geocodificador;

/** Interpreta "lat, lon", "lon, lat" ou "lat lon" como coordenadas. */
export function interpretarCoordenadas(texto) {
  if (!texto) return null;
  const numeros = String(texto)
    .replace(/[;]/g, ",")
    .split(/[\s,]+/)
    .map((parte) => parte.replace(/[°º]/g, "").trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  if (numeros.length !== 2) return null;
  let [a, b] = numeros;
  // Em Rondônia: latitude negativa, longitude negativa. O primeiro numero com
  // valor absoluto > 90 e obrigatoriamente a longitude.
  let lon = a;
  let lat = b;
  if (Math.abs(a) > 90 || (Math.abs(b) <= 90 && Math.abs(a) > Math.abs(b))) {
    lon = b;
    lat = a;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat > 0) return null; // Rondonia esta no hemisferio sul
  return { lon, lat };
}

/** Pesquisa local: municipios e rodovias do estado. */
export function buscarLocal(termo, limite = 8) {
  const alvo = normalizar(termo);
  if (alvo.length < 2) return [];
  const resultados = [];

  dados.municipios.forEach((m) => {
    if (normalizar(m.nome).includes(alvo)) {
      resultados.push({
        tipo: "municipio",
        id: m.codigo_ibge,
        titulo: m.nome,
        detalhe: "Município de Rondônia",
        posicao: m.centroide || null,
        fonte: "IBGE (limites oficiais)",
        status: "REAL",
      });
    }
  });

  const codigos = new Set();
  (dados.rodovias || []).forEach((r) => {
    const codigo = r.properties?.codigo_rodovia;
    if (codigo) codigos.add(codigo);
  });
  (dados.obras || []).forEach((o) => o.rodovia && codigos.add(o.rodovia));
  [...codigos].forEach((codigo) => {
    if (normalizar(codigo).includes(alvo)) {
      resultados.push({
        tipo: "rodovia",
        id: codigo,
        titulo: codigo,
        detalhe: "Rodovia estadual/federal",
        posicao: null,
        fonte: "SNV (DNIT) / malha viária",
        status: "REAL",
      });
    }
  });

  return resultados.slice(0, limite);
}

/** Geocodificacao no servico oficial da Esri. */
export async function geocodificar(termo, limite = 5) {
  const url = `${GEOCODIFICADOR}/findAddressCandidates?${new URLSearchParams({
    SingleLine: termo,
    f: "json",
    maxCandidates: String(limite),
    outFields: "Match_addr,Addr_type,Region,Postal,Country",
  })}`;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const json = await resposta.json();
    return (json.candidates || []).map((candidato) => ({
      tipo: "endereco",
      id: candidato.address,
      titulo: candidato.address,
      detalhe: [candidato.attributes?.Region, candidato.attributes?.Postal].filter(Boolean).join(" · "),
      posicao: [candidato.location.x, candidato.location.y],
      score: candidato.score,
      fonte: "Esri — World Geocoding Service",
      status: "REAL",
    }));
  } catch (erro) {
    console.warn("[geocode] falha na geocodificacao:", erro);
    return [];
  }
}

/** Sugestoes para a busca incremental (servico suggest da Esri). */
export async function sugerir(termo, limite = 6) {
  if (!termo || termo.length < 2) return [];
  const url = `${config.servicos.sugestao}?${new URLSearchParams({
    text: termo,
    f: "json",
    maxSuggestions: String(limite),
    countryCode: "BRA",
  })}`;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return [];
    const json = await resposta.json();
    return (json.suggestions || []).map((s) => ({
      tipo: "sugestao",
      id: s.magicKey,
      titulo: s.text,
      detalhe: "Sugestão do geocodificador Esri",
      posicao: null,
      fonte: "Esri — suggest",
      status: "REAL",
    }));
  } catch {
    return [];
  }
}

/** Pesquisa completa: local + coordenadas + enderecos. */
export async function pesquisar(termo) {
  const coordenadas = interpretarCoordenadas(termo);
  if (coordenadas) {
    return [
      {
        tipo: "coordenada",
        id: `${coordenadas.lat}, ${coordenadas.lon}`,
        titulo: `${coordenadas.lat.toFixed(5)}, ${coordenadas.lon.toFixed(5)}`,
        detalhe: "Coordenada informada (WGS84)",
        posicao: [coordenadas.lon, coordenadas.lat],
        fonte: "Interpretação local",
        status: "REAL",
      },
    ];
  }
  const locais = buscarLocal(termo);
  if (locais.length) return locais;
  return geocodificar(termo);
}
