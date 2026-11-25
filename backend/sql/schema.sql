-- ==========================================================================
-- CENTRAL INFRA RO 360 — Schema PostgreSQL/PostGIS (backend de producao)
--
-- SIRGAS 2000 / UTM 21S (EPSG:31982) como sistema de armazenamento dos
-- municipios que estao a leste de 66°W; SIRGAS 2000 / UTM 20S (EPSG:31981)
-- para a faixa oeste. O frontend apresenta em WGS84 (EPSG:4326).
--
-- Chaves: UUID nativo (id), codigo IBGE (municipio_codigo) e identificador
-- oficial de rodovia (codigo_rodovia).
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------- municipio
CREATE TABLE IF NOT EXISTS municipio (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_ibge     char(7) UNIQUE NOT NULL,
    nome            text NOT NULL,
    uf              char(2) NOT NULL DEFAULT 'RO',
    area_km2        numeric(12,2),
    populacao       integer,
    ano_populacao   smallint,
    pib_milhoes     numeric(14,1),
    ano_pib         smallint,
    centroide       geometry(Point, 4326),
    geom            geometry(MultiPolygon, 31982),
    atualizado_em   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_municipio_geom ON municipio USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_municipio_centroide ON municipio USING GIST (centroide);

-- ----------------------------------------------------------------- rodovia
CREATE TABLE IF NOT EXISTS rodovia (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_rodovia  text UNIQUE NOT NULL,          -- BR-364, RO-435...
    sigla_tipo      char(2),
    nome            text,
    jurisdicao       text,                          -- Federal / Estadual / Municipal
    superficie      text,                          -- PAV / PAR / PLA
    extensao_km     numeric(10,2),
    versao_snv      text,
    atualizado_em   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trecho_rodoviario (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_snv      text UNIQUE,
    rodovia_id      uuid REFERENCES rodovia(id),
    municipio_codigo char(7) REFERENCES municipio(codigo_ibge),
    km_inicial      numeric(10,2),                 -- referencia linear
    km_final        numeric(10,2),
    local_inicial   text,
    local_final     text,
    geom            geometry(LineString, 31982),
    atualizado_em   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trecho_geom ON trecho_rodoviario USING GIST (geom);

-- ------------------------------------------------------------------- obra
CREATE TABLE IF NOT EXISTS obra (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo                   text UNIQUE NOT NULL,        -- OBR-RO-2026-0001
    titulo                   text NOT NULL,
    categoria                text NOT NULL,
    municipio_codigo         char(7) REFERENCES municipio(codigo_ibge),
    rodovia                  text,
    km                       numeric(10,2),
    orgao_responsavel        text,
    empresa_id               uuid,
    contrato_id              uuid,
    valor_inicial            numeric(16,2) DEFAULT 0,
    valor_atualizado         numeric(16,2) DEFAULT 0,
    percentual_execucao_fisica    numeric(6,2) DEFAULT 0,
    percentual_execucao_financeira numeric(6,2) DEFAULT 0,
    situacao                 text NOT NULL,
    data_inicio              date,
    data_fim_prevista        date,
    fonte_recurso            text,
    geom                     geometry(Point, 31982),
    atualizado_em            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obra_geom ON obra USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_obra_municipio ON obra (municipio_codigo);
CREATE INDEX IF NOT EXISTS idx_obra_situacao ON obra (situacao);

-- ---------------------------------------------------------------- empresa
CREATE TABLE IF NOT EXISTS empresa (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social  text NOT NULL,
    cnpj          text,
    habilitacao   date,
    criado_em     timestamptz DEFAULT now()
);

-- --------------------------------------------------------------- contrato
CREATE TABLE IF NOT EXISTS contrato (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo              text UNIQUE NOT NULL,
    objeto              text NOT NULL,
    empresa_id          uuid REFERENCES empresa(id),
    orgao               text,
    municipio_codigo    char(7) REFERENCES municipio(codigo_ibge),
    vigencia_inicio     date,
    vigencia_fim        date,
    modalidade          text,
    valor_inicial       numeric(16,2) DEFAULT 0,
    valor_aditivos      numeric(16,2) DEFAULT 0,
    valor_atualizado    numeric(16,2) DEFAULT 0,
    valor_empenhado     numeric(16,2) DEFAULT 0,
    valor_liquidado     numeric(16,2) DEFAULT 0,
    valor_pago          numeric(16,2) DEFAULT 0,
    saldo               numeric(16,2) DEFAULT 0,
    situacao            text,
    atualizado_em       timestamptz DEFAULT now()
);

-- -------------------------------------------------------------- medicao
CREATE TABLE IF NOT EXISTS medicao (
    id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id            uuid REFERENCES obra(id) ON DELETE CASCADE,
    numero             integer,
    data               date,
    percentual_fisico  numeric(6,2),
    valor_medido       numeric(16,2),
    responsavel        text,
    observacao         text,
    criado_em          timestamptz DEFAULT now()
);

-- ------------------------------------------------------------------ ativo
CREATE TABLE IF NOT EXISTS ativo (
    id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo           text UNIQUE NOT NULL,
    tipo             text NOT NULL,
    municipio_codigo char(7) REFERENCES municipio(codigo_ibge),
    rodovia          text,
    km               numeric(10,2),
    condicao         text,
    criticidade      text,
    capacidade       text,
    ano_implantacao  smallint,
    ultima_inspecao  date,
    geom             geometry(Point, 31982)
);
CREATE INDEX IF NOT EXISTS idx_ativo_geom ON ativo USING GIST (geom);

CREATE TABLE IF NOT EXISTS ponte (
    ativo_id       uuid PRIMARY KEY REFERENCES ativo(id) ON DELETE CASCADE,
    vao            numeric(10,2),
    comprimento_total numeric(10,2),
    material       text,
    altura_livre   numeric(8,2)
);

CREATE TABLE IF NOT EXISTS inspecao (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    ativo_id      uuid REFERENCES ativo(id) ON DELETE CASCADE,
    data          date,
    responsavel   text,
    condicao      text,
    parecer       text,
    criado_em     timestamptz DEFAULT now()
);

-- --------------------------------------------------------------- convenio
CREATE TABLE IF NOT EXISTS convenio (
    id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo             text UNIQUE NOT NULL,
    objeto             text NOT NULL,
    orgao_concedente   text,
    beneficiario       text,
    municipio_codigo   char(7) REFERENCES municipio(codigo_ibge),
    valor              numeric(16,2) DEFAULT 0,
    contrapartida      numeric(16,2) DEFAULT 0,
    desembolsado       numeric(16,2) DEFAULT 0,
    saldo              numeric(16,2) DEFAULT 0,
    vigencia_inicio    date,
    vigencia_fim       date,
    situacao           text,
    geom               geometry(Point, 31982)
);

-- ------------------------------------------------------------- equipamento
CREATE TABLE IF NOT EXISTS equipamento (
    id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo            text UNIQUE NOT NULL,
    tipo              text,
    patrimonial       text UNIQUE,
    unidade_responsavel text,
    municipio_codigo  char(7) REFERENCES municipio(codigo_ibge),
    disponibilidade    numeric(5,2),
    situacao          text,
    horas_operacao    integer,
    ultima_manutencao date,
    geom              geometry(Point, 31982)
);

-- ---------------------------------------------------------------- vistoria
CREATE TABLE IF NOT EXISTS vistoria (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id             uuid REFERENCES obra(id),
    data                date,
    responsavel         text,
    percentual_avanco   numeric(6,2),
    inconformidades     integer DEFAULT 0,
    observacoes         text,
    geom                geometry(Point, 31982),
    fotos               jsonb DEFAULT '[]'::jsonb,
    situacao            text DEFAULT 'registrada',
    criado_por          text,
    criado_em           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidencia_fotografica (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    vistoria_id  uuid REFERENCES vistoria(id) ON DELETE CASCADE,
    obra_id      uuid REFERENCES obra(id),
    ativo_id     uuid REFERENCES ativo(id),
    legenda      text,
    data         date,
    url          text
);

-- ------------------------------------------------------- planejamento
CREATE TABLE IF NOT EXISTS projeto (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo          text UNIQUE NOT NULL,
    titulo          text,
    municipio_codigo char(7) REFERENCES municipio(codigo_ibge),
    obra_id         uuid REFERENCES obra(id),
    ppa             text,                -- PPA
    ldo             text,                -- LDO
    loa             text,                -- LOA
    programa        text,
    custo_estimado  numeric(16,2),
    maturidade      text,
    criticidade     text,
    disponibilidade_orcamentaria numeric(6,2),
    atualizado_em   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonte_financiamento (
    id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome      text NOT NULL,
    tipo      text,
    esfera    text,
    orgao     text
);

CREATE TABLE IF NOT EXISTS indicador (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo         text UNIQUE NOT NULL,
    nome           text NOT NULL,
    unidade        text,
    periodicidade  text,
    metodologia    text,
    fonte          text,
    municipio_codigo char(7) REFERENCES municipio(codigo_ibge),
    ano            smallint,
    valor          numeric(18,4)
);

CREATE TABLE IF NOT EXISTS alerta (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo          text NOT NULL,
    severidade    text,
    titulo        text,
    descricao     text,
    entidade      text,
    entidade_id   text,
    vencimento    date,
    resolvido     boolean DEFAULT false,
    criado_em     timestamptz DEFAULT now()
);

-- ------------------------------------------------------- administracao
CREATE TABLE IF NOT EXISTS usuario (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    arcgis_sub     text UNIQUE,
    nome           text NOT NULL,
    email          text,
    perfil         text NOT NULL DEFAULT 'cidadao',
    organizacao    text,
    ativo          boolean DEFAULT true,
    criado_em      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario      text,
    acao         text NOT NULL,
    entidade     text,
    entidade_id  text,
    detalhe      text,
    dados        jsonb DEFAULT '{}'::jsonb,
    criado_em    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado ON auditoria (criado_em DESC);

-- ----------------------------------------------------------- views uteis
CREATE OR REPLACE VIEW vw_obra_com_municipio AS
SELECT o.*, m.nome AS municipio_nome, m.populacao AS municipio_populacao
FROM obra o LEFT JOIN municipio m ON m.codigo_ibge = o.municipio_codigo;

CREATE OR REPLACE VIEW vw_situacao_contrato AS
SELECT c.*,
       (c.vigencia_fim < CURRENT_DATE) AS vencido,
       (c.vigencia_fim - CURRENT_DATE) AS dias_para_vencer
FROM contrato c;
