# Modelo de dados — CENTRAL INFRA RO 360

## 1. Entidades e relacionamentos

```
MUNICÍPIO ──< OBRA ──< MEDIÇÃO
    │           │  └──< EVIDÊNCIA_FOTOGRÁFICA
    │           └──< VISTORIA
    │
    ├──< ATIVO ──< INSPEÇÃO
    │       └── PONTES (1:1)
    │
    ├──< TRECHO_RODOVIARIO >── RODOVIA
    │
    ├──< CONVÊNIO
    ├──< EQUIPAMENTO
    ├──< INDICADOR
    ├──< PROJETO ──< OBRAS (1:N)
    ├──< ALERTA
    └──< CONTRATO ──> EMPRESA
              └──< OBRAS (1:N)

USUÁRIO ──< AUDITORIA
FONTE_FINANCIAMENTO ──> OBRA / CONTRATO / CONVÊNIO / PROJETO
```

## 2. Chaves e identificadores

| Entidade | Chave primária | Identificador oficial | Observação |
|---|---|---|---|
| Município | `uuid` | `codigo_ibge char(7)` | Código IBGE é a chave natural (ex.: `1100203`) |
| Rodovia | `uuid` | `codigo_rodovia` (BR-364, RO-435) | PK do SNV quando aplicável |
| Trecho | `uuid` | `codigo_snv` | Unique no banco; referência linear em `km_inicial`/`km_final` |
| Obra | `uuid` | `codigo` (OBR-RO-2026-0001) | Código sequencial legível |
| Contrato | `uuid` | `codigo` (CT-1234/2026) | |
| Medição | `uuid` | `numero` por obra | |
| Ativo / Ponte | `uuid` | `codigo` (ATIVO-RO-0001) | Ponte é 1:1 com Ativo |
| Inspeção | `uuid` | — | |
| Convênio | `uuid` | `codigo` (CV-RO-0001) | |
| Empresa | `uuid` | `cnpj` | Somente em produção |
| Equipamento | `uuid` | `patrimonial` | |
| Usuário | `uuid` | `arcgis_sub` | Identidade vinda do ArcGIS Enterprise |
| Indicador | `uuid` | `codigo` | |
| Projeto | `uuid` | `codigo` | |
| Fonte de financiamento | `uuid` | `nome` | |
| Alerta | `uuid` | — | |
| Evidência fotográfica | `uuid` | — | |
| Auditoria | `uuid` | — | Somente escrita no backend |

## 3. Sistemas de referência

- **Apresentação (web):** WGS84 (EPSG:4326) —requirement do ArcGIS Maps SDK.
- **Armazenamento (PostGIS):** SIRGAS 2000 / UTM **21S (EPSG:31982)** para a
  maior parte do estado (leste de 66° W) e **20S (EPSG:31981)** para a faixa
  oeste. O esquema usa `geometry(..., 31982)`; a conversão é exposta em
  `GET /api/conversao` e o cliente converte na visualização.
- A malha municipal de origem (IBGE 2020) é geográfica; a projeção é aplicada
  na carga do backend.

## 4. Regras de integridade

1. **Sem dupla contagem:** o valor financeiro de uma obra pertence ao
   contrato; ao somar "investimento", o painel soma `obra.valor_atualizado` e
   `contrato.valor_atualizado` em painéis separados (nunca juntos).
2. **Sem duplicidade:** `codigo`, `codigo_ibge`, `codigo_snv` e
   `codigo_rodovia` têm restrição `UNIQUE`; a carga usa `ON CONFLICT DO
   NOTHING` quando o registro já existe.
3. **Valores monetários:** `numeric(16,2)`; percentuais `numeric(6,2)`.
4. **Referência linear:** `km_inicial`/`km_final`stored no trecho; a ficha de
   obra exibe o km do trecho vinculado.
5. **Geometrias:** `Point` para obras/ativos/convênios/equipamentos,
   `LineString` para trechos, `MultiPolygon` para municípios e áreas de
   proteção; índices espaciais GIST em todas.

## 5. Catálogo de entidades (detalhe)

