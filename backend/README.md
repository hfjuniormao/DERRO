# Backend de produção (opcional)

FastAPI + PostgreSQL/PostGIS. A aplicação frontend funciona **sem** este
serviço (modo demonstração). Com ele, o backend passa a ser o ponto real de
controle de acesso, permissões e auditoria.

## Subir o ambiente

```bash
docker compose -f backend/docker-compose.postgis.yml up -d
# em outro terminal
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | conexão PostgreSQL/PostGIS |
| `ARCGIS_PORTAL_ID` | id do portal ArcGIS Enterprise (ex.: `states`) |
| `ARCGIS_CLIENT_ID` | client id do aplicativo ArcGIS (público) |
| `ARCGIS_CLIENT_SECRET` | segredo do aplicativo — **apenas no servidor** |
| `CORS_ORIGINS` | origens autorizadas, separadas por vírgula |
| `SESSAO_TTL` | validade da sessão de frontend em segundos (padrão 28800) |
| `SRID_PRINCIPAL` | 31982 (SIRGAS 2000 / UTM 21S) |
| `SRID_SECUNDARIO` | 31981 (SIRGAS 2000 / UTM 20S) |

## Endpoints

| Método | Rota | Perfil mínimo | Descrição |
|---|---|---|---|
| GET | `/api/health` | público | estado da API e do PostGIS |
| POST | `/api/auth/arcgis/token` | público | troca OAuth 2.0 (PKCE) por token de sessão |
| GET | `/api/obras` | cidadão | lista filtrada de obras |
| GET | `/api/obras/{id}` | cidadão | detalhe da obra |
| GET | `/api/contratos` | cidadão | lista filtrada de contratos |
| POST | `/api/vistorias` | fiscal, admin | registra vistoria + auditoria |
| GET | `/api/auditoria` | admin | trilha de auditoria |
| GET | `/api/usuarios` | admin | usuários e perfis |
| GET | `/api/conversao` | cidadão | conversão WGS84 → SIRGAS 2000 / UTM |

## Segurança

- O `client_secret` do ArcGIS nunca vai para o frontend.
- O frontend apenas troca o código de autorização por um token de sessão.
- Toda escrita gera registro em `auditoria` (usuário, perfil, ação, entidade, data).
- O controle de acesso real é sempre do backend; o frontend apenas esconde ações.

## Modelo de dados

Veja `backend/sql/schema.sql` e `docs/MODELO_DE_DADOS.md`.
