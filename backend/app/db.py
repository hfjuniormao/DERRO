"""
Camada de acesso a dados (PostgreSQL/PostGIS) com fallback em memoria.

Se `psycopg` e um PostgreSQL/PostGIS estiverem disponiveis, todas as consultas
vao para o banco. Caso contrario, a API sobe em modo memoria — util para
desenvolvimento local e para os testes automatizados, jamais para producao.
"""
from __future__ import annotations

import json
import math
import secrets
import time
import uuid
from typing import Any, Dict, List, Optional

from .config import settings
from .models import CONTRATO, OBRA, USUARIO, VISTORIA, Conversao, Obra, Usuario, Vistoria

try:  # pragma: no cover - depende do ambiente
    import psycopg  # type: ignore
    from psycopg.rows import dict_row  # type: ignore

    PSYCG_DISPONIVEL = True
except Exception:  # noqa: BLE001
    PSYCG_DISPONIVEL = False


class Database:
    def __init__(self, url: str) -> None:
        self.url = url
        self.conexao = None
        self.sessoes: Dict[str, Dict[str, Any]] = {}
        self.memoria: Dict[str, List[Dict[str, Any]]] = {
            "obras": [],
            "contratos": [],
            "vistorias": [],
            "auditoria": [],
            "usuarios": [],
        }

    # ------------------------------------------------------------- conexao
    def conectar_postgis(self) -> bool:
        if not PSYCG_DISPONIVEL:
            return False
        try:  # pragma: no cover - depende do ambiente
            self.conexao = psycopg.connect(self.url, row_factory=dict_row)
            return True
        except Exception as erro:  # noqa: BLE001
            print(f"[db] PostGIS indisponivel ({erro}); usando memoria.")
            self.conexao = None
            return False

    def status_postgis(self) -> str:
        if not PSYCG_DISPONIVEL:
            return "modulo-psycopg-ausente"
        if self.conexao is None:
            return "desconectado"
        return "conectado"

    def aplicar_schema(self) -> None:
        if not self.conexao:
            return
        import os

        caminho = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sql", "schema.sql")
        if not os.path.exists(caminho):
            return
        with open(caminho, encoding="utf-8") as fh:
            sql = fh.read()
        with self.conexao.cursor() as cur:  # pragma: no cover
            cur.execute(sql)
        self.conexao.commit()

    def seed_perfis(self) -> None:
        for perfil in ("cidadao", "gestor", "analista", "fiscal", "contratos", "admin"):
            self.memoria["perfis"].append({"id": perfil}) if "perfis" in self.memoria else self.memoria.setdefault("perfis", []).append({"id": perfil})

    # -------------------------------------------------------------- sessao
    def emitir_sessao(self, claims: Dict[str, Any]) -> str:
        token = secrets.token_urlsafe(40)
        self.sessoes[token] = {
            **claims,
            "expira_em": time.time() + settings.sessao_ttl_segundos,
        }
        return token

    def validar_sessao(self, token: str) -> Optional[Dict[str, Any]]:
        sessao = self.sessoes.get(token)
        if not sessao:
            return None
        if sessao.get("expira_em", 0) < time.time():
            self.sessoes.pop(token, None)
            return None
        return sessao

    # ------------------------------------------------------- token ArcGIS
    async def trocar_token_arcgis(
        self, code: str, code_verifier: str, redirect_uri: str
    ) -> Optional[Dict[str, Any]]:
        """Troca o codigo de autorizacao por um token no portal ArcGIS.

        Requer `ARCGIS_CLIENT_SECRET` no servidor — o frontend nunca deve
        enviar nem armazenar o segredo do aplicativo.
        """
        if not PSYCG_DISPONIVEL:
            return None
        import urllib.request  # pragma: no cover

        payload = json.dumps(  # pragma: no cover
            {
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": code_verifier,
                "client_id": settings.arcgis_client_id,
                "client_secret": settings.arcgis_client_secret,
                "redirect_uri": redirect_uri,
            }
        ).encode()
        request = urllib.request.Request(  # pragma: no cover
            f"https://{settings.arcgis_portal_id}.arcgis.com/oauth2/token",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:  # pragma: no cover
            with urllib.request.urlopen(request, timeout=20) as resposta:
                token = json.loads(resposta.read().decode())
        except Exception:  # noqa: BLE001
            return None
        return {  # pragma: no cover
            "sub": token.get("sub") or token.get("user_id"),
            "nome": token.get("name") or token.get("username") or "Usuario",
            "email": token.get("email"),
            "perfil": "analista",
        }

    # -------------------------------------------------------------- obras
    def listar_obras(
        self,
        municipio: Optional[str] = None,
        categoria: Optional[str] = None,
        situacao: Optional[str] = None,
        ano_inicio: Optional[int] = None,
        ano_fim: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        if self.conexao:
            condicoes = ["1=1"]
            valores: List[Any] = []
            if municipio:
                condicoes.append("municipio_codigo = %s")
                valores.append(municipio)
            if categoria:
                condicoes.append("categoria = %s")
                valores.append(categoria)
            if situacao:
                condicoes.append("situacao = %s")
                valores.append(situacao)
            if ano_inicio:
                condicoes.append("EXTRACT(YEAR FROM data_inicio) >= %s")
                valores.append(ano_inicio)
            if ano_fim:
                condicoes.append("EXTRACT(YEAR FROM data_inicio) <= %s")
                valores.append(ano_fim)
            sql = f"SELECT * FROM obra WHERE {' AND '.join(condicoes)} ORDER BY data_inicio DESC"
            with self.conexao.cursor() as cur:  # pragma: no cover
                cur.execute(sql, valores)
                return [dict(linha) for linha in cur.fetchall()]
        return [
            obra
            for obra in self.memoria["obras"]
            if (not municipio or obra.get("municipio_codigo") == municipio)
            and (not categoria or obra.get("categoria") == categoria)
            and (not situacao or obra.get("situacao") == situacao)
        ]

    def obter_obra(self, obra_id: str) -> Optional[Dict[str, Any]]:
        for obra in self.memoria["obras"]:
            if obra.get("id") == obra_id:
                return obra
        if self.conexao:  # pragma: no cover
            with self.conexao.cursor() as cur:
                cur.execute("SELECT * FROM obra WHERE id = %s", (obra_id,))
                linha = cur.fetchone()
                return dict(linha) if linha else None
        return None

    # ---------------------------------------------------------- contratos
    def listar_contratos(self, municipio: Optional[str] = None, situacao: Optional[str] = None) -> List[Dict[str, Any]]:
        return [
            contrato
            for contrato in self.memoria["contratos"]
            if (not municipio or contrato.get("municipio") == municipio)
            and (not situacao or contrato.get("situacao") == situacao)
        ]

    # ----------------------------------------------------------- vistorias
    def inserir_vistoria(self, vistoria: Vistoria) -> None:
        self.memoria["vistorias"].append(vistoria.to_dict())
        if self.conexao:  # pragma: no cover
            with self.conexao.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO vistoria (id, obra_id, data, responsavel, percentual_avanco,
                                          inconformidades, observacoes, geom, fotos, situacao,
                                          criado_por, criado_em)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,
                            ST_SetSRID(ST_MakePoint(%s,%s), 31982),
                            %s::jsonb,%s,%s,%s)
                    """,
                    (
                        vistoria.id,
                        vistoria.obra_id,
                        vistoria.data,
                        vistoria.responsavel,
                        vistoria.percentual_avanco,
                        vistoria.inconformidades,
                        vistoria.observacoes,
                        vistoria.longitude,
                        vistoria.latitude,
                        json.dumps(vistoria.fotos),
                        vistoria.situacao,
                        vistoria.criado_por,
                        vistoria.criado_em,
                    ),
                )
            self.conexao.commit()

    # ---------------------------------------------------------- auditoria
    def registrar_auditoria(
        self,
        usuario: Optional[str],
        acao: str,
        entidade: str,
        entidade_id: Optional[str],
        detalhe: Optional[str] = None,
        **extra: Any,
    ) -> None:
        registro = {
            "id": str(uuid.uuid4()),
            "usuario": usuario,
            "acao": acao,
            "entidade": entidade,
            "entidade_id": entidade_id,
            "detalhe": detalhe,
            "dados": extra,
            "criado_em": time.time(),
        }
        self.memoria["auditoria"].append(registro)
        if self.conexao:  # pragma: no cover
            with self.conexao.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO auditoria (id, usuario, acao, entidade, entidade_id, detalhe, dados)
                    VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb)
                    """,
                    (
                        registro["id"],
                        usuario,
                        acao,
                        entidade,
                        entidade_id,
                        detalhe,
                        json.dumps(extra),
                    ),
                )
            self.conexao.commit()

    def listar_auditoria(self, limite: int = 100) -> List[Dict[str, Any]]:
        return list(reversed(self.memoria["auditoria"]))[:limite]

    def listar_usuarios(self) -> List[Dict[str, Any]]:
        return list(self.memoria["usuarios"])

    # ------------------------------------------------------- projecao SIRGAS
    def converter_sirgas(self, lon: float, lat: float) -> Dict[str, Any]:
        """Converte WGS84 -> SIRGAS 2000 / UTM (21S ou 20S conforme a faixa)."""
        zona = 21 if lon >= -66.0 else 20
        srid = 31982 if zona == 21 else 31981
        x, y = _wgs84_para_utm(lon, lat, zona)
        return {
            "srid": srid,
            "zona": zona,
            "x": round(x, 3),
            "y": round(y, 3),
            "origem": {"lon": lon, "lat": lat, "srid": 4326},
        }


def _wgs84_para_utm(lon: float, lat: float, zona: int) -> tuple:
    """Transformacao simplificada (fórmula de Snyder) — precisão métrica."""
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    lon0 = math.radians((zona - 1) * 6 - 180 + 3)
    e2 = f * (2 - f)
    phi = math.radians(lat)
    lam = math.radians(lon)
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2
    c = e2 * math.cos(phi) ** 2
    aa = math.cos(phi) * (lam - lon0)
    m = a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * phi)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * phi)
        - (35 * e2**3 / 3072) * math.sin(6 * phi)
    )
    x = k0 * n * (
        aa
        + (1 - t + c) * aa**3 / 6
        + (5 - 18 * t + t**2 + 72 * c - 58 * e2) * aa**5 / 120
    ) + 500000
    y = k0 * (
        m
        + n * math.tan(phi) * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24)
    )
    return x, y