### Município
`codigo_ibge`, `nome`, `uf`, `area_km2`, `populacao`, `ano_populacao`,
`pib_milhoes`, `ano_pib`, `centroide` (Point 4326), `geom` (MultiPolygon 31982).

### Rodovia / Trecho rodoviário
`codigo_rodovia`, `sigla_tipo` (BR/RO), `nome`, `jurisdicao`, `superficie`
(PAV/PAR/PLA), `extensao_km`, `versao_snv`; no trecho: `km_inicial`,
`km_final`, `local_inicial`, `local_final`, `geom`.

### Obra
`codigo`, `titulo`, `categoria`, `municipio_codigo`, `rodovia`, `km`,
`orgao_responsavel`, `empresa_id`, `contrato_id`, `valor_inicial`,
`valor_atualizado`, `percentual_execucao_fisica`,
`percentual_execucao_financeira`, `situacao`, `data_inicio`,
`data_fim_prevista`, `fonte_recurso`, `geom`.

### Contrato
`codigo`, `objeto`, `empresa_id`, `vigencia_inicio`, `vigencia_fim`,
`modalidade`, `valor_inicial`, `valor_aditivos`, `valor_atualizado`,
`valor_empenhado`, `valor_liquidado`, `valor_pago`, `saldo`, `situacao`.
> A distinção contratado → empenhado → liquidado → pago é o que permite os
> indicadores de execução financeira do APP 04.

### Medição
`obra_id`, `numero`, `data`, `percentual_fisico`, `valor_medido`,
`responsavel`, `observacao`.

### Ativo / Ponte / Inspeção
Ativo: `codigo`, `tipo`, `municipio_codigo`, `rodovia`, `km`, `condicao`,
`criticidade`, `capacidade`, `ano_implantacao`, `ultima_inspecao`, `geom`.
Ponte: `ativo_id`, `vao`, `comprimento_total`, `material`, `altura_livre`.
Inspeção: `ativo_id`, `data`, `responsavel`, `condicao`, `parecer`.

### Convênio
`codigo`, `objeto`, `orgao_concedente`, `beneficiario`, `valor`,
`contrapartida`, `desembolsado`, `saldo`, `vigencia_inicio`, `vigencia_fim`,
`situacao`, `geom`.

### Equipamento (máquina)
`codigo`, `tipo`, `patrimonial`, `unidade_responsavel`, `disponibilidade`,
`situacao`, `horas_operacao`, `ultima_manutencao`, `geom`.

### Vistoria e evidência
Vistoria: `obra_id`, `data`, `responsavel`, `percentual_avanco`,
`inconformidades`, `observacoes`, `geom` (ponto GPS), `fotos` (jsonb),
`situacao`, `criado_por`, `criado_em`.
Evidência: `vistoria_id`, `obra_id`/`ativo_id`, `legenda`, `data`, `url`.

### Planejamento
Projeto: `codigo`, `titulo`, `municipio_codigo`, `obra_id`, `ppa`, `ldo`,
`loa`, `programa`, `custo_estimado`, `maturidade`, `criticidade`,
`disponibilidade_orcamentaria`.
Fonte de financiamento: `nome`, `tipo`, `esfera`, `orgao`.
Indicador: `codigo`, `nome`, `unidade`, `periodicidade`, `metodologia`,
`fonte`, `municipio_codigo`, `ano`, `valor`.

### Administração
Usuário: `arcgis_sub`, `nome`, `email`, `perfil`, `organizacao`, `ativo`.
Auditoria: `usuario`, `acao`, `entidade`, `entidade_id`, `detalhe`, `dados`
(jsonb), `criado_em`.

## 6. Diagrama textual

```
municipio ──1:N── obra ──1:N── medicao
municipio ──1:N── ativo ──1:N── inspecao
municipio ──1:N── convenio
municipio ──1:N── equipamento
municipio ──1:N── indicador
municipio ──1:N── projeto ──N:1── obra
rodovia  ──1:N── trecho_rodoviario
contrato ──N:1── empresa
contrato ──1:N── obra
usuario  ──1:N── auditoria
```
