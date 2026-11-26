# Manual de publicação — CENTRAL INFRA RO 360

O projeto é 100% estático no frontend: `npm run build` gera `dist/`, que pode
ser publicado em **Vercel**, **GitHub Pages** ou qualquer servidor de arquivos.

### Publicação atual

| Ambiente | Endereço | Como foi publicado |
| --- | --- | --- |
| GitHub — demonstração (público) | `https://github.com/hfjuniormao/DERRO` | `git push` com PAT de escopo `repo` |
| GitHub — espelho privado | `https://github.com/hfjuniormao/central-infra-ro` | `git push` com PAT de escopo `repo` |
| Vercel (produção) | `https://mapa-obras-ro.vercel.app` | `scripts/publicar_vercel_api.py` (API REST, `dist/` enviado pronto) |

Validação executada contra a URL publicada:
`python3 tests/smoke_test.py https://mapa-obras-ro.vercel.app` → `RESULTADO: OK`
(20/20 rotas, mapa com tiles, filtros, ficha de feição e layout mobile).

> **Repositório de demonstração público**: o código, os dados (com origem
> declarada: REAIS / SIMULADOS / INDISPONÍVEIS) e a documentação são públicos
> em `DERRO`. Nenhum segredo é versionado — chaves e tokens ficam em variáveis
> de ambiente e no backend. Se a estrutura do sistema deve permanecer restrita,
> use o espelho privado `central-infra-ro`.

> Ver `docs/LIMITACOES.md`, seção 10, para o que ainda depende de ação manual
> (push dos workflows de CI com PAT de escopo `workflow` e vínculo do GitHub
> App da Vercel com o repositório).

## 1. GitHub

### Repositório já existente (privado)

```bash
git remote add origin <URL-DE-CLONE-INFO>
git branch -M main
git push -u origin main
```

Ou, com o token do GitHub (o script usa a URL efemera e **não** grava o
token no remote nem no repositório):

```bash
bash scripts/publicar_github.sh <GITHUB_TOKEN> https://github.com/<ORG>/<REPO>.git
```

> O `GITHUB_TOKEN` é um *Personal Access Token* com escopo `repo`
> (`https://github.com/settings/tokens`). Nunca o grave no `.git/config`
> versionado nem em arquivo do repositório.

### Escopo `workflow`: publicando os arquivos de CI

O GitHub bloqueia, para tokens **sem** o escopo `workflow`, qualquer push que
crie ou atualize arquivos em `.github/workflows/`. A recusa é explícita:

```
refusing to allow a Personal Access Token to create or update workflow
`.github/workflows/pages.yml` without `workflow` scope
```

Duas saídas possíveis:

1. **Recomendado** — gerar um PAT com os escopos `repo` **e** `workflow**
   (`https://github.com/settings/tokens`) e executar `git push` normalmente:
   os workflows `pages.yml` e `verificacao.yml` passam a fazer parte do
   histórico published.
2. **Contornar** — publicar primeiro o restante do projeto e enviar os
   workflows depois, com um token que tenha o escopo `workflow`. Enquanto isso,
   os arquivos de CI continuam disponíveis no repositório local e no pacote
   de entrega (`central-infra-ro-360.zip`).

### Fluxo completo (GitHub + Vercel + validação)

```bash
bash scripts/publicar_tudo.sh <GITHUB_TOKEN> <VERCEL_TOKEN>
```

O script executa lint, testes, push, build, deploy em produção e o smoke test
contra a URL publicada — falhando se qualquer etapa não passar.

### Repositório novo

```bash
git init
git add .
git commit -m "CENTRAL INFRA RO 360 — versão inicial"
git branch -M main
git remote add origin <URL-DO-REPOSITORIO>
git push -u origin main
```

> O repositório deve ser **privado**: contém a estrutura do sistema do Estado.
> As bases em `data/` não contêm dados pessoais nem segredos.

### GitHub Pages (opcional)

1. `Settings → Pages → Source: GitHub Actions`.
2. Use o workflow em `.github/workflows/pages.yml` (incluso no projeto) ou
   publique manualmente o conteúdo de `dist/` no branch `gh-pages`.
3. O `vite.config.js` já usa `base: "./"`, então a aplicação funciona em
   subpastas (`/repositorio/`).

## 2. Vercel

### Via CLI

```bash
npm i -g vercel

# Login por token (recomendado em CI/CD e em maquinas sem navegador)
export VERCEL_TOKEN=<SEU-TOKEN>
vercel login --token "$VERCEL_TOKEN"

# Preview (staging)
vercel --token "$VERCEL_TOKEN"

# Producao
vercel --prod --token "$VERCEL_TOKEN"
```

Ou, usando o script incluido:

