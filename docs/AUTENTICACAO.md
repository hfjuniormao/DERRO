# Autenticação e autorização — CENTRAL INFRA RO 360

## 1. Princípio

O frontend **nunca** é o mecanismo de segurança. Ele controla apenas a
*experiência* (quais ações aparecem). A autorização real acontece no backend,
que valida o token, o perfil do usuário e registra a trilha de auditoria.

## 2. Fluxo em produção

```
Navegador                     ArcGIS Enterprise            Backend FastAPI
   │ 1. Clique em "Entrar"
   ├─────────────────────────────────────────────────────►│
   │                                    2. PKCE: verifier + challenge
   │ 3. Redireciona para /oauth2/authorize ─────────────►│
   │◄──────────── 4. code + state ────────────────────────┤
   │ 5. POST /api/auth/arcgis/token {code, code_verifier}
   ├─────────────────────────────────────────────────────►│
   │                                    6. troca do code por token (client_secret no servidor)
   │◄──────────── 7. token de sessão + perfil ────────────┤
   │ 8. Toda chamada envia Authorization: Bearer <token>
   ├─────────────────────────────────────────────────────►│
   │                                    9. valida expiração + perfil + auditoria
```

- **Authorization Code + PKCE** (RFC 7636) — o `code_verifier` é criado no
  navegador e nunca sai dele além da troca.
- O **client_secret** fica exclusivamente em `ARCGIS_CLIENT_SECRET` no servidor.
- A sessão do frontend expira em `SESSAO_TTL` (padrão: 8 h).

## 3. Perfis e permissões

| Perfil | Descrição | Permissões |
|---|---|---|
| Cidadão | Consulta pública | `consulta`, `exportar_publico` |
| Gestor executivo | Indicadores consolidados | + `indicadores`, `comparar` |
| Analista GIS | Camadas e consultas espaciais | + `camadas`, `consulta_espacial`, `exportar_interno` |
| Fiscal de campo | Vistorias em campo | + `vistoriar`, `registrar_evidencia` |
| Gestor de contratos | Contratos e pagamentos | + `gestionar_contratos` |
| Administrador | Usuários e auditoria | todas |

A tabela está em `src/auth.js` (`PERMISSOES`) e é espelhada no backend
(`backend/app/main.py`, `exigir_perfil`).

## 4. Trilha de auditoria

Toda escrita no backend gera um registro em `auditoria`:

`usuario`, `perfil`, `acao`, `entidade`, `entidade_id`, `detalhe`, `dados`
(jsonb), `criado_em`.

Exemplos de ações registradas: `criar_vistoria`, `alterar_obra`,
`aprovar_acesso`, `exportar_dados`.

## 5. Modo demonstração

Sem `VITE_ARCGIS_PORTAL_ID`/`VITE_ARCGIS_CLIENT_ID`, a área restrita oferece
escolha de perfil para navegar a interface com as restrições de cada perfil.
Isso é **demonstração de interface** — não concede acesso a dados reais, que
nunca são publicados no frontend sem backend.

## 6. LGPD

- Nenhum dado pessoal é publicado: as bases demonstrativas usam empresas
  fictícias e não há nomes de cidadãos.
- Vistorias de campo ficam em `localStorage` até a sincronização autorizada.
- O backend é responsável por anonimizar/limpar dados pessoais conforme a
  política institucional.
- Recommend-se registro de operação (log de acesso) no portal corporativo.

## 7. Checklist de segurança antes da produção

- [ ] `client_secret` apenas em variável de ambiente do servidor
- [ ] HTTPS obrigatório em todas as origens
- [ ] CSP restritiva configurada no provedor
- [ ] CORS limitado aos domínios oficiais
- [ ] Perfis revisados pelo gestor do contrato
- [ ] Trilha de auditoria monitorada
- [ ] Política de retenção de vistorias definida
