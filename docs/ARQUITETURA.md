# Arquitetura tecnológica — CENTRAL INFRA RO 360

## 1. Visão geral em camadas

```
┌───────────────────────────────────────────────────────────────────────┐
│ APRESENTAÇÃO                                                        │
│  index.html (shell semântico) · src/styles (tokens, base, comp.)    │
│  src/modules/* (17 aplicativos) · src/components/* (reutilizáveis)   │
└───────────────▲───────────────────────────────────────────────────────┘
                │ eventos / estado
┌───────────────┴───────────────────────────────────────────────────────┐
│ SERVIÇOS (frontend)                                                 │
│  src/services/state.js  — store reativo (filtros, seleção)          │
│  src/services/data.js   — carga, recorte e agregação dos registros  │
│  src/utils/*            — formatação, DOM, exportação               │
│  src/router.js          — rotas por hash com carga sob demanda       │
│  src/auth.js            — OAuth 2.0 PKCE + perfis (interface)        │
└───────────────▲───────────────────────────────────────────────────────┘
                │ fetch (GeoJSON/JSON), ArcGIS REST
┌───────────────┴───────────────────────────────────────────────────────┐
│ FONTES                                                             │
│  data/*.geojson · data/*.json (versionados)                         │
│  FeatureServer SNV · Áreas de proteção · Malha viária RO-xxx       │
│  IBGE Localidades + SIDRA · Esri Geocoder                            │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ BACKEND DE PRODUÇÃO (opcional)                                       │
│  FastAPI (backend/app)  → PostgreSQL/PostGIS (SIRGAS 2000 / UTM)   │
│  OAuth 2.0 (troca de token) · perfis · permissões · trilha auditoria│
└───────────────────────────────────────────────────────────────────────┘
```

## 2. Decisões técnicas

| Tema | Decisão | Motivo |
|---|---|---|
| Framework | **Sem framework** (ES Modules puros) | Requisito do projeto; reduz bundle e mantém controle do DOM para acessibilidade |
| SDK cartográfico | **@arcgis/core 4.30.9** (versão fixada no `package.json`) | Versão estável e documentada; ESM nativo, dispensando o loader AMD |
| Mapas base | `WebTileLayer` + `Basemap` sobre `services.arcgisonline.com` | Mapas base oficiais da Esri, com 8 opções na galeria |
| Webcamadas | `GeoJSONLayer` (via `url`) | `queryFeatures`, `definitionExpression` e `highlight` funcionam no cliente |
| Widgets do SDK | **Não usados** (painéis próprios) | Evita conflito de CSS com o padrão institucional e permite acessibilidade WCAG sob controle do projeto |
| Pop-up | Painel próprio (`view.on("click")` + `hitTest`) | Consistência visual e controle total do conteúdo da ficha |
| Gráficos | Chart.js 4.6 | Leve, responsivo e acessível |
| Estado | Store próprio (~90 linhas) | Sem dependência externa; notificação por chave |
| Dados | GeoJSON/JSON versionados em `data/` | Publicação estática funciona em Vercel/GitHub Pages sem backend |
| Backend | FastAPI + PostGIS (opcional) | Necessário para segurança real, permissões e auditoria |
| Sistema de referência | SIRGAS 2000 / UTM 21S (EPSG:31982) e 20S (EPSG:31981) no banco; WGS84 na apresentação | Padrão oficial brasileiro para dados geoespaciais públicos |

## 3. Fluxo de uma interação típica

1. O usuário muda um filtro → `definirFiltros()` altera `store.estado.filtros`.
2. O store notifica os inscritos → o módulo recalcula o recorte (`recortar()`).
3. `calcularIndicadores()` deriva os KPIs **a partir dos registros** do recorte.
4. Os gráficos são redesenhados (`destruirGraficos()` + `grafico*()`).
5. A tabela é reconstruída (`criarTabela().atualizar()`).
6. O mapa aplica a visibilidade das camadas correspondentes.

Nenhum número da interface é digitado à mão: tudo é derivado.

## 4. Camadas cartográficas