```bash
npm run build
bash scripts/publicar_vercel.sh <SEU-TOKEN>
```

O token é criado em **Vercel → Settings → Tokens** e deve ser guardado como
segredo: **nunca** vai para o repositório nem para o frontend.

O `vercel.json` já define:

- `buildCommand`: `NODE_OPTIONS=--max-old-space-size=4096 npm run build` (heap ampliado
  porque o ArcGIS Maps SDK 4.30 é grande e estoura o limite padrão do Node)
- `outputDirectory`: `dist`
- framework preset: `vite`
- cache de 1 ano para `/assets/*` (immutable), 1 hora para `/data/*`
- `Service-Worker-Allowed: /` e `Cache-Control: no-cache` para `/sw.js`
  (essencial para não servir uma versão antiga do service worker)

### Via dashboard

1. **Add New → Project** → importe o repositório GitHub.
2. Framework preset: **Other**; build `npm run build`; output `dist`.
3. Em **Settings → Environment Variables**, cadastre as variáveis `VITE_*`.
4. Deploy. Anote a URL (ex.: `https://central-infra-ro.vercel.app`).

### Via API REST (token com escopo de equipe)

Tokens emitidos para uma **equipe** (não para uma conta pessoal) fazem a CLI
abortar no preflight (`GET /v2/user` → `404 User not found`). A API REST
funciona normalmente — basta informar o `teamId` da equipe.

O script incluído faz o fluxo completo em duas etapas (o corpo de
`POST /v13/deployments` tem limite de 10 MB e o `dist/` tem ~23 MB):

```bash
npm run build
export VERCEL_TOKEN=<SEU-TOKEN>
export VERCEL_TEAM=team_XXXXXXXXXXXX
export VERCEL_PROJECT=mapa-obras-ro
python3 scripts/publicar_vercel_api.py
```

Etapas executadas pelo script:

1. `POST /v2/files` — upload de cada arquivo de `dist/` (corpo binário, digest
   **SHA-1** no header `x-now-digest`, tamanho em `x-now-size`);
2. `POST /v13/deployments` — deployment de produção referenciando os arquivos
   pelo SHA retornado, com `framework`, `buildCommand` e `outputDirectory` nulos
   (saída estática, **sem build no servidor**);
3. `GET /v13/deployments/<id>` — acompanhamento até `readyState: READY`.

Para inspecionar os projetos visíveis com o mesmo token:

```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects?teamId=$TEAM_ID"
```

> **Permissões**: o token precisa de permissão de *deploy* no projeto. Criar
> projetos (`POST /v10/projects`) exige permissão adicional — quando ela falta,
> a API responde `403 You don't have permission to create the project`.
> Nenhum token é gravado no repositório: use variável de ambiente.

### Após o deploy

```bash
python3 tests/smoke_test.py https://central-infra-ro.vercel.app
```

O smoke test valida todas as rotas, o renderizado do mapa, o efeito dos filtros
e a abertura de fichas na URL publicada.

## 3. Requisitos de cabeçalhos (produção institucional)

Recomenda-se configurar um CSP no provedor (Vercel: `vercel.json` → `headers`):

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' data: blob: https://services.arcgisonline.com https://*.arcgis.com;
  script-src 'self' 'unsafe-inline' https://js.arcgis.com https://*.arcgis.com;
  style-src 'self' 'unsafe-inline' https://js.arcgis.com;
  connect-src 'self' https://*.arcgis.com https://*.arcgisonline.com https://geocode.arcgis.com https://apisidra.ibge.gov.br https://servicodados.ibge.gov.br;
  worker-src 'self' blob: https://js.arcgis.com;
  font-src 'self' data: https://js.arcgis.com;
```

> `unsafe-inline` é necessário porque o ArcGIS Maps SDK injeta estilos do
> WebGL; restrinja os demais domínios à lista da Esri e das APIs do IBGE.

## 4. Backend de produção (opcional)

```bash
docker compose -f backend/docker-compose.postgis.yml up -d
```

Configure as variáveis do backend no servidor (Railway, Render, VM do Estado)
e aponte `VITE_API_BASE_URL` no frontend. O frontend troca o código OAuth por
um token de sessão no endpoint `/api/auth/arcgis/token`.

## 5. Atualização de dados

```bash
npm run data:all && npm run build
git commit -am "Atualização das bases" && git push
```

## 6. Checklist de publicação

- [ ] `npm test` verde
- [ ] `npm run build` sem erros
- [ ] `npm run test:smoke` verde contra a URL publicada
- [ ] Variáveis `VITE_*` configuradas no ambiente
- [ ] Logotipos autorizados substituídos
- [ ] `client_secret` **apenas** no backend
- [ ] Repositório privado
- [ ] HTTPS habilitado (Vercel emite certificado automático)
