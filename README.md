# CENTRAL INFRA RO 360

Plataforma de Inteligência Geográfica de Infraestrutura e Logística do Estado de
Rondônia — aplicação web navegável, com mapa Esri, 17 aplicativos de gestão,
catálogo de fontes e PWA instalável.

> **Estado dos dados:** os limites municipais, a malha rodoviaria SNV, a
> população e o PIB são **dados oficiais** (IBGE/DNIT/Esri). Obras, contratos,
> ativos, convênios, máquinas, vistorias e séries históricas são **bases
> demonstrativas (DADOS SIMULADOS)**, identificadas em todas as telas.

---

## 1. Como executar

### Requisitos

- Node.js 20.19+ (testado em Node 22)
- Python 3.10+ apenas para o pipeline de dados e o backend opcional

### Desenvolvimento

```bash
npm install
npm run dev            # http://127.0.0.1:5173
```

### Build de produção

```bash
npm run build          # gera dist/
npm run serve:dist     # serve dist/ em http://127.0.0.1:4173
```

### Dados

```bash
npm run data:real      # baixa fontes oficiais (IBGE, DNIT/SNV, Esri) → data/
npm run data:demo      # gera as bases demonstrativas → data/
npm run data:fontes    # gera o catálogo de fontes → data/fontes.json
npm run data:all       # executa os três
```

Os dados baixados já estão versionados em `data/`, então a aplicação funciona
sem executar o pipeline.

---

## 2. Aplicativos

| ID | Aplicativo | App | Origem dos dados |
|---|---|---|---|
| — | Página inicial institucional | 00 | REAL + SIMULADO |
| `painel` | Painel executivo de infraestrutura | 01 | REAL + SIMULADO |
| `rodovias` | Sistema rodoviário estadual | 02 | **REAL** (SNV) + SIMULADO |
| `obras` | Gestão de obras públicas 360 | 03 | SIMULADO |
| `contratos` | Gestão de contratos | 04 | SIMULADO |
| `ativos` | Gestão de pontes e ativos | 05 | SIMULADO |
| `logistica` | Logística multimodal | 06 | REAL + SIMULADO |
| `municipios` | Perfil dos 52 municípios | 07 | **REAL** (IBGE) + SIMULADO |
| `convenios` | Convênios e transferências | 08 | SIMULADO |
| `maquinas` | Máquinas e equipamentos | 09 | SIMULADO |
| `fiscalizacao` | Fiscalização de obras | 10 | SIMULADO (com persistência local) |
| `meioambiente` | Meio ambiente e licenciamento | 11 | **REAL** (áreas de proteção) |
| `planejamento` | Planejamento estratégico | 12 | SIMULADO |
| `geoai` | GeoAI e inteligência preditiva | 13 | SIMULADO (regras heurísticas) |
| `assistente` | Assistente geoespacial InfraAI RO | 14 | REAL + SIMULADO |
| `mapa` | Geoportal integrado | 15 | REAL + SIMULADO |
| `dados-abertos` | Dados abertos | 16 | REAL + SIMULADO |
| `admin` | Administração, perfis e auditoria | 17 | local (backend em produção) |

---

## 3. Stack

- **HTML5 semântico + CSS3 responsivo + JavaScript ES Modules** (sem framework)
- **ArcGIS Maps SDK for JavaScript 4.30.9** (ESM via `@arcgis/core`, versão fixada)
- **Mapas base oficiais da Esri** (streets, satélite, híbrido, topográfico,
  cinza, escuro, terreno) + alternância **2D/3D**
- **ArcGIS REST API** (geocodificador, FeatureServer do SNV, services do ArcGIS Online)
- **Chart.js 4.6** para gráficos
- **Calcite Design System** — tokens de design alinhados ao Calcite no
  `src/styles/tokens.css`; componentes próprios para manter o padrão visual
  institucional (ver `docs/ARQUITETURA.md`, seção "Calcite")
- **Vite 7** para desenvolvimento e build
- **PWA** instalável em Android (manifest + service worker)
- **Opcional:** Python/FastAPI + PostgreSQL/PostGIS (`backend/`)

---

## 4. Estrutura do projeto

```
central-infra-ro/
├── index.html               # shell semântico (header, nav, main, footer)
├── package.json / vite.config.js
├── .env.example             # variáveis de ambiente (sem segredos)
├── vercel.json              # configuração de publicação na Vercel
├── public/
│   ├── manifest.webmanifest  # manifesto PWA
│   ├── sw.js                 # service worker (app shell + cache de /data)
│   └── assets/               # ícones e marcadores de logotipos
├── assets/                   # arquivos autorizados de logotipo (ver README)
├── src/
│   ├── main.js               # bootstrap, navegação, busca global, rotas
│   ├── config.js             # configuração central (env, basemaps, perfis)
│   ├── router.js             # roteador por hash com carregamento sob demanda
│   ├── auth.js               # OAuth 2.0 PKCE + perfis + permissões
│   ├── styles/               # tokens, base, componentes, mapa
│   ├── components/           # UI reutilizável (mapas, tabelas, gráficos, filtros…)
│   ├── maps/                 # controlador ArcGIS e catálogo de camadas
│   ├── dashboards/           # gráficos do painel executivo
│   ├── modules/              # os 17 aplicativos (um arquivo por app)
│   ├── services/             # dados, estado, catálogo de fontes
│   └── utils/                # formatação, DOM, exportação
├── data/                     # datasets (reais e simulados)
├── backend/                  # FastAPI + PostGIS (opcional)
├── scripts/                  # pipeline de dados
├── tests/                    # unitários (Vitest) + smoke test (Playwright)
└── docs/                     # arquitetura, modelo de dados, publicação, limitações
```