| ID | Camada | Origem | Grupo (APP 15) |
|---|---|---|---|
| `municipios` | Limites dos 52 municípios | REAL | Limites administrativos |
| `rodovias` | Trechos SNV (BR-xxx, km, jurisdição) | REAL | Infraestrutura rodoviária |
| `vias-estaduais` | Malha RO-xxx | REAL | Infraestrutura rodoviária |
| `obras` | Obras públicas por categoria | SIMULADO | Obras |
| `ativos` | Pontes, bueiros, sinalização | SIMULADO | Pontes e ativos |
| `convenios` | Convênios e transferências | SIMULADO | Convênios |
| `maquinas` | Frota de manutenção | SIMULADO | Máquinas |
| `ambiente` | Áreas de proteção | REAL | Meio ambiente |

Cada camada carrega `status` (REAL/SIMULADO) exibido no painel de camadas.

### Restrições do ArcGIS Maps SDK 4.30 encontradas em produção

Estas três regras não estão na documentação resumida do SDK e quebram o mapa
silenciosamente — estão registradas aqui para não serem redescobertas:

1. **`GeoJSONLayer` exige geometria por `url`.** A propriedade `geojson`
   (GeoJSON embutido) não é suportada: `load()` sempre lê da `GeoJSONSource`,
   que é operada por *worker* e busca a URL. Bases tabulares (convênios,
   máquinas) por isso têm um parceiro cartográfico em GeoJSON
   (`data/convenios-demo.geojson`, `data/maquinas-demo.geojson`).
2. **Os campos precisam ser declarados.** Sem `fields`, o SDK infere os tipos
   a partir das features e descarta o que não consegue tipar (arrays, objetos,
   colunas com tipos mistos), emitindo um aviso por camada. O projeto deriva
   os tipos (`derivarCampos()` em `src/maps/mapview.js`) e os declara.
   Booleanos são ignorados: o SDK não tem tipo de campo booleano.
3. **`WebTileLayer` usa `urlTemplate`, não `url`.** E `map.basemap` só aceita
   uma instância de `Basemap` — atribuir um `Map` gera `ensureTypes` no
   console. Os endereços dos mapas base foram conferidos contra o catálogo
   público `https://services.arcgisonline.com/ArcGIS/rest/services` (atenção:
   o serviço de ruas é `World_Street_Map`, com sublinhado).

## 5. Identidade visual

- Tokens em `src/styles/tokens.css`: verde institucional `#0B6E4F`, azul escuro
  `#0B2545`, amarelo de alerta `#C9A227`, vermelho crítico `#B23A48`, neutros.
- Tipografia: `Inter` com fallback de sistema (sem dependência de CDN).
- Espaçamento em escala de 4 px; raios, sombras e pontos de foco consistentes.
- Alvos de toque ≥ 40 px; contraste AA verificado nos textos de interface.

### Calcite

O projeto adota os **tokens do Calcite Design System** como referência de
hierarquia e nomenclatura, e implementa os componentes com CSS próprio para
manter o padrão visual institucional (verde/azul da SUDER/Governo) e evitar o
conflito de estilos shadow DOM do Calcite com o layout de tela cheia do mapa.
Os componentes interativos mantêm os padrões de acessibilidade do Calcite:
foco visível, `aria-*` nos componentes e navegação por teclado.
Habilitar os componentes completos do Calcite é uma troca de uma linha em
`src/components/ui.js` (registro via `@esri/calcite-components`).

## 6. Desempenho

- Rotas com carregamento sob demanda (`import()` dinâmico por módulo).
- Datasets espaciais grandes carregados sob demanda (`rodovias.geojson`,
  `ambiente.geojson`).
- Service worker com *stale-while-revalidate* em `/data` (uso offline do mapa).
- Simplificação geométrica no pipeline (Douglas-Peucker ~150 m).
- Charts recriados e destruídos a cada atualização (sem vazamento de memória).

## 7. Segurança

- Frontend sem segredos; `client_secret` apenas no backend.
- Autorização real no backend (perfis + auditoria).
- LGPD: nenhuma base contém dados pessoais; bases simuladas usam empresas
  fictícias; vistorias ficam em armazenamento local até sincronização.
- CSP sugerida para produção (ver `docs/MANUAL_PUBLICACAO.md`).

## 8. Testabilidade

- **Vitest** (unitários): formatação, store e serviço de dados com `fetch`
  simulado — os testes cobrem filtros, agregações e cálculo de indicadores.
- **Playwright** (smoke): navegação por todas as rotas, renderização do mapa,
  efeito dos filtros sobre a tabela e abertura de ficha.
