#!/usr/bin/env python3
"""
CENTRAL INFRA RO 360 — Pipeline de dados REAIS.

Coleta dados de fontes oficiais / servicos publicos e grava em `data/`.

Fontes (todas publicas, sem credencial):
  1. geoBoundaries BRA ADM2 (malha municipal do IBGE 2020, CC BY 3.0 IGO)
     -> limites dos 52 municipios de Rondonia
  2. API de Localidades do IBGE -> codigo oficial e nome oficial dos municipios
  3. SIDRA/IBGE tabela 6579 (populacao residente, Censo 2022)
  4. SIDRA/IBGE tabela 5938 (PIB municipal)
  5. FeatureServer "Rodovias" (SNV 202604A) -> trechos com codigo BR, km,
     extensao, superficie e jurisdicao
  6. FeatureServer "Rondonia_Roads" -> malha viaria estadual (segmentos RO-xxx)

Nada e inventado: o script apenas busca, filtra, simplifica e valida.
"""
from __future__ import annotations

import json
import math
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, "data")
CACHE = os.path.join(RAIZ, "scripts", ".cache")
UA = "Mozilla/5.0 (CentralInfraRO360/1.0)"
CTX = ssl.create_default_context()

FS_SNV = (
    "https://services8.arcgis.com/WnoZVgMq9I8Pjaoc/arcgis/rest/services/"
    "Rodovias/FeatureServer/0"
)
FS_AREAS_PROT = (
    "https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/"
    "Rondonia_Protected_Forests/FeatureServer/0"
)
FS_VIAS_RO = (
    "https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/"
    "Rondonia_Roads/FeatureServer/0"
)
IBGE_LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
IBGE_SIDRA = "https://apisidra.ibge.gov.br/values/t/{tabela}/n6/{codigo}"
GB_API = "https://www.geoboundaries.org/api/current/gbOpen/BRA/ADM2/"

# Extensao territorial oficial de Rondonia (IBGE/DER-RO) usada como filtro espacial.
RO_BBOX = (-74.6, -14.2, -59.0, -7.4)
RO_AREA_OFICIAL_KM2 = 237_590.547  # IBGE (Wikipedia/IBGE Cidades) — area total do estado


def log(msg):
    print(msg, flush=True)


def http_json(url: str, tries: int = 4, timeout: int = 90):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Falha ao obter {url}: {last}")


def baixar(url: str, destino: str, tries: int = 4) -> str:
    """Download com retentativa (servicos publicos cortam conexao)."""
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    if os.path.exists(destino) and os.path.getsize(destino) > 1000:
        log(f"  cache: {os.path.relpath(destino, RAIZ)}")
        return destino
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300, context=CTX) as r:
                dados = r.read()
            with open(destino, "wb") as fh:
                fh.write(dados)
            log(f"  baixado: {os.path.relpath(destino, RAIZ)} ({len(dados)/1024/1024:.1f} MB)")
            return destino
        except Exception as exc:  # noqa: BLE001
            last = exc
            log(f"  retry {attempt+1}: {exc}")
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Falha no download {url}: {last}")


def salvar(nome: str, obj, indent=None) -> str:
    os.makedirs(DATA, exist_ok=True)
    caminho = os.path.join(DATA, nome)
    with open(caminho, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":") if indent is None else (",", ": "), indent=indent)
    log(f"  -> data/{nome} ({os.path.getsize(caminho)/1024:.0f} KB)")
    return caminho


# ---------------------------------------------------------------- geometria
def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto or "")
    texto = "".join(c for c in texto if not unicodedata.combining(c)).upper()
    return re.sub(r"[^A-Z0-9]", "", texto)


def _area_orientada(anel) -> float:
    total = 0.0
    for i in range(len(anel) - 1):
        x1, y1 = anel[i][0], anel[i][1]
        x2, y2 = anel[i + 1][0], anel[i + 1][1]
        total += x1 * y2 - x2 * y1
    return total / 2.0


