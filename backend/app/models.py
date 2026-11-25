"""
Modelos de dominio e nomes de tabelas do backend.

As entidades seguem a modelagem documentada em docs/MODELO_DE_DADOS.md:
Municipio, Rodovia, Trecho, Obra, Contrato, Medicao, Ativo, Ponte, Inspecao,
Convenio, Empresa, Equipamento, Usuario, Indicador, Projeto, FonteFinanciamento,
Alerta e EvidenciaFotografica.

Chaves: UUID (id), codigo IBGE (municipio) e identificador oficial de rodovia.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

# Nomes de tabelas (fonte unica de verdade)
MUNICIPIO = "municipio"
RODOVIA = "rodovia"
TRECHO = "trecho_rodoviario"
OBRA = "obra"
CONTRATO = "contrato"
MEDICAO = "medicao"
ATIVO = "ativo"
PONTE = "ponte"
INSPECAO = "inspecao"
CONVENIO = "convenio"
EMPRESA = "empresa"
EQUIPAMENTO = "equipamento"
USUARIO = "usuario"
INDICADOR = "indicador"
PROJETO = "projeto"
FONTE_FINANCIAMENTO = "fonte_financiamento"
ALERTA = "alerta"
EVIDENCIA = "evidencia_fotografica"
VISTORIA = "vistoria"
AUDITORIA = "auditoria"

PERFIS = ("cidadao", "gestor", "analista", "fiscal", "contratos", "admin")


@dataclass
class Conversao:
    """Metadados de conversao de sistemas de referencia."""

    srid_origem: int = 4326
    srid_destino: int = 31982
    metodo: str = "Snyder (fórmula simplificada)"
    datum: str = "SIRGAS 2000"


@dataclass
class Usuario:
    id: str
    nome: str
    email: Optional[str] = None
    perfil: str = "cidadao"
    organizacao: Optional[str] = None
    ativo: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Obra:
    id: str
    titulo: str
    municipio_codigo: str
    categoria: str
    situacao: str
    orgao_responsavel: str
    empresa_id: Optional[str] = None
    contrato_id: Optional[str] = None
    rodovia: Optional[str] = None
    km: Optional[float] = None
    valor_inicial: float = 0.0
    valor_atualizado: float = 0.0
    percentual_execucao_fisica: float = 0.0
    percentual_execucao_financeira: float = 0.0
    data_inicio: Optional[str] = None
    data_fim_prevista: Optional[str] = None
    fonte_recurso: Optional[str] = None
    geometria: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Vistoria:
    id: str
    obra_id: str
    data: str
    responsavel: str
    percentual_avanco: Optional[float] = None
    inconformidades: int = 0
    observacoes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    fotos: List[Dict[str, Any]] = field(default_factory=list)
    situacao: str = "registrada"
    criado_por: Optional[str] = None
    criado_em: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