---

## 5. Fontes de dados

| Dataset | Status | Origem |
|---|---|---|
| Limites dos 52 municípios | **REAL** | geoBoundaries BRA ADM2 (derivado das malhas do IBGE 2020) |
| População (Censo 2022) e PIB municipal | **REAL** | IBGE SIDRA — tabelas 6579 e 5938 |
| Malha rodoviaria com km e jurisdição | **REAL** | FeatureServer público do SNV (DNIT), versão 202604A |
| Malha viária estadual RO-xxx | **REAL** | FeatureServer público "Rondonia Roads" |
| Áreas de proteção e uso restrito | **REAL** | FeatureServer público "Rondonia Protected Forests" |
| Obras, contratos, ativos, convênios, máquinas, vistorias, série histórica | **SIMULADO** | gerados por `scripts/gerar_dados_simulados.py` (semente fixa) |

O catálogo completo, com metodologia, licença, precisão e qualidade, fica em
`data/fontes.json` e na rota **#/fontes** da aplicação.

---

## 6. Configuração

Copie `.env.example` para `.env.local` (ou configure as variáveis no ambiente
de publicação). Sem nenhuma variável, a aplicação funciona em modo
demonstração com mapas base públicos da Esri.

```bash
VITE_ARCGIS_API_KEY=      # opcional — chave da API ArcGIS
VITE_ARCGIS_PORTAL_ID=    # portal ArcGIS Enterprise (produção)
VITE_ARCGIS_CLIENT_ID=    # client id do aplicativo (público)
VITE_API_BASE_URL=        # backend FastAPI de produção
VITE_MODO_DADOS=demonstracao
VITE_PWA_ATIVO=true
```

Detalhes em `docs/MANUAL_CONFIGURACAO.md`.

---

## 7. Publicação

- **Vercel** (estático, com `vercel.json` pronto) — `docs/MANUAL_PUBLICACAO.md`
- **GitHub Pages** — build com `base: "./"` já configurado
- **Backend** — `backend/` com docker-compose para PostGIS

Instruções passo a passo em `docs/MANUAL_PUBLICACAO.md`.

---

## 8. Testes

```bash
npm test                  # 24 testes unitários (Vitest)
npm run lint              # lint estrutural + verificação de imports nomeados
npm run build             # build de produção
npm run test:smoke        # smoke test Playwright (serve dist/ e navega por todas as rotas)
npm run package:zip       # gera o ZIP de entrega (sem node_modules, .git e segredos)
```

O smoke test verifica: home, navegação por todas as rotas, renderização do
mapa ArcGIS, efeito real dos filtros sobre a tabela, abertura da ficha de obra
e ausência de erros de console relevantes. Capturas em `tests/capturas/`.

Extras de diagnóstico:

```bash
python3 tests/depurar_rota.py obras painel   # abre rotas e mostra erros de console
# tests/prova-camada.html  — pagina de prova do carregamento de camadas (SDK 4.30)
```

---

## 9. Segurança e privacidade

- Nenhum segredo no frontend nem no repositório: `client_secret` do ArcGIS vive
  apenas no backend.
- A troca do código OAuth acontece no backend (`/api/auth/arcgis/token`).
- As permissões de interface são **apenas apresentação** — a autorização real
  é do backend, com trilha de auditoria.
- Bases demonstrativas usam empresas e obras **fictícias**, sem nomes de
  empresas reais, e nenhum dado pessoal.
- Nenhuma informação de fiscalização ou infraestrutura restrita é publicada.

Ver `docs/AUTENTICACAO.md`.

---

## 10. Limitações conhecidas

- Obras, contratos, ativos, convênios, máquinas e vistorias são **simulados**.
- A comparação temporal de imagens exige um *imagery server* histórico
  (ArcGIS Enterprise); a versão atual filtra registros por período.
- Roteamento e análise de acessibilidade exigem serviço Network Analyst
  licenciado — a estimativa atual usa distância de malha.
- O frontend não é mecanismo de segurança: sem backend, o controle de acesso é
  apenas demonstrativo.
- A malha municipal é generalizada (erro de fronteira ~1 km).
- Áudio/vídeo e telemetria GPS em tempo real não são implementados.

Ver `docs/LIMITACOES.md` para a lista completa.

---

## 11. Créditos e licenças

- **Esri** — ArcGIS Maps SDK for JavaScript, mapas base, geocodificação
- **IBGE** — localidades, SIDRA (população e PIB) e malha municipal (2020)
- **DNIT / SNV** — cadastro de trechos rodoviários
- **geoBoundaries** — malha municipal ADM2 do Brasil (CC BY 3.0 IGO)
- **Chart.js** — gráficos (MIT)

Os logotipos do Governo de Rondônia e do DER-RO **não** foram reproduzidos:
os arquivos em `public/assets/` são marcadores de posição. Substitua-os pelos
arquivos autorizados antes da publicação institucional (`public/assets/README.md`).
