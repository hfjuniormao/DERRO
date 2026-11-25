#!/usr/bin/env python3
"""
CENTRAL INFRA RO 360 — Catalogo de fontes de dados.

Cada dataset recebe um status:
  REAL         -> dados oficiais, com responsavel, data de atualizacao e licenca
  SIMULADO    -> base demonstrativa coerente, identificada como DADOS SIMULADOS
  INDISPONIVEL-> fonte relevante que exige credencial/autorizacao do Estado
"""
from __future__ import annotations

import json
import os
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, "data")

FONTES = [
    {
        "id": "municipios",
        "titulo": "Limites dos 52 municipios de Rondonia",
        "descricao": "Malha municipal oficial usada como base territorial de toda a plataforma.",
        "formato": "GeoJSON",
        "status": "REAL",
        "orgao": "IBGE",
        "fonte": "geoBoundaries BRA ADM2 (derivado das malhas municipais do IBGE 2020)",
        "url": "https://www.geoboundaries.org/",
        "licenca": "CC BY 3.0 IGO",
        "atualizado_em": "2020",
        "metodologia": "Malha municipal generalizada; area calculada por excesso esferico (excesso < 0,5%).",
        "precisao_geografica": "Generalizacao topologica; erro de posicao da fronteira ~1 km.",
        "qualidade": "Alta — 52/52 municipios casados com a lista oficial do IBGE; area total 238.702 km2 vs. 237.591 km2 oficiais (+0,5%).",
        "atualizado_em_execucao": time.strftime("%Y-%m-%d"),
    },
    {
        "id": "indicadores-municipais",
        "titulo": "Populacao residente e PIB por municipio",
        "descricao": "Base socioeconorma dos 52 municipios para o perfil municipal e os indicadores.",
        "formato": "JSON",
        "status": "REAL",
        "orgao": "IBGE",
        "fonte": "SIDRA/IBGE — tabela 6579 (populacao, Censo 2022) e tabela 5938 (PIB municipal)",
        "url": "https://apisidra.ibge.gov.br/",
        "licenca": "Licenca de uso livre do IBGE (LDAP 2.1)",
        "atualizado_em": "2022 (populacao) / ano de referencia do PIB informado no arquivo",
        "metodologia": "Consulta direta a API SIDRA por codigo de municipio; 52/52 municipios com valores.",
        "precisao_geografica": "Nao se aplica.",
        "qualidade": "Alta — cobertura integral dos 52 municipios.",
    },
    {
        "id": "rodovias",
        "titulo": "Malha rodoviaria estadual (SNV)",
        "descricao": "Trechos de rodovias federais e estaduais com codigo BR, quilometragem, extensao, superficie e jurisdicao.",
        "formato": "GeoJSON",
        "status": "REAL",
        "orgao": "DNIT / SNV (servico publico ArcGIS)",
        "fonte": "FeatureServer publico 'Rodovias' (Sistema Nacional de Viaria)",
        "url": "https://services8.arcgis.com/WnoZVgMq9I8Pjaoc/arcgis/rest/services/Rodovias/FeatureServer/0",
        "licenca": "Servico publico ArcGIS Online — uso sujeito aos termos da Esri e do orgao publicador",
        "atualizado_em": "SNV 202604A",
        "metodologia": "Consulta espacial sobre a malha municipal; trecho mantido quando intersecta o territorio de RO.",
        "precisao_geografica": "Geometria de eixo com referencia linear (km inicial/final) — precisao de cadastro rodoviario.",
        "qualidade": "Alta para trechos federais (BR-364, BR-174, BR-319, BR-421, BR-425, BR-429, BR-435).",
    },
    {
        "id": "vias-estaduais",
        "titulo": "Malha viaria estadual/municipal (RO-xxx)",
        "descricao": "Segmentos de rodovias sob jurisdicao estadual identificadas com codigo RO.",
        "formato": "GeoJSON",
        "status": "REAL",
        "orgao": "Servico publico ArcGIS Online",
        "fonte": "FeatureServer publico 'Rondonia Roads'",
        "url": "https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/Rondonia_Roads/FeatureServer/0",
        "licenca": "Servico publico ArcGIS Online — uso sujeito aos termos da Esri e do orgao publicador",
        "atualizado_em": "Servico publico (data do servico)",
        "metodologia": "Selecao de segmentos cujo identificador corresponde ao padrao RO-xxx.",
        "precisao_geografica": "Posicionamento aproximado do traçado (base colaborativa).",
        "qualidade": "Media — usar como referencia de malha, nao como cadastro oficial de quilometragem.",
    },
    {
        "id": "obras",
        "titulo": "Obras publicas (base demonstrativa)",
        "descricao": "Obras por categoria, com fiscalizacao, contratos, valores e historico.",
        "formato": "GeoJSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica coerente com os 52 municipios e os trechos SNV reais",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica (semente 20261125) ancorada em municipios e trechos SNV reais; empresas sempre ficticias.",
        "precisao_geografica": "Pontos posicionados sobre o traçado rodoviaria ou dentro do poligono municipal.",
        "qualidade": "Demonstrativa — nao representa obras reais; 420 registros.",
    },
    {
        "id": "contratos",
        "titulo": "Contratos e aditivos (base demonstrativa)",
        "descricao": "Objetos, vigencias, valores contratados, empenhados, liquidados e pagos.",
        "formato": "JSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica; vinculo 1:N com obras, evitando duplicidade de valores.",
        "precisao_geografica": "Nao se aplica.",
        "qualidade": "Demonstrativa — 180 registros; razoes de tentativa exatas.",
    },
    {
        "id": "ativos",
        "titulo": "Ativos, pontes e dispositivos (base demonstrativa)",
        "descricao": "Inventario georreferenciado com condicao estrutural, criticidade e inspecoes.",
        "formato": "GeoJSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica ancorada em trechos SNV.",
        "precisao_geografica": "Pontos sobre o eixo rodoviario.",
        "qualidade": "Demonstrativa — 260 registros.",
    },
    {
        "id": "convenios",
        "titulo": "Convenios e transferencias (base demonstrativa)",
        "descricao": "Objeto, orgao concedente, beneficiario, valor, contrapartida, vigencia e situacao.",
        "formato": "JSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica.",
        "precisao_geografica": "Ponto de referencia no municipio.",
        "qualidade": "Demonstrativa — 95 registros.",
    },
    {
        "id": "maquinas",
        "titulo": "Maquinas e equipamentos (base demonstrativa)",
        "descricao": "Frota com identificacao patrimonial, unidade responsavel, disponibilidade e manutencao.",
        "formato": "JSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica; a movimentacao no mapa e SIMULADA e identificada.",
        "precisao_geografica": "Posicao de referencia nao georreferenciada.",
        "qualidade": "Demonstrativa — 140 registros.",
    },
    {
        "id": "vistorias",
        "titulo": "Vistorias de fiscalizacao (base demonstrativa)",
        "descricao": "Registros de vistoria com avanco fisico, inconformidades e responsavel.",
        "formato": "JSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica vinculada a obras em andamento.",
        "precisao_geografica": "Coordenadas herdadas da obra vistoriada.",
        "qualidade": "Demonstrativa — 120 registros.",
    },
    {
        "id": "serie-investimento",
        "titulo": "Serie historica de investimento (base demonstrativa)",
        "descricao": "Série mensal de investimento para evolucao temporal do painel executivo.",
        "formato": "JSON",
        "status": "SIMULADO",
        "orgao": "Demonstracao (semeada por scripts/gerar_dados_simulados.py)",
        "fonte": "Base sintetica",
        "url": "",
        "licenca": "Uso restrito a demonstracao tecnica",
        "atualizado_em": time.strftime("%Y-%m-%d"),
        "metodologia": "Geracao deterministica com tendencia e sazonalidade.",
        "precisao_geografica": "Nao se aplica.",
        "qualidade": "Demonstrativa — 2019 a 2026.",
    },
    {
        "id": "der-obras",
        "titulo": "Obras do DER-RO (sistema corporativo)",
        "descricao": "Cadastro oficial de obras em andamento, medicoes e contratos do DER-RO.",
        "formato": "FeatureServer / MapServer",
        "status": "INDISPONIVEL",
        "orgao": "DER-RO",
        "fonte": "Geoportal DER-RO / ArcGIS Enterprise do Estado",
        "url": "https://geo.der.ro.gov.br/",
        "licenca": "Uso interno do Estado — exige autorizacao e credencial de servico",
        "atualizado_em": "—",
        "metodologia": "Integracao via servicos REST autorizados (ver docs/INTEGRACAO_ARCGIS_ENTERPRISE.md).",
        "precisao_geografica": "Definida pelo cadastro do DER-RO.",
        "qualidade": "Aguardando autorizacao de acesso.",
    },
    {
        "id": "transparencia-ro",
        "titulo": "Portal da Transparencia de Rondonia (execucao Orcamentaria)",
        "descricao": "Receitas, despesas, convênios e orders de compra do Estado.",
        "formato": "API / relatorios",
        "status": "INDISPONIVEL",
        "orgao": "SEFIN / Secretaria de Controle interno",
        "fonte": "Portal da Transparencia de RO",
        "url": "https://transparencia.ro.gov.br/",
        "licenca": "Dados publicos — integrate via API oficial do portal",
        "atualizado_em": "—",
        "metodologia": "Consumo da API oficial do portal, com cache e registro de atualizacao.",
        "precisao_geografica": "Nao se aplica.",
        "qualidade": "Aguardando homologacao da API pelo orgao.",
    },
    {
        "id": "snv-oficial",
        "titulo": "Cadastro SNV oficial (DER-RO/DNIT)",
        "descricao": "Cadastro oficial de trecho com atos legais, superficie e responsavel pela concessao.",
        "formato": "FeatureServer",
        "status": "INDISPONIVEL",
        "orgao": "DNIT / DER-RO",
        "fonte": "Servico SNV institucional",
        "url": "https://servicos.dnit.gov.br/",
        "licenca": "Servico publico com restricao de uso institucional",
        "atualizado_em": "—",
        "metodologia": "Consulta REST com credencial do servico.",
        "precisao_geografica": "Cadastro oficial.",
        "qualidade": "Aguardando credencial de acesso.",
    },
    {
        "id": "areas-protegidas",
        "titulo": "Areas de protecao e uso restrito em Rondonia",
        "descricao": "Base ambiental para analise de interferencia socioambiental (APP 11).",
        "formato": "GeoJSON",
        "status": "REAL",
        "orgao": "Servico publico ArcGIS Online",
        "fonte": "FeatureServer publico 'Rondonia Protected Forests'",
        "url": "https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/Rondonia_Protected_Forests/FeatureServer/0",
        "licenca": "Servico publico ArcGIS Online — uso sujeito aos termos da Esri e do orgao publicador",
        "atualizado_em": "Servico publico (data do servico)",
        "metodologia": "Consulta REST publica e conversao de EsriJSON para GeoJSON com preservacao dos aneis.",
        "precisao_geografica": "Poligonos de area de protecao — precisao definida pelo orgao publicador.",
        "qualidade": "Media — 52 areas; base de exploracao, nao substitui parecer ambiental oficial.",
    },
]


def main():
    saida = {
        "projeto": "CENTRAL INFRA RO 360",
        "gerado_em": time.strftime("%Y-%m-%d"),
        "modo_padrao": "demonstracao",
        "observacao": (
            "Fontes marcadas como REAL sao consultaveis publicamente e foram validadas por "
            "scripts/fetch_dados_reais.py. Fontes SIMULADAS sao bases demonstrativas coerentes, "
            "identificadas na interface. Fontes INDISPONIVEL exigem autorizacao do Estado."
        ),
        "fontes": FONTES,
    }
    os.makedirs(DATA, exist_ok=True)
    caminho = os.path.join(DATA, "fontes.json")
    with open(caminho, "w", encoding="utf-8") as fh:
        json.dump(saida, fh, ensure_ascii=False, indent=1)
    print(f"-> data/fontes.json ({len(FONTES)} fontes)")


if __name__ == "__main__":
    main()
