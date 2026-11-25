/**
 * Utilitarios geoespaciais compartilhados pelos modulos analiticos
 * (logistica, meioambiente, planejamento, geoai).
 *
 * Tudo aqui e computacao LOCAL e deterministica sobre a geometria real
 * carregada em /data. Nenhuma chamada de rede e nenhum servico licenciado.
 */

/* --------------------------------------------------------------- medidas */

const RAIO_TERRA_KM = 6371.0088;

/** Distancia geodesica (haversine) entre dois pontos [lon, lat]. Retorna km. */
export function distanciaHaversine(a, b) {
  if (!a || !b) return NaN;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const r1 = (lat1 * Math.PI) / 180;
  const r2 = (lat2 * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Comprimento geodesico de uma linha [lon, lat] em km. */
export function comprimentoLinha(pontos) {
  let total = 0;
  for (let i = 1; i < pontos.length; i += 1) total += distanciaHaversine(pontos[i - 1], pontos[i]);
  return total;
}

/* --------------------------------------------------------- geometria 2D */

/**
 * Teste ponto-em-anel (ray casting) — o anel e fechado ou nao, o algoritmo
 * considera o ultimo ponto igual ao primeiro.
 */
export function pontoEmAnel(lon, lat, anel) {
  if (!anel || anel.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const xi = anel[i][0];
    const yi = anel[i][1];
    const xj = anel[j][0];
    const yj = anel[j][1];
    const cruza = yi > lat !== yj > lat;
    if (cruza && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Ponto em geometria GeoJSON (Polygon com furacos ou MultiPolygon). */
export function pontoEmGeometria(lon, lat, geometria) {
  if (!geometria) return false;
  const tipo = geometria.type;
  if (tipo === "Polygon") {
    const aneis = geometria.coordinates || [];
    if (!aneis.length || !pontoEmAnel(lon, lat, aneis[0])) return false;
    for (let i = 1; i < aneis.length; i += 1) {
      if (pontoEmAnel(lon, lat, aneis[i])) return false;
    }
    return true;
  }
  if (tipo === "MultiPolygon") {
    return (geometria.coordinates || []).some((poligono) => pontoEmGeometria(lon, lat, { type: "Polygon", coordinates: poligono }));
  }
  if (tipo === "Feature") return pontoEmGeometria(lon, lat, geometria.geometry);
  if (tipo === "FeatureCollection") {
    return (geometria.features || []).some((f) => pontoEmGeometria(lon, lat, f));
  }
  return false;
}

/** Centroide (media dos vertices) de um anel. */
export function centroideAnel(anel) {
  if (!anel || !anel.length) return null;
  let somaX = 0;
  let somaY = 0;
  anel.forEach((p) => {
    somaX += p[0];
    somaY += p[1];
  });
  return [somaX / anel.length, somaY / anel.length];
}

/**
 * Centroide areal (shoelace) de um poligono — mais representativo que a
 * media dos vertices para objetos alongados.
 */
export function centroidePoligono(geometria) {
  if (!geometria) return null;
  const anel =
    geometria.type === "Polygon"
      ? geometria.coordinates[0]
      : geometria.type === "MultiPolygon"
        ? geometria.coordinates[0][0]
        : null;
  if (!anel || anel.length < 3) return null;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const xi = anel[i][0];
    const yi = anel[i][1];
    const xj = anel[j][0];
    const yj = anel[j][1];
    const k = xi * yj - xj * yi;
    area += k;
    cx += (xi + xj) * k;
    cy += (yi + yj) * k;
  }
  area *= 0.5;
  if (!area) return centroideAnel(anel);
  return [cx / (6 * area), cy / (6 * area)];
}

/** Envelope [xmin, ymin, xmax, ymax] de uma geometria/anel. */
export function envelopeGeometria(geometria) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const percorrer = (parte) => {
    const pontos = Array.isArray(parte[0][0]) ? parte.flat() : parte;
    pontos.forEach((p) => {
      if (!p) return;
      const [x, y] = p;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
  };
  if (!geometria) return null;
  if (geometria.type === "Polygon") percorrer(geometria.coordinates[0]);
  else if (geometria.type === "MultiPolygon") geometria.coordinates.forEach((p) => percorrer(p[0]));
  else if (geometria.type === "LineString") percorrer(geometria.coordinates);
  else if (geometria.type === "MultiLineString") geometria.coordinates.forEach(percorrer);
  else if (geometria.type === "Feature") return envelopeGeometria(geometria.geometry);
  return [minX, minY, maxX, maxY];
}

/** Distancia (km) de um ponto a um segmento [a, b]. */
export function distanciaPontoSegmento(ponto, a, b) {
  const [px, py] = ponto;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return distanciaHaversine(ponto, [cx, cy]);
}

/* --------------------------------------------------------- simplificacao */

/**
 * Simplificacao de Douglas-Peucker (tolerancia em graus).
 * Reduz a geometria SNV (110 mil vertices) para uma rede navegavel.
 */
export function simplificarLinha(pontos, tolerancia = 0.0006) {
  if (!pontos || pontos.length < 3) return pontos ? [...pontos] : [];
  const manter = new Array(pontos.length).fill(false);
  manter[0] = true;
  manter[pontos.length - 1] = true;
  const pilha = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [inicio, fim] = pilha.pop();
    const [ax, ay] = pontos[inicio];
    const [bx, by] = pontos[fim];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maior = -1;
    let indice = -1;
    for (let k = inicio + 1; k < fim; k += 1) {
      const [px, py] = pontos[k];
      let distancia;
      if (len2 === 0) distancia = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx;
        const cy = ay + t * dy;
        distancia = (px - cx) ** 2 + (py - cy) ** 2;
      }
      if (distancia > maior) {
        maior = distancia;
        indice = k;
      }
    }
    if (maior > tolerancia * tolerancia) {
      manter[indice] = true;
      pilha.push([inicio, indice], [indice, fim]);
    }
  }
  return pontos.filter((_, i) => manter[i]);
}

/* ------------------------------------------------------- rede rodoviaria */

/** Aceita (ponto [lon, lat]) ou (lon, lat) e devolve [lon, lat]. */
function normalizarPonto(ponto, lat) {
  if (Array.isArray(ponto)) return [Number(ponto[0]), Number(ponto[1])];
  return [Number(ponto), Number(lat)];
}

/**
 * Constroi uma rede rodoviaria navegavel a partir de trechos (linhas).
 *
 * @param {Array} trechos [{ id, codigo, pontos: [[lon,lat]...], comprimento }]
 * @param {object} opcoes { tolerancia: graus para amalgamacao de nos }
 * @returns {object} { nos, arestas, adjacencia, componentes, totalKm }
 */
export function construirRedeRodoviaria(trechos, opcoes = {}) {
  const tolerancia = opcoes.tolerancia ?? 0.0022; // ~240 m
  const nos = new Map();
  const grade = new Map();
  const arestas = [];

  const chaveGrade = (lon, lat) => `${Math.round(lon / tolerancia)}:${Math.round(lat / tolerancia)}`;

  function registrarNo(lon, lat) {
    const cx = Math.round(lon / tolerancia);
    const cy = Math.round(lat / tolerancia);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const lista = grade.get(`${cx + dx}:${cy + dy}`);
        if (!lista) continue;
        for (const id of lista) {
          const no = nos.get(id);
          if (distanciaHaversine([lon, lat], no.ponto) * 1000 <= tolerancia * 111320 * 0.6) return id;
        }
      }
    }
    const id = nos.size;
    nos.set(id, { id, ponto: [lon, lat], arestas: [] });
    const chave = chaveGrade(lon, lat);
    if (!grade.has(chave)) grade.set(chave, []);
    grade.get(chave).push(id);
    return id;
  }

  trechos.forEach((trecho) => {
    const pontos = simplificarLinha(trecho.pontos, opcoes.toleranciaSimplificacao ?? 0.0006);
    if (pontos.length < 2) return;
    let anterior = registrarNo(pontos[0][0], pontos[0][1]);
    for (let i = 1; i < pontos.length; i += 1) {
      const atual = registrarNo(pontos[i][0], pontos[i][1]);
      if (atual === anterior) continue;
      const comprimento = distanciaHaversine(pontos[i - 1], pontos[i]);
      if (comprimento <= 0) continue;
      const aresta = { a: anterior, b: atual, comprimento, trecho: trecho.id, codigo: trecho.codigo };
      arestas.push(aresta);
      nos.get(anterior).arestas.push(aresta);
      nos.get(atual).arestas.push(aresta);
      anterior = atual;
    }
  });

  const adjacencia = new Map();
  nos.forEach((no) => adjacencia.set(no.id, []));
  arestas.forEach((aresta) => {
    adjacencia.get(aresta.a).push({ vizinho: aresta.b, comprimento: aresta.comprimento, aresta });
    adjacencia.get(aresta.b).push({ vizinho: aresta.a, comprimento: aresta.comprimento, aresta });
  });

  const componentes = contarComponentes(adjacencia);
  const totalKm = arestas.reduce((acc, a) => acc + a.comprimento, 0);

  /**
   * Liga componentes desconectados da malha oficial por pares de nos proximos.
   * A base SNV nao e topologicamente continua (digicao por trecho), por isso
   * a rede oficial chega em N pedacos. As ligacoes criadas aqui sao APROXIMADAS
   * e ficam marcadas como `aproximada: true` para serem divulgadas na interface.
   */
  function conectarComponentes(limiarKm = 2) {
    const rotulo = new Map();
    let contador = 0;
    for (const [id] of nos) {
      if (rotulo.has(id)) continue;
      const fila = [id];
      rotulo.set(id, contador);
      while (fila.length) {
        const no = fila.pop();
        (adjacencia.get(no) || []).forEach((vizinho) => {
          if (!rotulo.has(vizinho.vizinho)) {
            rotulo.set(vizinho.vizinho, contador);
            fila.push(vizinho.vizinho);
          }
        });
      }
      contador += 1;
    }
    const grupos = new Map();
    rotulo.forEach((cid, id) => {
      if (!grupos.has(cid)) grupos.set(cid, []);
      grupos.get(cid).push(id);
    });
    const principal = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!principal) return { ligacoes: 0, componentes: grupos.size };

    let ligacoes = 0;
    let restantes = grupos.size - 1;
    while (restantes > 0) {
      let melhorOpcao = null;
      grupos.forEach((ids, cid) => {
        if (cid === principal[0] || ids.length === 0) return;
        ids.forEach((a) => {
          const pa = nos.get(a).ponto;
          principal[1].forEach((b) => {
            const d = distanciaHaversine(pa, nos.get(b).ponto);
            if (!melhorOpcao || d < melhorOpcao.distancia) {
              melhorOpcao = { a, b, distancia: d, cid };
            }
          });
        });
      });
      if (!melhorOpcao || melhorOpcao.distancia > limiarKm) break;
      const aresta = {
        a: melhorOpcao.a,
        b: melhorOpcao.b,
        comprimento: melhorOpcao.distancia,
        trecho: `LIGACAO-${melhorOpcao.cid}`,
        codigo: "Ligação aproximada",
        aproximada: true,
      };
      arestas.push(aresta);
      adjacencia.get(aresta.a).push({ vizinho: aresta.b, comprimento: aresta.comprimento, aresta });
      adjacencia.get(aresta.b).push({ vizinho: aresta.a, comprimento: aresta.comprimento, aresta });
      ligacoes += 1;
      restantes -= 1;
      // move os nos do componente ligado para o grupo principal
      const movidos = grupos.get(melhorOpcao.cid);
      movidos.forEach((id) => principal[1].push(id));
      grupos.delete(melhorOpcao.cid);
    }
    return { ligacoes, componentes: grupos.size };
  }

  return {
    nos,
    arestas,
    adjacencia,
    componentes,
    totalKm,
    tolerancia,
    conectarComponentes,
    /** No da rede mais proximo de um ponto [lon, lat] (ou lon, lat). */
    noMaisProximo(ponto, lat) {
      const [lon, la] = normalizarPonto(ponto, lat);
      if (!Number.isFinite(lon) || !Number.isFinite(la)) return null;
      let melhor = null;
      let melhorDistancia = Infinity;
      nos.forEach((no) => {
        const d = distanciaHaversine([lon, la], no.ponto);
        if (d < melhorDistancia) {
          melhorDistancia = d;
          melhor = no;
        }
      });
      return melhor ? { no: melhor, distanciaKm: melhorDistancia } : null;
    },
    /** Distancia (km) do ponto ate a malha (segmento mais proximo). */
    distanciaAteMalha(ponto, lat) {
      const [lon, la] = normalizarPonto(ponto, lat);
      let minima = Infinity;
      let trecho = null;
      arestas.forEach((aresta) => {
        const pa = nos.get(aresta.a).ponto;
        const pb = nos.get(aresta.b).ponto;
        const d = distanciaPontoSegmento([lon, la], pa, pb);
        if (d < minima) {
          minima = d;
          trecho = aresta;
        }
      });
      return { distanciaKm: minima, trecho };
    },
    /** Caminho mais curto (Dijkstra) entre dois nos. */
    caminhoMaisCurto(origem, destino) {
      if (origem === null || destino === null) return null;
      if (origem === destino) return { distanciaKm: 0, nos: [origem], arestas: [] };
      const distancias = new Map();
      const anteriores = new Map();
      const visitados = new Set();
      const fila = [[0, origem]];
      while (fila.length) {
        fila.sort((a, b) => a[0] - b[0]);
        const [custo, no] = fila.shift();
        if (visitados.has(no)) continue;
        visitados.add(no);
        if (no === destino) break;
        const vizinhos = adjacencia.get(no) || [];
        for (const vizinho of vizinhos) {
          if (visitados.has(vizinho.vizinho)) continue;
          const novoCusto = custo + vizinho.comprimento;
          if (novoCusto < (distancias.get(vizinho.vizinho) ?? Infinity)) {
            distancias.set(vizinho.vizinho, novoCusto);
            anteriores.set(vizinho.vizinho, { no, aresta: vizinho.aresta });
            fila.push([novoCusto, vizinho.vizinho]);
          }
        }
      }
      if (!distancias.has(destino)) return null;
      const caminho = [destino];
      const arestasCaminho = [];
      let cursor = destino;
      while (cursor !== origem) {
        const anterior = anteriores.get(cursor);
        if (!anterior) return null;
        arestasCaminho.unshift(anterior.aresta);
        caminho.unshift(anterior.no);
        cursor = anterior.no;
      }
      return { distanciaKm: distancias.get(destino), nos: caminho, arestas: arestasCaminho };
    },
  };
}

