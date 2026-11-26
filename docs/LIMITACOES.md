# Limitações existentes — CENTRAL INFRA RO 360

Registro honesto do que a plataforma **não** faz nesta versão, para evitar
uso indevido das informações exibidas.

## 1. Dados

| Limitação | Impacto | Mitigação |
|---|---|---|
| Obras, contratos, ativos, convênios, máquinas, vistorias e série histórica são **SIMULADOS** | Não representam a realidade do Estado | Etiqueta "DADOS SIMULADOS" em todas as telas; catálogo de fontes; pipeline documentado |
| Empresas dos contratos são fictícias | Nenhum nome real é associado a contrato fictício | Nomenclatura "(fictícia)" em todas as fichas |
| Malha municipal é generalizada (IBGE 2020) | Erro de fronteira ~1 km; não usar paraematics de parcels | Áreas calculadas por excesso esférico com desvio de +0,5% frente ao oficial |
| Malha viária estadual (RO-xxx) vem de base colaborativa | Traçado aproximado; não substitui cadastro oficial de km | Marcada como REAL mas com aviso de precisão média no catálogo |
| População (Censo 2022) e PIB (ano de referência da SIDRA) | Defasagem natural do dado oficial | Ano de referência exibido em cada ficha |
| Hidrografia, zoneamento e terras indígenas não estão catalogados como fonte validada | APP 11 mostra essas camadas como INDISPONÍVEL | Catálogo de fontes explicita a ausência e o caminho de integração |

## 2. Cartografia e análise

- **Comparação temporal de imagens** não está disponível: exige um *imagery
  server* histórico. A versão atual filtra registros por período e o texto da
  interface deixa isso explícito.
- **Roteamento e análise de acessibilidade** não usam o Network Analyst: a
  estimativa usa distância de malha e é rotulada como estimativa.
- **Consulta espacial** (APP 15) roda sobre as camadas carregadas no navegador;
  não substitui uma análise espacial server-side (necessária para grandes
  volumes).
- **3D** usa SceneView com qualidade `medium`; o relevo usa o serviço de
  terreno da Esri, sem ajustes finos de iluminação.
- A exportação de feições seleciona a **camada visível por último** — a
  interface não implementa exportação multi-camada.

## 3. GeoAI (APP 13)

- As análises são **regras heurísticas** calculadas sobre os registros, com a
  fórmula exposta na tela. **Não são modelos treinados** e não devem ser
  lidas como previsão de inteligência artificial.
- Não há modelo validado, métricas de acerto ou intervalo de confiança.
- A integração com ArcGIS Pro / Image Server / Python está preparada
  (`docs/INTEGRACAO_ARCGIS_ENTERPRISE.md`) mas não executada.

## 4. Assistente (APP 14)

- O InfraAI RO é **conversacional por regras**, executado localmente no
  navegador: reconhece intenção, município, categoria, situação, rodovia e
  período.
- Não há modelo de linguagem nem chamada a serviço externo: perguntas fora do
  escopo recebem a resposta explícita de que não há dados suficientes.
- As respostas listam apenas registros existentes nas bases carregadas.

## 5. Fiscalização (APP 10)

- As vistorias são gravadas em `localStorage` (armazenamento offline
  temporário) e ainda **não** são sincronizadas com o backend pela interface —
  o endpoint `/api/vistorias` existe e está pronto para uso.
- As fotos são pré-visualizadas localmente; não há upload real.
- A movimentação das máquinas (APP 09) é **simulada** e identificada como tal.
- Integração com Survey123/Field Maps está documentada, não implementada.

## 6. Autenticação e segurança

- Sem `VITE_API_BASE_URL`, o controle de acesso é **apenas de interface**: o
  seletor de perfil no modo demonstração não protege dado algum (e não há
  dado real exposto).
- A troca de token OAuth exige o `client_secret` no backend; sem backend
  configurado, o login com ArcGIS não conclui.
- A trilha de auditoria do APP 17 é local (`localStorage`); a trilha real
  exige o backend.
- Não há CSP rígida no ambiente de demonstração (ver manual de publicação).

## 7. Plataforma e desempenho

- Navegadores sem suporte a WebGL 2 não renderizam o mapa 3D.
- Dispositivos muito antigos podem ter desempenho limitado na visualização
  com todas as camadas ativas.
- O volume de dados é dimensionado para demonstração (centenas de registros);
  a arquitetura de carregamento sob demanda foi preservada, mas o
  dimensionamento para milhões de feições exige serviços paginados e
  virtualização de tabela.
- A tabela exibe paginação de 20/25 registros; não há virtualização de linhas.

## 8. Acessibilidade

- Atinge-se WCAG 2.2 AA nos componentes próprios (foco, contraste, rótulos,
  navegação por teclado).
- O widget de mapa da Esri é de terceiros: a navegação por teclado dentro do
  canvas depende do comportamento do SDK (a alternativa textual é a ficha de
  identificação de feição, que lista os atributos).
- Sem teste auditivo formal com usuários — a conformidade foi verificada por
  inspection de código.

## 9. Situação de publishes

- A aplicação foi validada em Chromium headless (Playwright) no ambiente de
  desenvolvimento. Não houve validação em navegador real (iOS/Safari), em
  tecnologia assistiva ou em rede móvel limitada.
- Nenhum teste de carga foi executado.

## 10. Situação da publicação em nuvem

- **GitHub** — o código está no repositório de demonstração **público**
  `hfjuniormao/DERRO` (branch `main`) e no espelho privado
  `hfjuniormao/central-infra-ro`. Sendo público, ficam visíveis o código-fonte,
  a estrutura de pastas, a documentação e as bases com origem declarada; nenhum
  token, chave ou credencial é versionado. Os dois arquivos
  de `.github/workflows/` estão em um commit **pendente de push** porque o
  token usado tem escopo `repo` e não `workflow` (o GitHub recusa pushes e a
  API de conteúdo para caminhos `.github/workflows/`). Para concluir, use um
  PAT com `repo` **e** `workflow`, ou cadastre os arquivos pela interface do
  GitHub.
- **Vercel** — a publicação em produção foi feita pela API REST
  (`scripts/publicar_vercel_api.py`), enviando o `dist/` já compilado como
  arquivos estáticos, **sem build no servidor**. A consequência prática é que
  as regras de cabeçalho do `vercel.json` (cache `immutable` em `/assets/*`,
  `no-cache` em `/sw.js`) não são aplicadas pela CDN: os arquivos são servidos
  com a política padrão da Vercel (`max-age=0, must-revalidate`). O service
  worker da aplicação continua fazendo cache no cliente (cache-first do app
  shell, stale-while-revalidate de `/data`). Assim que o projeto for
  conectado ao repositório GitHub, o build da Vercel aplica o `vercel.json`
  integralmente.
- **Associação GitHub → Vercel** — o GitHub App da Vercel instalado na conta
  não tem acesso ao repositório `central-infra-ro` (`repo_not_found` ao tentar
  vincular). O mesmo vale para `DERRO` até a autorização ser refeita no
  painel da Vercel. Enquanto isso, cada nova versão exige republicar pela
  API.
- **Nome do projeto na Vercel** — a publicação usa o projeto `mapa-obras-ro`,
  o único disponível na equipe do token. A URL pública é
  `https://mapa-obras-ro.vercel.app`; o nome do repositório no GitHub é
  `DERRO`.
