"""
Configuracao do backend (somente variaveis de ambiente — nunca no codigo).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List


def _lista(valor: str) -> List[str]:
    return [item.strip() for item in (valor or "").split(",") if item.strip()]


@dataclass
class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://central_infra:central_infra@localhost:5433/central_infra_ro",
    )
    arcgis_portal_id: str = os.getenv("ARCGIS_PORTAL_ID", "")
    arcgis_client_id: str = os.getenv("ARCGIS_CLIENT_ID", "")
    arcgis_client_secret: str = os.getenv("ARCGIS_CLIENT_SECRET", "")
    arcgis_referencia_id: str = os.getenv("ARCGIS_REFERENCIA_ID", "")
    srid_principal: int = int(os.getenv("SRID_PRINCIPAL", "31982"))  # SIRGAS 2000 / UTM 21S
    srid_secundario: int = int(os.getenv("SRID_SECUNDARIO", "31981"))  # SIRGAS 2000 / UTM 20S
    cors_origins: List[str] = field(
        default_factory=lambda: _lista(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))
    )
    sessao_ttl_segundos: int = int(os.getenv("SESSAO_TTL", "28800"))


settings = Settings()