function contarComponentes(adjacencia) {
  let contador = 0;
  const visitados = new Set();
  adjacencia.forEach((_, raiz) => {
    if (visitados.has(raiz)) return;
    contador += 1;
    const pilha = [raiz];
    visitados.add(raiz);
    while (pilha.length) {
      const no = pilha.pop();
      (adjacencia.get(no) || []).forEach((vizinho) => {
        if (visitados.has(vizinho.vizinho)) return;
        visitados.add(vizinho.vizinho);
        pilha.push(vizinho.vizinho);
      });
    }
  });
  return contador;
}

/**
 * Extrai os trechos da malha rodoviaria real (SNV + vias estaduais) das bases
 * carregadas em `dados`. Retorna a lista normalizada usada pela rede e pela
 * medicao de malha por municipio.
 */
export function trechosDaMalhaReal(dados) {
  const trechos = [];
  (dados?.rodovias || []).forEach((f) => {
    const p = f.properties || {};
    const coordenadas = f.geometry?.coordinates;
    if (!Array.isArray(coordenadas) || coordenadas.length < 2) return;
    trechos.push({
      id: p.codigo_snv || f.id,
      codigo: p.codigo_rodovia || "SNV",
      pontos: coordenadas,
      kmOficial: p.extensao_km || 0,
      tipo: "federal",
    });
  });
  (dados?.viasEstaduais || []).forEach((f) => {
    const geometria = f.geometry || {};
    const partes = geometria.type === "MultiLineString" ? geometria.coordinates : [geometria.coordinates];
    partes
      .filter((p) => Array.isArray(p) && p.length > 1)
      .forEach((p, i) => {
        trechos.push({
          id: `${f.properties?.codigo_rodovia || "RO"}-${i}`,
          codigo: f.properties?.codigo_rodovia || "RO",
          pontos: p,
          kmOficial: 0,
          tipo: "estadual",
        });
      });
  });
  return trechos;
}

