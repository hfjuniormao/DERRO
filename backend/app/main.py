"""
CENTRAL INFRA RO 360 — Backend de producao (opcional).

FastAPI + PostgreSQL/PostGIS. Este backend e o unico ponto onde a seguranca
deve ser aplicada: validacao de token ArcGIS (OAuth 2.0), perfil do usuario,
regras de permissao e trilha de auditoria.

A aplicacao frontend (Vite/ArcGIS Maps SDK) funciona em modo demonstracao sem
este servico; com ele, o frontend troca o codigo OAuth por um token de sessao
e passa a exigir o backend para gravacoes (vistorias, cadastros, auditoria).

Execucao local:
    pip install -r backend/requirements.txt
    docker compose -f backend/docker-compose.postgis.yml up -d
    uvicorn backend.app.main:app --reload --port 8000
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .db import Database, init_db
from .models import (  # noqa: F401  (nomes de tabelas usados pelo schema SQL)
    AUDITORIA,
    CONTRATO,
    OBRA,
    USUARIO,
    VISTORIA,
    Conversao,
    Obra,
    Usuario,
    Vistoria,
)

app = FastAPI(
    title="CENTRAL INFRA RO 360 — API",
    version="1.0.0",
    description="API de producao para a Plataforma de Inteligencia Geografica de Rondonia.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
)

db = Database(settings.database_url)


# --------------------------------------------------------------------- modelos
class TokenRequest(BaseModel):
    code: str = Field(..., description="Codigo de autorizacao devolvido pelo ArcGIS")
    code_verifier: str = Field(..., description="Verificador PKCE gerado no frontend")
    redirect_uri: str


class SessaoToken(BaseModel):
    token_acesso: str
    perfil: str
    nome: str
    email: Optional[str] = None
    expira_em: Optional[str] = None


class VistoriaCreate(BaseModel):
    obra_id: str
    data: str
    responsavel: str
    percentual_avanco: Optional[float] = None
    inconformidades: int = 0
    observacoes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    fotos: List[Dict[str, Any]] = Field(default_factory=list)
    situacao: str = "registrada"


# ------------------------------------------------------------------- seguranca
def perfil_claims(authorization: Optional[str]) -> Dict[str, Any]:
    """Extrai as claims do token validado pelo ArcGIS Enterprise.

    Em producao, `authorization` contem o token JWT emitido pelo portal. Este
    exemplo valida apenas a presenca do token e a expiracao do token de sessao
    emitido pelo proprio backend; a validacao criptografica do token ArcGIS deve
    ser plugada aqui (JWKS do portal).
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso ausente. Autentique-se pelo ArcGIS Enterprise.",
        )
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token vazio.")
    claims = db.validar_sessao(token)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao expirada ou invalida.")
    return claims


def exigir_perfil(*perfis: str):
    def dependencia(claims: Dict[str, Any] = Depends(perfil_claims)) -> Dict[str, Any]:
        if claims.get("perfil") not in perfis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Perfil '{claims.get('perfil')}' sem permissao para esta operacao.",
            )
        return claims

    return dependencia


@app.on_event("startup")
async def startup() -> None:
    init_db(db)
    db.conectar_postgis()
    db.aplicar_schema()
    db.seed_perfis()


# ---------------------------------------------------------------------- rotas
@app.get("/api/health", tags=["operacao"])
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "servico": "central-infra-ro-api",
        "versao": app.version,
        "postgis": db.status_postgis(),
        "hora": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/auth/arcgis/token", response_model=SessaoToken, tags=["autenticacao"])
async def trocar_token(payload: TokenRequest) -> SessaoToken:
    """Troca o codigo de autorizacao por um token de sessao do backend.

    O `client_secret` do aplicativo ArcGIS fica SOMENTE no backend
    (variavel de ambiente ARCGIS_CLIENT_SECRET) e nunca no frontend.
    """
    if not settings.arcgis_client_secret or not settings.arcgis_portal_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth ArcGIS nao configurado no backend.",
        )
    claims = await db.trocar_token_arcgis(payload.code, payload.code_verifier, payload.redirect_uri)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falha na troca do token ArcGIS.")
    token = db.emitir_sessao(claims)
    return SessaoToken(
        token_acesso=token,
        perfil=claims.get("perfil", "cidadao"),
        nome=claims.get("nome", "Usuario"),
        email=claims.get("email"),
        expira_em=claims.get("expira_em"),
    )


@app.get("/api/obras", tags=["dados"])
async def listar_obras(
    municipio: Optional[str] = None,
    categoria: Optional[str] = None,
    situacao: Optional[str] = None,
    ano_inicio: Optional[int] = None,
    ano_fim: Optional[int] = None,
    claims: Dict[str, Any] = Depends(perfil_claims),
) -> List[Dict[str, Any]]:
    return db.listar_obras(municipio, categoria, situacao, ano_inicio, ano_fim)


@app.get("/api/obras/{obra_id}", tags=["dados"])
async def obter_obra(obra_id: str, claims: Dict[str, Any] = Depends(perfil_claims)) -> Dict[str, Any]:
    obra = db.obter_obra(obra_id)
    if not obra:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Obra nao encontrada.")
    return obra


@app.get("/api/contratos", tags=["dados"])
async def listar_contratos(
    municipio: Optional[str] = None,
    situacao: Optional[str] = None,
    claims: Dict[str, Any] = Depends(perfil_claims),
) -> List[Dict[str, Any]]:
    return db.listar_contratos(municipio, situacao)


@app.post("/api/vistorias", tags=["fiscalizacao"])
async def registrar_vistoria(
    payload: VistoriaCreate,
    claims: Dict[str, Any] = Depends(exigir_perfil("fiscal", "admin")),
) -> Dict[str, Any]:
    """Registra vistoria com trilha de auditoria (exige perfil de fiscal)."""
    vistoria = Vistoria(
        id=str(uuid.uuid4()),
        obra_id=payload.obra_id,
        data=payload.data,
        responsavel=payload.responsavel,
        percentual_avanco=payload.percentual_avanco,
        inconformidades=payload.inconformidades,
        observacoes=payload.observacoes,
        latitude=payload.latitude,
        longitude=payload.longitude,
        fotos=payload.fotos,
        situacao=payload.situacao,
        criado_por=claims.get("sub"),
        criado_em=datetime.now(timezone.utc).isoformat(),
    )
    db.inserir_vistoria(vistoria)
    db.registrar_auditoria(
        claims.get("sub"),
        "criar_vistoria",
        "vistoria",
        vistoria.id,
        f"obra={payload.obra_id}; avanco={payload.percentual_avanco}",
        perfil=claims.get("perfil"),
    )
    return {"id": vistoria.id, "criado_em": vistoria.criado_em}


@app.get("/api/auditoria", tags=["administracao"])
async def listar_auditoria(
    limite: int = 100,
    claims: Dict[str, Any] = Depends(exigir_perfil("admin")),
) -> List[Dict[str, Any]]:
    return db.listar_auditoria(limite)


@app.get("/api/usuarios", tags=["administracao"])
async def listar_usuarios(
    claims: Dict[str, Any] = Depends(exigir_perfil("admin")),
) -> List[Dict[str, Any]]:
    return db.listar_usuarios()


@app.get("/api/conversao", tags=["dados"])
async def converter_para_sirgas(
    lon: float,
    lat: float,
    claims: Dict[str, Any] = Depends(perfil_claims),
) -> Dict[str, Any]:
    """Converte lon/lat (WGS84) para SIRGAS 2000 / UTM (EPSG:31982 ou 31981)."""
    return db.converter_sirgas(lon, lat)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
