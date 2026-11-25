# Manual de configuração — CENTRAL INFRA RO 360

## 1. Variáveis de ambiente (frontend)

Todas são prefixadas com `VITE_` e lidas em `src/config.js`. **Nenhum segredo
deve ser colocado aqui** — variáveis `VITE_*` são embutidas no JavaScript
publicado.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_ARCGIS_API_KEY` | não | Chave da API ArcGIS. Sem ela, a aplicação usa os mapas base públicos e o SDK exibe aviso de credencial de desenvolvimento. |
| `VITE_ARCGIS_PORTAL_ID` | produção | Id do portal ArcGIS Enterprise (ex.: `states` para `states.arcgis.com`). |
| `VITE_ARCGIS_CLIENT_ID` | produção | Client id do aplicativo ArcGIS registrado. É público. |
| `VITE_API_BASE_URL` | produção | URL do backend FastAPI (ex.: `https://api.exemplo.ro`). Vazio = modo demonstração. |
| `VITE_MODO_DADOS` | não | `demonstracao` (padrão) ou `producao`. |
| `VITE_PWA_ATIVO` | não | `true` (padrão) registra o service worker; `false` desativa. |

### Criando a chave da API ArcGIS

1. Acesse <https://developers.arcgis.com> e entre na conta institucional.
2. **My Apps → Create New App → Application** → tipo *Web* → *ArcGIS Maps SDK for JavaScript*.
3. informe o domínio de publicação (ex.: `https://central-infra-ro.vercel.app`) e
   `http://localhost:5173` para desenvolvimento.
4. Copie a **API Key** e configure `VITE_ARCGIS_API_KEY`.
5. Restrinja a chave por hostname e por serviço (Services) — nunca a deixe irrestrita.

## 2. Backend (produção)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | `postgresql://user:senha@host:5432/base` |
| `ARCGIS_PORTAL_ID` | Portal ArcGIS Enterprise |
| `ARCGIS_CLIENT_ID` | Client id (público) |
| `ARCGIS_CLIENT_SECRET` | **Segredo do aplicativo — apenas no servidor** |
| `CORS_ORIGINS` | Origens autorizadas separadas por vírgula |
| `SESSAO_TTL` | Validade da sessão de frontend (segundos) |
| `SRID_PRINCIPAL` | 31982 (SIRGAS 2000 / UTM 21S) |
| `SRID_SECUNDARIO` | 31981 (SIRGAS 2000 / UTM 20S) |

Subida local:

```bash
docker compose -f backend/docker-compose.postgis.yml up -d
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

## 3. Dados

```bash
npm run data:real     # baixa e valida as fontes oficiais
npm run data:demo     # regenera as bases demonstrativas (semente fixa)
npm run data:fontes   # regenera o catálogo de fontes
```

O pipeline real:

1. baixa a malha municipal (geoBoundaries/IBGE 2020) e casa os 52 municípios
   pelos códigos oficiais do IBGE;
2. consulta a API de Localidades e a SIDRA (população do Censo 2022 e PIB);
3. consulta o FeatureServer público do SNV e filtra os trechos que intersectam
   a malha municipal de Rondônia;
4. consulta o FeatureServer público da malha viária RO-xxx e das áreas de proteção;
5. simplifica as geometrias (Douglas-Peucker ~150 m) e grava em `data/`.

Validações executadas: 52/52 municípios casados; área total da malha com
desvio de +0,5% frente aos 237.590,5 km² oficiais do estado; 132 trechos SNV
e 283 segmentos estaduais dentro do território.

## 4. Mapas base

Os mapas base são os oficiais da Esri, listados em `src/config.js`
(`BASEMAPS`): Ruas, Satélite, Híbrido, Topográfico, Cinza, Escuro, Terreno e
OpenStreetMap. Para institutionalizar um mapa próprio, substitua a URL
correspondente por um `MapServer` autorizado do Estado.

## 5. Acessibilidade

- Navegação por teclado em todos os componentes; foco visível (`:focus-visible`).
- Rótulos associados, `aria-label` em botões só com ícone, `aria-live` em
  resultados e avisos.
- Alvos de toque de 40 px no mobile.
- Contraste AA nos textos institucionais.
- O mapa possui legenda textual e alternativa textual nas fichas.

## 6. Checklist de configuração

- [ ] `npm install` executado
- [ ] `VITE_ARCGIS_API_KEY` configurada (produção)
- [ ] `VITE_ARCGIS_PORTAL_ID` e `VITE_ARCGIS_CLIENT_ID` configurados (produção)
- [ ] `VITE_API_BASE_URL` apontando para o backend (produção)
- [ ] `client_secret` somente no backend
- [ ] Domínio de produção registrado no aplicativo ArcGIS
- [ ] Logotipos oficiais substituídos em `public/assets/`
- [ ] `npm run build` sem erros e `npm test` verde
- [ ] `npm run test:smoke` verde contra a URL publicada