/**
 * Aproxima o comprimento (km) da malha dentro de cada municipio por
 * amostragem de pontos sobre a geometria real (SNV + vias estaduais).
 * O valor e uma ESTIMATIVA BASICA, nao um cadastro oficial.
 */
export function malhaPorMunicipio(trechos, municipios, passoKm = 2) {
  // Aceita `codigo_ibge` (padrao das bases IBGE) ou `codigo` (mapeamentos
  // proprios dos modulos) como chave do municipio.
  const chaveDe = (m) => m.codigo_ibge ?? m.codigo;

  const total = new Map();
  municipios.forEach((m) => total.set(chaveDe(m), 0));

  const distanceAcumulada = new Map();
  trechos.forEach((trecho) => {
    const pontos = simplificarLinha(trecho.pontos, 0.0012);
    for (let i = 1; i < pontos.length; i += 1) {
      const a = pontos[i - 1];
      const b = pontos[i];
      const trechoKm = distanciaHaversine(a, b);
      if (trechoKm <= 0) continue;
      const amostras = Math.max(1, Math.round(trechoKm / passoKm));
      for (let k = 0; k < amostras; k += 1) {
        const t = (k + 0.5) / amostras;
        const lon = a[0] + (b[0] - a[0]) * t;
        const lat = a[1] + (b[1] - a[1]) * t;
        const municipio = municipios.find((m) => {
          const geo = m.geometria;
          if (!geo) return false;
          const env = envelopeGeometria(geo);
          if (!env) return false;
          if (lon < env[0] || lon > env[2] || lat < env[1] || lat > env[3]) return false;
          return pontoEmGeometria(lon, lat, geo);
        });
        if (!municipio) continue;
        const chave = `${chaveDe(municipio)}`;
        const acumulado = distanceAcumulada.get(chave) || 0;
        distanceAcumulada.set(chave, acumulado + trechoKm / amostras);
      }
    }
  });

  distanceAcumulada.forEach((valor, chave) => total.set(Number(chave), valor));
  return total;
}

