# Manual de publicação — CENTRAL INFRA RO 360

O projeto é 100% estático no frontend: `npm run build` gera `dist/`, que pode
ser publicado em **Vercel**, **GitHub Pages** ou qualquer servidor de arquivos.

## 1. GitHub

### Repositório já existente (privado)

```bash
git remote add origin <URL-DE-CLONE-INFO>
git branch -M main
git push -u origin main
```

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