def area_km2(geom: dict) -> float:
    """Area geodesica (excesso esferico) em km2 — erro < 0,5%."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    total = 0.0
    R = 6371.0
    for poly in polys:
        for anel in poly:
            s = 0.0
            for i in range(len(anel) - 1):
                lon1, lat1 = anel[i][0], anel[i][1]
                lon2, lat2 = anel[i + 1][0], anel[i + 1][1]
                s += math.radians(lon2 - lon1) * (
                    math.sin(math.radians(lat1)) + math.sin(math.radians(lat2))
                )
            total += abs(s) * R * R / 2.0
    return total


def esri_para_geojson(geom: dict) -> dict:
    """EsriJSON (rings/paths) -> GeoJSON (RFC 7946)."""
    if not geom:
        return {"type": "Point", "coordinates": [0, 0]}
    if "rings" in geom:
        aneis = [[list(map(float, c[:2])) for c in anel] for anel in geom["rings"]]
        if aneis and _area_orientada(aneis[0]) < 0:
            aneis[0] = aneis[0][::-1]
        for i in range(1, len(aneis)):
            if _area_orientada(aneis[i]) > 0:
                aneis[i] = aneis[i][::-1]
        return {"type": "Polygon", "coordinates": aneis}
    if "paths" in geom:
        caminhos = [[list(map(float, c[:2])) for c in p] for p in geom["paths"]]
        if len(caminhos) == 1:
            return {"type": "LineString", "coordinates": caminhos[0]}
        return {"type": "MultiLineString", "coordinates": caminhos}
    if "x" in geom and "y" in geom:
        return {"type": "Point", "coordinates": [float(geom["x"]), float(geom["y"])]}
    return geom


def douglas_peucker(pontos, tol=0.0015):
    """Simplificacao iterativa (~150 m)."""
    if len(pontos) < 3:
        return list(pontos)
    manter = [False] * len(pontos)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pontos) - 1)]
    while pilha:
        ini, fim = pilha.pop()
        if fim <= ini + 1:
            continue
        x1, y1 = pontos[ini]
        x2, y2 = pontos[fim]
        den = math.hypot(x2 - x1, y2 - y1)
        dmax, idx = 0.0, ini
        for i in range(ini + 1, fim):
            x0, y0 = pontos[i]
            if den == 0:
                dist = math.hypot(x0 - x1, y0 - y1)
            else:
                dist = abs((x2 - x1) * (y1 - y0) - (x1 - x0) * (y2 - y0)) / den
            if dist > dmax:
                dmax, idx = dist, i
        if dmax > tol:
            manter[idx] = True
            pilha.append((ini, idx))
            pilha.append((idx, fim))
    return [p for p, m in zip(pontos, manter) if m]


def simplificar_geometria(geom: dict, tol=0.0015) -> dict:
    if geom.get("type") == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [simplificar_geometria({"type": "Polygon", "coordinates": poly}, tol)["coordinates"][0]]
                for poly in geom["coordinates"]
            ],
        }
    if geom.get("type") == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [
                douglas_peucker([tuple(c[:2]) for c in anel], tol) for anel in geom["coordinates"]
            ],
        }
    if geom.get("type") == "MultiLineString":
        return {
            "type": "MultiLineString",
            "coordinates": [douglas_peucker([tuple(c[:2]) for c in lin], tol) for lin in geom["coordinates"]],
        }
    if geom.get("type") == "LineString":
        return {"type": "LineString", "coordinates": douglas_peucker([tuple(c[:2]) for c in geom["coordinates"]], tol)}
    return geom


def ponto_dentro(poligonos, lon, lat) -> bool:
    """Ray casting; aceita dict ou lista de dicts."""
    if isinstance(poligonos, list):
        return any(ponto_dentro(p, lon, lat) for p in poligonos)
    polys = poligonos["coordinates"] if poligonos["type"] == "MultiPolygon" else [poligonos["coordinates"]]
    for poly in polys:
        anel = poly[0]
        dentro = False
        j = len(anel) - 1
        for i in range(len(anel)):
            xi, yi = anel[i][0], anel[i][1]
            xj, yj = anel[j][0], anel[j][1]
            if (yi > lat) != (yj > lat):
                x_int = (xj - xi) * (lat - yi) / (yj - yi) + xi
                if lon < x_int:
                    dentro = not dentro
            j = i
        if dentro:
            return True
    return False


def dentro_bbox(bbox, lon, lat) -> bool:
    xmin, ymin, xmax, ymax = bbox
    return xmin <= lon <= xmax and ymin <= lat <= ymax


def centroide(geom: dict):
    xs, ys = [], []

    def add(coords):
        if isinstance(coords[0][0], (int, float)):
            xs.append(coords[0][0])
            ys.append(coords[0][1])
        else:
            for c in coords:
                add(c)

    add(geom["coordinates"])
    return [sum(xs) / len(xs), sum(ys) / len(ys)]


# ---------------------------------------------------------------- municipios
def buscar_municipios():
    log("[1/5] Limites dos 52 municipios (geoBoundaries/IBGE) + codigos oficiais")
    meta = http_json(GB_API)
    url_geojson = meta["simplifiedGeometryGeoJSON"] or meta["gjDownloadURL"]
    arquivo = os.path.join(CACHE, "gbOpen-BRA-ADM2_simplified.geojson")
    baixar(url_geojson, arquivo)
    with open(arquivo, encoding="utf-8") as fh:
        gb = json.load(fh)

    locais = http_json(IBGE_LOCALIDADES)
    oficiais = {}
    for m in locais:
        mic = m.get("microrregiao") or {}
        mes = mic.get("mesorregiao") or {}
        uf = (mes.get("UF") or {}).get("sigla")
        if uf == "RO":
            oficiais[m["id"]] = m["nome"]

    # indexa candidatos do geoBoundaries por nome normalizado
    candidatos = {}
    for feat in gb["features"]:
        chave = normalizar(feat["properties"].get("shapeName", ""))
        candidatos.setdefault(chave, []).append(feat)

    saida, faltando = [], []
    for codigo, nome in sorted(oficiais.items(), key=lambda kv: kv[1]):
        chave = normalizar(nome)
        cands = candidatos.get(chave, [])
        if not cands:
            faltando.append(nome)
            continue
        # desambigua homonimos (ex.: Montenegro x Monte Negro) pela posicao em RO
        dentro = [c for c in cands if dentro_bbox(RO_BBOX, *centroide(c["geometry"]))]
        alvo = dentro[0] if dentro else cands[0]
        geom = simplificar_geometria(alvo["geometry"], 0.0012)
        saida.append(
            {
                "type": "Feature",
                "id": codigo,
                "properties": {
                    "id_municipio": codigo,
                    "codigo_ibge": codigo,
                    "nome": nome,
                    "uf": "RO",
                    "area_km2": round(area_km2(geom), 1),
                    "centroide": [round(v, 6) for v in centroide(geom)],
                },
                "geometry": geom,
            }
        )

    total = sum(f["properties"]["area_km2"] for f in saida)
    log(f"  municipios casados: {len(saida)}/52 | area total: {total:,.0f} km2 "
        f"(oficial {RO_AREA_OFICIAL_KM2:,.0f} km2, desvio {100*(total-RO_AREA_OFICIAL_KM2)/RO_AREA_OFICIAL_KM2:+.1f}%)")
    if faltando:
        log(f"  NAO ENCONTRADOS: {faltando}")
    salvar("municipios.geojson", {"type": "FeatureCollection", "features": saida})
    return saida


def buscar_indicadores_municipais(municipios):
    log("[2/5] Populacao (Censo 2022) e PIB (Contas Nacionais) — SIDRA/IBGE")
    pop, pib, ano_pib = {}, {}, None
    for feat in municipios:
        cod = feat["properties"]["codigo_ibge"]
        try:
            d = http_json(IBGE_SIDRA.format(tabela="6579", codigo=cod))
            vals = [r for r in d[1:] if r.get("V") not in (None, "...", "..", "")]
            if vals:
                pop[cod] = int(float(vals[0]["V"]))
        except Exception as exc:  # noqa: BLE001
            log(f"  ! populacao {cod}: {exc}")
        time.sleep(0.04)
    for cod in list(pop):
        try:
            d = http_json(IBGE_SIDRA.format(tabela="5938", codigo=cod))
            vals = [r for r in d[1:] if r.get("V") not in (None, "...", "..", "")]
            if vals:
                ano_pib = vals[0].get("D3N") or ano_pib
                pib[cod] = float(vals[0]["V"]) / 1_000_000  # milhoes -> bilhoes
        except Exception:  # noqa: BLE001
            continue
        time.sleep(0.04)

    saida = {
        "fonte": "IBGE — SIDRA (tabela 6579: Populacao residente/Censo 2022; tabela 5938: PIB municipal)",
        "status": "REAL",
        "ano_populacao": 2022,
        "ano_pib": ano_pib,
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "municipios": {
            m["properties"]["codigo_ibge"]: {
                "populacao": pop.get(m["properties"]["codigo_ibge"]),
                "pib_milhoes": round(pib[m["properties"]["codigo_ibge"]], 1)
                if m["properties"]["codigo_ibge"] in pib
                else None,
            }
            for m in municipios
        },
    }
    salvar("indicadores-municipais.json", saida)
    log(f"  populacao: {len(pop)}/52 | pib: {len(pib)}/52 (ano {ano_pib})")
    return saida


# ---------------------------------------------------------------- vias
def _consultar_fs(base, bbox, campos="*", offset=0, limite=1000):
    url = (
        f"{base}/query?where=1%3D1&geometry={urllib.parse.quote(bbox)}"
        "&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects"
        f"&outFields={campos}&returnGeometry=true&outSR=4326&f=json"
        f"&resultOffset={offset}&resultRecordCount={limite}"
    )
    return http_json(url)


def buscar_rodovias(municipios):
    log("[3/5] Malha rodoviaria SNV (codigo BR, quilometragem, jurisdicao)")
    xs, ys = [], []
    for feat in municipios:
        polys = feat["geometry"]["coordinates"] if feat["geometry"]["type"] == "MultiPolygon" else [feat["geometry"]["coordinates"]]
        for poly in polys:
            for c in poly[0]:
                xs.append(c[0])
                ys.append(c[1])
    bbox = f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}"

    feats, offset = [], 0
    while True:
        dados = _consultar_fs(FS_SNV, bbox, "*", offset, 1000)
        lote = dados.get("features", [])
        feats.extend(lote)
        if not dados.get("exceededTransferLimit") or not lote or offset > 20000:
            break
        offset += len(lote)
        time.sleep(0.3)

    poligonos = [f["geometry"] for f in municipios]
    saida = []
    for f in feats:
        geom = esri_para_geojson(f["geometry"])
        linhas = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        dentro = False
        for lin in linhas:
            for c in lin[:: max(1, len(lin) // 15)]:
                if ponto_dentro(poligonos, c[0], c[1]):
                    dentro = True
                    break
            if dentro:
                break
        if not dentro:
            continue
        a = f["attributes"]
        jur = (a.get("Administra") or "Federal").strip()
        jur = {"Concessão Federal": "Concessao Federal", "Concessno Federal": "Concessao Federal",
               "Concess o Federal": "Concessao Federal"}.get(jur, jur)
        sigla = (a.get("Sigla_Tipo") or "BR").strip()
        codigo_br = a.get("Codigo_BR")
        saida.append(
            {
                "type": "Feature",
                "id": a.get("Codigo_SNV"),
                "properties": {
                    "codigo_snv": a.get("Codigo_SNV"),
                    "codigo_rodovia": f"{sigla}-{codigo_br}" if codigo_br else None,
                    "codigo_br": codigo_br,
                    "sigla_tipo": sigla,
                    "nome_tipo": (a.get("Nome_Tipo_") or "").strip(),
                    "jurisdicao": jur,
                    "unidade_local": (a.get("Unidade_Lo") or "").strip(),
                    "superficie": (a.get("Superficie") or "").strip(),
                    "extensao_km": a.get("Extensao"),
                    "km_inicial": a.get("Quilometra"),
                    "km_final": a.get("Quilometr0"),
                    "local_inicial": (a.get("Local_Inic") or "").strip(),
                    "local_final": (a.get("Local_Fim") or "").strip(),
                    "versao_snv": a.get("Versao_SNV"),
                    "status": "REAL",
                },
                "geometry": simplificar_geometria(geom, 0.0008),
            }
        )
    salvar("rodovias.geojson", {"type": "FeatureCollection", "features": saida})
    log(f"  trechos SNV dentro de RO: {len(saida)}")
    return saida


def buscar_vias_estaduais(municipios):
    log("[4/5] Malha viaria estadual/municipal (segmentos RO-xxx)")
    xs, ys = [], []
    for feat in municipios:
        polys = feat["geometry"]["coordinates"] if feat["geometry"]["type"] == "MultiPolygon" else [feat["geometry"]["coordinates"]]
        for poly in polys:
            for c in poly[0]:
                xs.append(c[0])
                ys.append(c[1])
    bbox = f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}"

    feats, offset = [], 0
    while True:
        dados = _consultar_fs(FS_VIAS_RO, bbox, "*", offset, 2000)
        lote = dados.get("features", [])
        feats.extend(lote)
        if not dados.get("exceededTransferLimit") or not lote or offset > 60000:
            break
        offset += len(lote)
        time.sleep(0.4)

    padrao = re.compile(r"^RO[-\s]?(\d{3})$", re.IGNORECASE)
    saida = []
    for f in feats:
        a = f["attributes"]
        nome = (a.get("Name") or "").strip()
        m = padrao.match(nome)
        if not m:
            continue
        codigo = f"RO-{m.group(1)}"
        saida.append(
            {
                "type": "Feature",
                "id": a.get("OBJECTID"),
                "properties": {
                    "codigo_rodovia": codigo,
                    "nome": codigo,
                    "situacao": (a.get("Status") or "").strip() or "Nao informado",
                    "status": "REAL",
                    "fonte": "Rondonia Roads (FeatureServer publico)",
                },
                "geometry": simplificar_geometria(esri_para_geojson(f["geometry"]), 0.0015),
            }
        )
    salvar("vias-estaduais.geojson", {"type": "FeatureCollection", "features": saida})
    log(f"  segmentos rodovios estaduais (RO-xxx): {len(saida)}")
    return saida


def buscar_areas_protegidas():
    log("[5/5] Areas de protecao e uso restrito (servico publico)")
    url = f"{FS_AREAS_PROT}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json"
    dados_ = http_json(url)
    saida = []
    for f in dados_.get("features", []):
        a = f["attributes"]
        geom = esri_para_geojson(f["geometry"])
        saida.append(
            {
                "type": "Feature",
                "id": a.get("OBJECTID_1"),
                "properties": {
                    "nome": a.get("Name"),
                    "categoria": a.get("Category"),
                    "jurisdicao": a.get("Jurisdiction"),
                    "ano_criacao": a.get("Created"),
                    "status": "REAL",
                },
                "geometry": simplificar_geometria(geom, 0.0012),
            }
        )
    salvar("ambiente.geojson", {"type": "FeatureCollection", "features": saida})
    log(f"  areas de protecao: {len(saida)}")
    return saida


def main():
    log("== CENTRAL INFRA RO 360 | coleta de dados reais ==")
    municipios = buscar_municipios()
    buscar_indicadores_municipais(municipios)
    buscar_rodovias(municipios)
    buscar_vias_estaduais(municipios)
    buscar_areas_protegidas()
    log("Concluido.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