/**
 * Area de um poligono em km2 (excesso esferico, usada pelo IBGE).
 * @param {object} geometria GeoJSON Polygon ou MultiPolygon
 */
export function areaPoligono(geometria) {
  if (!geometria) return 0;
  const R = 6371.0088;
  let total = 0;
  const calcularAnel = (anel) => {
    let soma = 0;
    for (let i = 0; i < anel.length - 1; i += 1) {
      const [lon1, lat1] = anel[i];
      const [lon2, lat2] = anel[i + 1];
      soma +=
        ((lon2 - lon1) * Math.PI) / 180 *
        (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
    }
    return Math.abs((soma * R * R) / 2);
  };
  if (geometria.type === "Polygon") {
    total = calcularAnel(geometria.coordinates[0]);
    for (let i = 1; i < (geometria.coordinates || []).length; i += 1) {
      total -= calcularAnel(geometria.coordinates[i]);
    }
  } else if (geometria.type === "MultiPolygon") {
    (geometria.coordinates || []).forEach((poligono) => {
      total += calcularAnel(poligono[0]);
    });
  }
  return total;
}

/** Normaliza uma serie em 0..1 (min-max). */
export function normalizarSerie(valores) {
  const numeros = valores.filter((v) => Number.isFinite(v));
  if (!numeros.length) return () => 0;
  const min = Math.min(...numeros);
  const max = Math.max(...numeros);
  if (max === min) return () => 1;
  return (valor) => {
    if (!Number.isFinite(valor)) return 0;
    return (valor - min) / (max - min);
  };
}
