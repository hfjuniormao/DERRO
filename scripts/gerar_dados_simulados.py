#!/usr/bin/env python3
"""
CENTRAL INFRA RO 360 — Geracao das bases DEMONSTRATIVAS (DADOS SIMULADOS).

Regra do projeto (prompt mestre, secao 7):
  * Limites municipais, malha rodoviaria SNV, populacao e PIB sao REAIS
    (baixados por scripts/fetch_dados_reais.py).
  * Obras, contratos, ativos, convenios, maquinas, vistorias e series
    historicas sao SIMULADOS — deterministicos (semente fixa), coerentes com
    os municipios e trechos rodoviarios REAIS, e sempre identificados como
    "DADOS SIMULADOS" na interface e no catalogo de fontes.
  * Nomes de empresas sao explicitamente ficticios (nunca empresas reais).
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
from datetime import date, timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, "data")
SEMENTE = 20261125
HOJE = date(2026, 11, 25)

rnd = random.Random(SEMENTE)

ORGAOS = [
    "DER-RO - Departamento de Estradas de Rodagem",
    "SEDEC - Secretaria de Desenvolvimento, Economia e Gestao",
    "SEFIN - Secretaria de Financas",
    "SEDAM - Secretaria de Desenvolvimento Ambiental",
    "DEOSP - Departamento de Estradas, Obras e Servicos Publicos",
    "SEDUR - Secretaria de Desenvolvimento Urbano",
]
ORGAOS[1] = "SEDEC - Secretaria de Desenvolvimento, Economia e Gestao"

FONTES_RECURSO = [
    "Fundo Estadual de Infraestrutura (FIP)",
    "Tesouro estadual - LOA 2026",
    "Transferencia federal - MT - PL 2024",
    "Credito interno - excedente de arrecadacao",
    "Parceria municipal - convenio",
    "Recursos de concessao - Deliberacao 4",
    "Multas e parcelamentos ambientais",
    "Superavil primario do FUMDIN",
]

CATEGORIAS_OBRA = [
    ("pavimentacao", "Pavimentacao"),
    ("recuperacao_rodoviaria", "Recuperacao rodoviaria"),
    ("pontes", "Pontes"),
    ("drenagem", "Drenagem"),
    ("escolas", "Escolas"),
    ("hospitais", "Hospitais"),
    ("predios_publicos", "Predios publicos"),
    ("infraestrutura_urbana", "Infraestrutura urbana"),
    ("outras_obras", "Outras obras"),
]

SITUACOES_OBRA = [
    ("planejada", "Planejada", 12),
    ("em_execucao", "Em execucao", 34),
    ("atrasada", "Atrasada", 16),
    ("paralisada", "Paralisada", 7),
    ("concluida", "Concluida", 26),
    ("cancelada", "Cancelada", 5),
]

TIPOS_ATIVO = [
    ("ponte", "Ponte"),
    ("bueiro", "Bueiro tubular"),
    ("galeria", "Galeria de drenagem"),
    ("sinalizacao", "Sinalizacao vertical"),
    ("defensa", "Defensa metalica"),
    ("viaduto", "Viaduto"),
    ("passarela", "Passarela de pedestres"),
    ("barragem", "Barragem de represamento"),
]

CONDICOES = [
    ("boa", "Boa", 40),
    ("regular", "Regular", 32),
    ("ruim", "Ruim", 19),
    ("critica", "Critica", 9),
]

EMPRESAS = [
    "Construtora Noroeste Exemplo (ficticia)",
    "Engenharia Vento Livre RO (ficticia)",
    "Concessionaria Rodoviaria Exemplo (ficticia)",
    "Terraplenagem Rio Madeira (ficticia)",
    "Engenharia Estrutural Exemplo (ficticia)",
    "Construtora Vale do Sol (ficticia)",
    "Infraestrutura Aroeira (ficticia)",
    "Consorciovias Exemplo (ficticia)",
    "Pavimentacao Exemplo Norte (ficticia)",
    "Servicos de Obras Exemplo (ficticia)",
]

TIPOS_MAQUINA = [
    ("carroceria", "Carroceria de pavimento"),
    ("escavadeira", "Escavadeira hidraulica"),
    ("motoniveladora", "Motoniveladora"),
    ("compactador", "Rolo compactador"),
    ("caminhao_graneleiro", "Caminhao graneleiro"),
    ("usina_asfalto", "Usina de asfalto"),
    ("planta_concreto", "Planta de concreto"),
    ("retroescavadeira", "Retroescavadeira"),
    ("empilhadeira", "Empilhadeira"),
    ("viatura_apoio", "Viatura de apoio operacional"),
]


def carregar(nome, padrao=None):
    caminho = os.path.join(DATA, nome)
    if not os.path.exists(caminho):
        return padrao
    with open(caminho, encoding="utf-8") as fh:
        return json.load(fh)


def salvar(nome, obj):
    os.makedirs(DATA, exist_ok=True)
    caminho = os.path.join(DATA, nome)
    with open(caminho, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
    print(f"  -> data/{nome} ({os.path.getsize(caminho)/1024:.0f} KB)")


def hex_para_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def interpolar_cor(c1, c2, t):
    a, b = hex_para_rgb(c1), hex_para_rgb(c2)
    return "#%02x%02x%02x" % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ponto_no_municipio(mun, rng):
    """Ponto aleatorio dentro do poligono municipal (insercao simples)."""
    geom = mun["geometry"]
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    poly = polys[0]
    anel = poly[0]
    xs = [c[0] for c in anel]
    ys = [c[1] for c in anel]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    for _ in range(40):
        px = rng.uniform(min(xs), max(xs))
        py = rng.uniform(min(ys), max(ys))
        if ponto_dentro(polys, px, py):
            return px, py
    return cx, cy


def ponto_dentro(polys, lon, lat):
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


def ponto_na_rodovia(rod, rng, jitter=0.02):
    """Ponto ao longo de um trecho SNV real."""
    geom = rod["geometry"]
    linhas = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
    linha = max(linhas, key=len)
    i = rng.randrange(len(linha))
    x, y = linha[i][0], linha[i][1]
    return x + rng.uniform(-jitter, jitter), y + rng.uniform(-jitter, jitter)


def data_aleatoria(inicio: date, fim: date) -> date:
    return inicio + timedelta(days=rnd.randrange((fim - inicio).days))


def main():
    print("== Geracao de bases demonstrativas (DADOS SIMULADOS) ==")
    mun_geo = carregar("municipios.geojson")
    if not mun_geo:
        print("ERRO: execute antes scripts/fetch_dados_reais.py")
        return 1
    municipios = mun_geo["features"]
    ind_mun = carregar("indicadores-municipais.json", {"municipios": {}})["municipios"]
    rod_geo = carregar("rodovias.geojson", {"features": []})
    rodovias = rod_geo.get("features", [])

    print(f"  municipios reais: {len(municipios)} | trechos SNV reais: {len(rodovias)}")

    pesos_mun = []
    for m in municipios:
        pop = (ind_mun.get(m["properties"]["codigo_ibge"], {}) or {}).get("populacao") or 20000
        pesos_mun.append(max(pop, 2000))

    def municipio_aleatorio():
        return rnd.choices(municipios, weights=pesos_mun, k=1)[0]

    # --------------------------------------------------------------- obras
    print("[1/6] Obras publicas (SIMULADAS)")
    obras = []
    for i in range(1, 421):
        mun = municipio_aleatorio()
        props = mun["properties"]
        cat_id, cat_nome = rnd.choice(CATEGORIAS_OBRA)
        if rodovias and rnd.random() < 0.62:
            rod = rnd.choice(rodovias)
            rp = rod["properties"]
            lon, lat = ponto_na_rodovia(rod, rnd)
            rodovia = f"{rp.get('sigla_tipo') or 'BR'}-{rp.get('codigo_br')}" if rp.get("codigo_br") else None
            km = rp.get("km_inicial")
            trecho_ref = f"km {km}" if km is not None else "trecho nao referencia"
        else:
            rod = None
            rp = {}
            lon, lat = ponto_no_municipio(mun, rnd)
            rodovia = None
            trecho_ref = "malha urbana"

        situacao_id, situacao_nome, _ = rnd.choices(SITUACOES_OBRA, weights=[w for _, _, w in SITUACOES_OBRA])[0]
        inicio = data_aleatoria(date(2023, 1, 1), date(2026, 6, 30))
        prazo = inicio + timedelta(days=rnd.randrange(180, 1100))
        valor = round(rnd.uniform(180_000, 42_000_000), 2)
        fisico = {
            "planejada": rnd.uniform(0, 5),
            "em_execucao": rnd.uniform(20, 92),
            "atrasada": rnd.uniform(15, 78),
            "paralisada": rnd.uniform(8, 55),
            "concluida": rnd.uniform(99.4, 100),
            "cancelada": rnd.uniform(0, 35),
        }[situacao_id]
        financeiro = max(0.0, fisico * rnd.uniform(0.75, 1.08))
        if situacao_id == "concluida":
            financeiro = round(valor * rnd.uniform(0.92, 1.0), 2)
        if situacao_id == "cancelada":
            financeiro = round(valor * rnd.uniform(0, 0.25), 2)
        mediacoes = []
        n_med = rnd.randrange(0, 6)
        for m in range(1, n_med + 1):
            data_med = inicio + timedelta(days=rnd.randrange(10, max(11, (prazo - inicio).days)))
            mediacoes.append(
                {
                    "numero": m,
                    "data": data_med.isoformat(),
                    "percentual_fisico": round(min(100, fisico * (m / max(1, n_med))), 2),
                    "valor_medido": round(valor * (m / max(1, n_med)) * rnd.uniform(0.85, 1.02), 2),
                    "responsavel": f"Engenheiro fiscal {rnd.randrange(1, 18):02d} (ficticio)",
                    "observacao": "Medicao registrada em campo conforme cronograma contratual.",
                }
            )
        historico = []
        for h in range(rnd.randrange(2, 6)):
            historico.append(
                {
                    "data": (inicio + timedelta(days=rnd.randrange(0, max(1, (prazo - inicio).days)))).isoformat(),
                    "evento": rnd.choice(
                        [
                            "Emissao da ordem de servico",
                            "Aprovacao de projeto executivo",
                            "Reproversao do processo",
                            "Termo de aditivo contratual",
                            "Vistoria tecnica de rotina",
                            "Liberacao de medicao",
                        ]
                    ),
                    "responsavel": f"Setor {rnd.choice(['ENGENHARIA', 'PLANEJAMENTO', 'FISCALIZACAO', 'CONTRATOS'])} (ficticio)",
                }
            )
        obras.append(
            {
                "id": f"OBR-RO-{2026 if inicio.year >= 2026 else inicio.year}-{i:04d}",
                "tipo": "obra",
                "titulo": f"{cat_nome} - {props['nome']}",
                "categoria": cat_id,
                "categoria_nome": cat_nome,
                "municipio_codigo": props["codigo_ibge"],
                "municipio": props["nome"],
                "rodovia": rodovia,
                "referencia": trecho_ref,
                "km": km,
                "localizacao": {"lon": round(lon, 6), "lat": round(lat, 6)},
                "orgao_responsavel": rnd.choice(ORGAOS),
                "empresa": rnd.choice(EMPRESAS),
                "contrato_id": f"CT-{rnd.randrange(1000, 9999)}/{inicio.year}",
                "valor_inicial": valor,
                "valor_atualizado": round(valor * rnd.uniform(1.0, 1.28), 2),
                "percentual_execucao_fisica": round(fisico, 2),
                "percentual_execucao_financeira": round(min(100, financeiro), 2),
                "situacao": situacao_id,
                "situacao_nome": situacao_nome,
                "fonte_recurso": rnd.choice(FONTES_RECURSO),
                "data_inicio": inicio.isoformat(),
                "data_fim_prevista": prazo.isoformat(),
                "dias_atraso": max(0, (HOJE - prazo).days) if situacao_id in ("atrasada", "paralisada") else 0,
                "mediacoes": mediacoes,
                "evidencias": [
                    {
                        "tipo": "foto",
                        "legenda": f"Registro de progresso - etapa {rnd.randrange(1, 5)}",
                        "data": (inicio + timedelta(days=rnd.randrange(10, 600))).isoformat(),
                        "arquivo": None,
                    }
                    for _ in range(rnd.randrange(0, 4))
                ],
                "historico": historico,
                "fonte": "SIMULADO",
            }
        )

    # ------------------------------------------------------------ contratos
    print("[2/6] Contratos (SIMULADOS)")
    contratos = []
    for i in range(1, 181):
        emp = rnd.choice(EMPRESAS)
        vinicio = data_aleatoria(date(2022, 6, 1), date(2025, 12, 31))
        vigencia_meses = rnd.choice([6, 12, 18, 24, 30, 36])
        vfim = vinicio + timedelta(days=vigencia_meses * 30)
        inicial = round(rnd.uniform(120_000, 38_000_000), 2)
        aditivos = round(inicial * rnd.uniform(0, 0.32), 2)
        atualizado = round(inicial + aditivos, 2)
        empenhado = round(atualizado * rnd.uniform(0.15, 0.95), 2)
        liquidado = round(empenhado * rnd.uniform(0.35, 0.98), 2)
        pago = round(liquidado * rnd.uniform(0.4, 1.0), 2)
        saldo = round(atualizado - pago, 2)
        if vfim < HOJE:
            situacao = rnd.choices(
                ["vigente", "encerrado", "paralisado", "atrasado", "rescindido"], weights=[8, 46, 12, 26, 8]
            )[0]
        else:
            situacao = rnd.choices(["vigente", "a_vencer", "paralisado"], weights=[62, 30, 8])[0]
        contratos.append(
            {
                "id": f"CT-{rnd.randrange(1000, 9999)}/{vinicio.year}",
                "objeto": f"{rnd.choice([cat_nome for _, cat_nome in CATEGORIAS_OBRA])} - {rnd.choice([m['properties']['nome'] for m in municipios])}",
                "contratada": emp,
                "orgao": rnd.choice(ORGAOS),
                "municipio": rnd.choice([m["properties"]["nome"] for m in municipios]),
                "vigencia_inicio": vinicio.isoformat(),
                "vigencia_fim": vfim.isoformat(),
                "valor_inicial": inicial,
                "valor_aditivos": aditivos,
                "valor_atualizado": atualizado,
                "valor_empenhado": empenhado,
                "valor_liquidado": liquidado,
                "valor_pago": pago,
                "saldo": saldo,
                "situacao": situacao,
                "dias_para_vencer": (vfim - HOJE).days,
                "modalidade": rnd.choice(["Lei 8.666/93 - Tomada de Precos", "Lei 8.666/93 - Licitacao", "Lei 14.133/21 - Concursao", "Credenciamento"]),
                "fonte_recurso": rnd.choice(FONTES_RECURSO),
                "fonte": "SIMULADO",
            }
        )
    # vincula contratos as obras (sem duplicar valores entre obras do mesmo contrato)
    for contrato in contratos:
        candidatas = [o for o in obras if o["situacao"] != "cancelada"]
        contrato["obras"] = []
        for obra in rnd.sample(candidatas, k=min(len(candidatas), rnd.randrange(1, 4))):
            contrato["obras"].append(obra["id"])
            if obra["contrato_id"] != contrato["id"]:
                obra["contrato_id"] = contrato["id"]

    # --------------------------------------------------------------- ativos
    print("[3/6] Ativos e pontes (SIMULADOS)")
    ativos = []
    for i in range(1, 261):
        mun = municipio_aleatorio()
        props = mun["properties"]
        tipo_id, tipo_nome = rnd.choice(TIPOS_ATIVO)
        cond_id, cond_nome, _ = rnd.choices(CONDICOES, weights=[w for _, _, w in CONDICOES])[0]
        if rodovias and rnd.random() < 0.78:
            rod = rnd.choice(rodovias)
            rp = rod["properties"]
            lon, lat = ponto_na_rodovia(rod, rnd, jitter=0.01)
            rodovia = f"{rp.get('sigla_tipo') or 'BR'}-{rp.get('codigo_br')}" if rp.get("codigo_br") else None
            km = rp.get("km_inicial")
        else:
            rodovia = None
            km = None
            lon, lat = ponto_no_municipio(mun, rnd)
        criticidade = {"boa": "baixa", "regular": "media", "ruim": "alta", "critica": "critica"}[cond_id]
        inspecoes = []
        for k in range(rnd.randrange(1, 5)):
            inspecoes.append(
                {
                    "data": data_aleatoria(date(2022, 1, 1), HOJE).isoformat(),
                    "responsavel": f"Inspecao {rnd.choice(['DER-RO', 'Contratada', 'Fiscal'])} (ficticio)",
                    "condicao": rnd.choice([c[1] for c in CONDICOES]),
                    "parecer": "Sem dano estrutural relevante." if cond_id == "boa" else "Recomenda-se intervencao.",
                }
            )
        ativos.append(
            {
                "id": f"ATIVO-RO-{i:04d}",
                "tipo": tipo_id,
                "tipo_nome": tipo_nome,
                "municipio_codigo": props["codigo_ibge"],
                "municipio": props["nome"],
                "rodovia": rodovia,
                "km": km,
                "localizacao": {"lon": round(lon, 6), "lat": round(lat, 6)},
                "condicao": cond_id,
                "condicao_nome": cond_nome,
                "criticidade": criticidade,
                "capacidade": rnd.choice(["10 t", "15 t", "20 t", "30 t", "45 t", "60 t", "n/d"]),
                "extensao_m": rnd.choice([8, 12, 18, 25, 40, 60, 120, 250]),
                "ano_implantacao": rnd.randrange(1975, 2025),
                "ultima_inspecao": inspecoes[-1]["data"] if inspecoes else None,
                "inspecoes": inspecoes,
                "responsavel": rnd.choice(["DER-RO - Regional", "DER-RO - Sede", "Unidade Local"]),
                "fonte": "SIMULADO",
            }
        )

    # ------------------------------------------------------------ convênios
    print("[4/6] Convenios e transferencias (SIMULADOS)")
    convenios = []
    for i in range(1, 96):
        mun = municipio_aleatorio()
        props = mun["properties"]
        valor = round(rnd.uniform(300_000, 28_000_000), 2)
        vinicio = data_aleatoria(date(2023, 1, 1), date(2026, 8, 31))
        vfim = vinicio + timedelta(days=rnd.randrange(360, 1500))
        desembolsado = round(valor * rnd.uniform(0.05, 0.95), 2)
        situacao = rnd.choices(
            ["vigente", "execucao", "atrasado", "concluido", "cancelado"], weights=[30, 30, 14, 22, 4]
        )[0]
        lon, lat = ponto_no_municipio(mun, rnd)
        convenios.append(
            {
                "id": f"CV-RO-{i:04d}",
                "objeto": rnd.choice(
                    [
                        "Pavimentacao de vias municipais",
                        "Construcao de unidade de saude",
                        "Recuperacao de estradas vicinais",
                        "Implantacao de rede de agua e esgoto",
                        "Reforma de escolas municipais",
                        "Construcao de ponte sobre cursos d'agua",
                        "Aquisição de equipamentos de manutencao",
                    ]
                ),
                "orgao_concedente": rnd.choice(["Governo do Estado de Rondonia", "Ministerio das Cidades", "Ministério da Infraestrutura", "Fundo Nacional de Desenvolvimento Regional"]),
                "beneficiario": f"Prefeitura Municipal de {props['nome']}",
                "municipio_codigo": props["codigo_ibge"],
                "municipio": props["nome"],
                "valor": valor,
                "contrapartida": round(valor * rnd.uniform(0.05, 0.25), 2),
                "desembolsado": desembolsado,
                "saldo": round(valor - desembolsado, 2),
                "vigencia_inicio": vinicio.isoformat(),
                "vigencia_fim": vfim.isoformat(),
                "situacao": situacao,
                "dias_para_vencer": (vfim - HOJE).days,
                "localizacao": {"lon": round(lon, 6), "lat": round(lat, 6)},
                "fonte": "SIMULADO",
            }
        )

    # ------------------------------------------------------------ maquinas
    print("[5/6] Maquinas e equipamentos (SIMULADOS)")
    maquinas = []
    for i in range(1, 141):
        mun = municipio_aleatorio()
        props = mun["properties"]
        tipo_id, tipo_nome = rnd.choice(TIPOS_MAQUINA)
        situacao = rnd.choices(["operacional", "manutencao", "inoperante", "afastada"], weights=[58, 24, 11, 7])[0]
        maquinas.append(
            {
                "id": f"MAQ-RO-{i:04d}",
                "tipo": tipo_id,
                "tipo_nome": tipo_nome,
                "patrimonial": f"RO-{rnd.randrange(100000, 999999)}",
                "unidade_responsavel": f"UR-{rnd.choice(['Vilhena', 'Porto Velho', 'Ji-Parana', 'Ariquemes', 'Cacoal', 'Rolim de Moura'])}",
                "municipio_codigo": props["codigo_ibge"],
                "municipio": props["nome"],
                "disponibilidade": {"operacional": rnd.uniform(0.82, 0.99), "manutencao": rnd.uniform(0.3, 0.75), "inoperante": rnd.uniform(0, 0.3), "afastada": rnd.uniform(0.1, 0.5)}[situacao],
                "situacao": situacao,
                "horas_operacao": rnd.randrange(500, 22000),
                "ultima_manutencao": data_aleatoria(date(2024, 1, 1), HOJE).isoformat(),
                "localizacao": {"lon": round(rnd.uniform(-73.5, -60.0)), "lat": round(rnd.uniform(-13.5, -8.6))},
                "simulacao_movimentacao": True,
                "fonte": "SIMULADO",
            }
        )

    # ------------------------------------------------------------ vistorias
    print("[6/6] Vistorias de fiscalização (SIMULADAS)")
    vistorias = []
    for i in range(1, 121):
        obra = rnd.choice([o for o in obras if o["situacao"] in ("em_execucao", "atrasada", "paralisada")])
        data_v = data_aleatoria(date(2025, 1, 1), HOJE)
        vistorias.append(
            {
                "id": f"VST-RO-{i:04d}",
                "obra_id": obra["id"],
                "municipio": obra["municipio"],
                "data": data_v.isoformat(),
                "responsavel": f"Fiscal {rnd.choice(['01', '02', '03', '04', '05'])} (ficticio)",
                "percentual_avanco": round(min(100, obra["percentual_execucao_fisica"] + rnd.uniform(-12, 12)), 2),
                "inconformidades": rnd.randrange(0, 4),
                "observacoes": rnd.choice(
                    [
                        "Sinalizacao de obra parcialmente instalada.",
                        "Sinalizacao de obra parcialmente instalada.",
                        "EQUIPAMENTO sem manutencao preventiva registrada.",
                        "Reparo do pavimento executado sem registro de medicao previa.",
                        "Trecho interditado sem comunicacao oficial.",
                    ]
                ),
                "fotos": [],
                "situacao": "pendente_envio",
                "fonte": "SIMULADO",
            }
        )

    # ------------------------------------------------------------- series
    print("[serie] Series historicas de investimento (SIMULADAS)")
    serie = []
    for ano in range(2019, 2027):
        for mes in range(1, 13):
            if ano == 2026 and mes > 11:
                break
            base = 38_000_000 * (1 + (ano - 2019) * 0.085) * (1 + 0.22 * ((ano - 2019) / 6))
            valor = base * rnd.uniform(0.72, 1.31)
            serie.append({"ano": ano, "mes": mes, "valor": round(valor, 2), "fonte": "SIMULADO"})

    salvar("obras-demo.geojson", {
        "type": "FeatureCollection",
        "metadata": {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(obras),
                     "nota": "Dados demonstrativos coerentes com municipios e trechos SNV reais. Nao representam obras reais."},
        "features": [
            {
                "type": "Feature",
                "id": o["id"],
                "properties": o,
                "geometry": {"type": "Point", "coordinates": [o["localizacao"]["lon"], o["localizacao"]["lat"]]},
            }
            for o in obras
        ],
    })
    salvar("contratos-demo.json", {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(contratos), "contratos": contratos})
    salvar("ativos-demo.geojson", {
        "type": "FeatureCollection",
        "metadata": {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(ativos)},
        "features": [
            {"type": "Feature", "id": a["id"], "properties": a,
             "geometry": {"type": "Point", "coordinates": [a["localizacao"]["lon"], a["localizacao"]["lat"]]}}
            for a in ativos
        ],
    })
    salvar("convenios-demo.json", {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(convenios), "convenios": convenios})
    salvar("maquinas-demo.json", {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(maquinas), "maquinas": maquinas})

    # Versoes cartograficas (GeoJSON) de convênios e máquinas.
    # A GeoJSONLayer do ArcGIS Maps SDK só aceita geometria por URL — por isso
    # as bases tabulares ganham um parceiro geoespacial.
    salvar("convenios-demo.geojson", {
        "type": "FeatureCollection",
        "metadata": {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(convenios),
                     "nota": "Projrcao cartografica da base de convênios (ponto = sede do municipio)."},
        "features": [
            {
                "type": "Feature",
                "id": c["id"],
                "properties": {k: v for k, v in c.items() if not isinstance(v, (dict, list, bool))},
                "geometry": {"type": "Point", "coordinates": [c["localizacao"]["lon"], c["localizacao"]["lat"]]},
            }
            for c in convenios
        ],
    })
    salvar("maquinas-demo.geojson", {
        "type": "FeatureCollection",
        "metadata": {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(maquinas),
                     "nota": "Projrcao cartografica da base de maquinas (ponto = base de lotacao)."},
        "features": [
            {
                "type": "Feature",
                "id": m["id"],
                "properties": {k: v for k, v in m.items() if not isinstance(v, (dict, list, bool))},
                "geometry": {"type": "Point", "coordinates": [m["localizacao"]["lon"], m["localizacao"]["lat"]]},
            }
            for m in maquinas
        ],
    })
    salvar("vistorias-demo.json", {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "registros": len(vistorias), "vistorias": vistorias})
    salvar("serie-investimento-demo.json", {"origem": "SIMULADO", "gerado_em": HOJE.isoformat(), "serie": serie})
    print("Concluido.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
