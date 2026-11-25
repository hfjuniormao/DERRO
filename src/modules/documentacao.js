/**
 * Pagina institucional — documentacao tecnica da CENTRAL INFRA RO 360.
 *
 * Arquitetura, modelo de dados, configuracao, publicacao, autenticacao,
 * integracao com ArcGIS Enterprise, limitacoes conhecidas e creditos/licencas.
 */
import { el, limpar } from "../utils/dom.js";
import { config } from "../config.js";
import { blocoAviso } from "../components/ui.js";

/** Tabela estatica (sem ferramentas de interacao). */
function tabelaEstatica(cabecalhos, linhas) {
  const tabela = el("table", { className: "tabela tabela--compacta" });
  const thead = el("thead");
  thead.append(
    el(
      "tr",
      {},
      cabecalhos.map((cabecalho) => el("th", { scope: "col", text: cabecalho }))
    )
  );
  const tbody = el("tbody");
  linhas.forEach((linha) => {
    tbody.append(
      el(
        "tr",
        {},
        linha.map((celula, indice) =>
          indice === 0
            ? el("th", { scope: "row", text: String(celula) })
            : el("td", {}, [celula instanceof Node ? celula : String(celula)])
        )
      )
    );
  });
  tabela.append(thead, tbody);
  return tabela;
}

/** Bloco de codigo com estilo inline (sem CSS novo). */
function blocoCodigo(texto) {
  return el("pre", {
    style: {
      margin: "0",
      padding: "12px",
      background: "#0b2545",
      color: "#e8eef3",
      borderRadius: "8px",
      overflowX: "auto",
      fontSize: "12px",
      lineHeight: "1.5",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    text: texto,
  });
}

/** Secao padrao da documentacao. */
function secao(titulo, descricao, conteudos) {
  const painel = el("section", { className: "painel" }, [
    el("header", { className: "painel__cabecalho" }, [
      el("div", {}, [
        el("h3", { className: "painel__titulo", text: titulo }),
        descricao ? el("p", { className: "painel__descricao", text: descricao }) : null,
      ]),
    ]),
  ]);
  conteudos.forEach((conteudo) => painel.append(conteudo));
  return painel;
}

export async function montar(container, ctx) {
  const pagina = el("section", { className: "pagina" });

  pagina.append(
    el("header", { className: "pagina__cabecalho" }, [
      el("div", {}, [
        el("h1", { className: "pagina__titulo", text: "Documentação técnica" }),
        el("p", {
          className: "pagina__descricao",
          text:
            "Como a CENTRAL INFRA RO 360 é construída, configurada e publicada: arquitetura em camadas, modelo " +
            "de dados, variáveis de ambiente, publicação em GitHub Pages e Vercel, autenticação ArcGIS Enterprise, " +
            "integração com a plataforma ArcGIS, limitações conhecidas e créditos.",
        }),
      ]),
      el("div", { className: "pagina__acoes" }, [
        el("span", { className: "etiqueta etiqueta--neutra", text: "Versão 1.0.0" }),
      ]),
    ])
  );

  /* --------------------------------------------------------- arquitetura */

  pagina.append(
    secao(
      "Arquitetura tecnológica",
      "A aplicação é Organized em quatro camadas com responsabilidades bem separadas: apresentação, serviços, dados e fontes.",
      [
        tabelaEstatica(
          ["Camada", "Responsabilidade", "Tecnologias e arquivos"],
          [
            [
              "Apresentação",
              "Interface, roteamento por hash, componentes visuais e os 21 aplicativos da plataforma.",
              "ES Modules, ArcGIS Maps SDK for JavaScript 4.30, Chart.js 4.6 — src/main.js, src/router.js, src/modules/, src/components/",
            ],
            [
              "Serviços",
              "Estado global, filtros compartilhados, autorização e regras transversais.",
              "src/services/state.js (store reativo), src/services/data.js (carga e agregação), src/auth.js (sessão e permissões)",
            ],
            [
              "Dados",
              "Bases locais servidas como arquivos estáticos dentro de data/.",
              "GeoJSON (municípios, SNV, vias estaduais, áreas de proteção, obras, ativos) e JSON (contratos, convênios, máquinas, vistorias, série de investimento, indicadores)",
            ],
            [
              "Fontes",
              "Origem, licença, metodologia e qualidade de cada base; distinction entre dado real, simulado e indisponível.",
              "data/fontes.json, scripts/fetch_dados_reais.py, scripts/gerar_dados_simulados.py, scripts/gerar_fontes.py",
            ],
          ]
        ),
        el("p", {
          className: "painel__descricao",
          text:
            "O catálogo em data/fontes.json é a fonte de verdade sobre a natureza de cada base: as camadas " +
            "marcadas como REAL são consultáveis publicamente, as SIMULADAS são demonstrativas e as " +
            "INDISPONÍVEIS aguardam autorização do órgão publicador.",
        }),
      ]
    )
  );

  /* ------------------------------------------------------- modelo de dados */

  const entidades = [
    ["Município", "Malha municipal oficial do IBGE com código e área.", "codigo_ibge (PK) · nome · area_km2 · geometria"],
    ["Rodovia", "Via federal ou estadual identificada pelo código oficial (BR/RO).", "codigo_rodovia (PK) · codigo_br · jurisdicao · extensao_km"],
    ["Trecho", "Segmento da rodovia com quilometragem de referência.", "codigo_snv (PK) · km_inicial · km_final · superficie · geometria"],
    ["Obra", "Intervenção pública com categoria, valor, execução e prazo.", "id (UUID) · municipio_codigo (FK) · rodovia (FK) · valor_atualizado · percentual_execucao_fisica"],
    ["Contrato", "Instrumento contratual com vigência, empenho, liquidação e pagamento.", "id (UUID) · valor_inicial · valor_aditivos · saldo · obras[]"],
    ["Medição", "Aferição de avanço físico e financeiro de uma obra.", "numero · data · percentual_fisico · valor_medido · responsavel"],
    ["Ativo", "Inventário georreferenciado de estruturas e dispositivos.", "id (UUID) · tipo · condicao · criticidade · municipio_codigo (FK)"],
    ["Ponte", "Tipo de ativo estrutural com vão, capacidade e prazo de inspeção.", "ativo_id (FK) · extensao_m · capacidade · ano_implantacao"],
    ["Inspeção", "Avaliação periódica do estado de um ativo.", "ativo_id (FK) · data · condicao · parecer · responsavel"],
    ["Convênio", "Transferência a município com valor, contrapartida e vigência.", "id (UUID) · orgao_concedente · beneficiario · valor · desembolsado"],
    ["Empresa", "Contratada responsável pela execução da obra.", "razao_social (FK) · cnpj"],
    ["Equipamento", "Máquina da frota de manutenção com patrimônio e disponibilidade.", "id (UUID) · patrimonial · unidade_responsavel · disponibilidade"],
    ["Usuário", "Conta com perfil de acesso e permissões verificadas no backend.", "id (UUID) · nome · email · perfil"],
    ["Indicador", "Valor agregado calculado sobre os registros, nunca digitado manualmente.", "id · nome · unidade · periodo · valor · fonte"],
    ["Projeto", "Programa com múltiplas obras e orçamento próprio.", "id (UUID) · nome · orcamento · horizonte"],
    ["Fonte de financiamento", "Recurso que paga a intervenção.", "id · nome · esfera · origem"],
    ["Alerta", "Ocorrência derivada de regra sobre prazos, execução ou risco.", "id · tipo · gravidade · obra_id (FK) · gerado_em"],
    ["Evidência fotográfica", "Imagem anexada a uma vistoria com data e autoria.", "id (UUID) · vistoria_id (FK) · arquivo · data_captura · autor"],
  ];

  pagina.append(
    secao(
      "Modelo de dados",
      "Entidades do domínio e as chaves que as ligam. As chaves de negócio são sempre estáveis e herdadas da fonte oficial.",
      [
        tabelaEstatica(["Entidade", "Descrição", "Chaves e campos principais"], entidades),
        el("p", {
          className: "painel__descricao",
          text:
            "Chaves normalizadas: UUID para identificadores próprios da plataforma (obra, contrato, convênio, " +
            "ativo, equipamento, usuário), código IBGE de 7 dígitos para município (1100205 = Porto Velho) e " +
            "identificador oficial de rodovia no formato SNV (B-364 para o eixo principal da BR-364, C-364 para " +
            "contorno, RO-391 para via estadual). As ligações entre tabelas são feitas por esses identificadores, " +
            "e nunca por texto livre.",
        }),
      ]
    )
  );

  /* ------------------------------------------------------- configuracao */

  pagina.append(
    secao(
      "Manual de configuração",
      "Todas as chaves são lidas do ambiente no formato VITE_* e nunca ficam gravadas no código-fonte.",
      [
        tabelaEstatica(
          ["Variável", "Função", "Padrão", "Exemplo"],
          [
            ["VITE_ARCGIS_API_KEY", "Chave da API ArcGIS usada nos mapas base e serviços da Esri.", "vazia (mapas públicos seguem funcionando)", "VITE_ARCGIS_API_KEY=abc123..."],
            ["VITE_ARCGIS_PORTAL_ID", "Portal ArcGIS que hospeda o aplicativo OAuth 2.0.", "vazia (login desabilitado)", "VITE_ARCGIS_PORTAL_ID=abcdef1234567890"],
            ["VITE_ARCGIS_CLIENT_ID", "Client ID do aplicativo público registrado no portal.", "vazia (login desabilitado)", "VITE_ARCGIS_CLIENT_ID=xyz789"],
            ["VITE_API_BASE_URL", "Backend de produção (FastAPI) que valida sessão, troca o token e grava auditoria.", "vazia = modo demonstração local", "VITE_API_BASE_URL=https://api.estado.ro.gov.br"],
            ["VITE_MODO_DADOS", "Modo de operação dos dados exibidos.", "demonstracao", "VITE_MODO_DADOS=producao"],
            ["VITE_PWA_ATIVO", "Ativa o registro do service worker (instalação como aplicativo).", "ativo (qualquer valor diferente de false)", "VITE_PWA_ATIVO=false"],
          ]
        ),
        el("p", {
          className: "painel__descricao",
          text:
            "O arquivo .env.local fica na raiz do projeto e nunca é versionado. O prefixo VITE_ é exigência do " +
            "Vite: qualquer variável exposta dessa forma é embutida no bundle do navegador — segredos " +
            "(client_secret do portal, senhas de banco) jamais devem ser usados aqui.",
        }),
        blocoCodigo(
          "# .env.local — desenvolvimento\n" +
            "VITE_ARCGIS_API_KEY=\n" +
            "VITE_ARCGIS_PORTAL_ID=\n" +
            "VITE_ARCGIS_CLIENT_ID=\n" +
            "VITE_API_BASE_URL=\n" +
            "VITE_MODO_DADOS=demonstracao\n" +
            "VITE_PWA_ATIVO=true\n" +
            "\n# instalar dependências e subir o servidor de desenvolvimento\n" +
            "npm ci\n" +
            "npm run dev"
        ),
      ]
    )
  );

  /* --------------------------------------------------------- publicacao */

  pagina.append(
    secao(
      "Manual de publicação",
      "A aplicação é estática: o resultado do build é um conjunto de arquivos servidos por qualquer CDN. O backend é opcional e fica separado.",
      [
        el("h4", { className: "painel__titulo", text: "Build local e GitHub Pages" }),
        blocoCodigo(
          "npm ci                 # instala exatamente as versões do package-lock.json\n" +
            "npm run build          # gera a pasta dist/\n" +
            "npx serve dist         # confere o resultado localmente\n" +
            "\n# publicação no GitHub Pages (branch gh-pages)\n" +
            "npm run build\n" +
            "npx gh-pages -d dist"
        ),
        el("p", {
          className: "painel__descricao",
          text:
            "Em GitHub Pages o site costuma ser servido em um subdomínio (ex.: usuario.github.io/central-infra-ro). " +
            "Por isso o vite.config.js usa base relativa (base: \"./\"), e todas as URLs de dados são montadas a " +
            "partir de import.meta.env.BASE_URL — não deve haver caminho absoluto como /data/... no código.",
        }),
        el("h4", { className: "painel__titulo", text: "Vercel" }),
        blocoCodigo(
          '{\n' +
            '  "$schema": "https://openapi.vercel.sh/vercel.json",\n' +
            '  "buildCommand": "npm run build",\n' +
            '  "outputDirectory": "dist",\n' +
            '  "cleanUrls": true,\n' +
            '  "headers": [\n' +
            '    {\n' +
            '      "source": "/assets/(.*)",\n' +
            '      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]\n' +
            "    }\n" +
            "  ]\n" +
            "}"
        ),
        el("p", {
          className: "painel__descricao",
          text:
            "As variáveis de ambiente do projeto são configuradas em Settings → Environment Variables do projeto " +
            "Vercel (separadas para Preview e Production). A base relativa continua valendo: o bundle funciona na " +
            "raiz do domínio ou em subpasta sem ajuste adicional.",
        }),
      ]
    )
  );

  /* ------------------------------------------------------- autenticacao */

  pagina.append(
    secao(
      "Autenticação e autorização",
      "O fluxo preparado é OAuth 2.0 Authorization Code com PKCE contra o ArcGIS Enterprise.",
      [
        el("p", {
          className: "painel__descricao",
          text:
            "Ao entrar, o aplicativo gera um verificador aleatório, deriva o code_challenge (S256) e redireciona " +
            "para https://{portalId}.arcgis.com/oauth2/authorize. O portal devolve o código de autorização, que é " +
            "trocado por token no backend. O frontend nunca recebe client_secret.",
        }),
        el("p", {
          className: "painel__detalhe",
          text:
            "O frontend NÃO é mecanismo de segurança: ele apenas esconde ações que o perfil não pode executar. " +
            "Toda requisição ao backend é revalidada no servidor (token, perfil, trilha de auditoria) e a trilha " +
            "oficial de auditoria só existe no backend. Enquanto o modo demonstração estiver ativo, a troca de " +
            "perfil é apenas visual.",
        }),
        tabelaEstatica(
          ["Etapa", "Responsável", "Onde acontece"],
          [
            ["Login (redirecionamento e PKCE)", "Frontend", "src/auth.js — prepararLogin()"],
            ["Troca do código por token", "Backend", "POST {VITE_API_BASE_URL}/api/auth/arcgis/token"],
            ["Validação de perfil e operação", "Backend", "A cada requisição, com o token do usuário"],
            ["Trilha de auditoria oficial", "Backend", "Registro imutável no servidor"],
            ["Trilha de auditoria local (demonstração)", "Frontend", "localStorage — src/modules/_auditoria.js"],
          ]
        ),
      ]
    )
  );

  /* ------------------------------------------------ integracao enterprise */

  pagina.append(
    secao(
      "Integração com ArcGIS Enterprise",
      "O que já está preparado no código e o que depende de credenciais e serviços do Estado.",
      [
        tabelaEstatica(
          ["Recurso", "Situação nesta versão", "Como entra em produção"],
          [
            [
              "FeatureServer / MapServer",
              "Preparado: o geoportal já consome FeatureServer públicos do SNV, da malha viária e dos municípios.",
              "Publicar os bases de obras, contratos, ativos e convênios como FeatureServer no portal do Estado e trocar as URLs em src/config.js.",
            ],
            [
              "ArcGIS Online",
              "Em uso: mapas base, geocodificador e rótulos vêm de serviços públicos ArcGIS Online.",
              "Quando a política do Estado exigir, migrar para os basemaps corporativos hospedados no ArcGIS Enterprise.",
            ],
            [
              "Survey123 / Field Maps",
              "Botão de origem desabilitado no APP 10 com o motivo explicado na interface.",
              "Habilitar o survey no aplicativo Field Maps e publicar o FeatureServer de vistorias; então ligar o botão ao ArcGIS Maps SDK for Survey123.",
            ],
            [
              "Network Analyst (roteamento)",
              "O APP 06 calcula estimativa por distância de estrada sobre a malha real (SNV + vias estaduais), com ligações aproximadas entre trechos desconectados.",
              "Licenciar e configurar o serviço de roteamento no ArcGIS Enterprise e consumir a API de solveRoute.",
            ],
            [
              "GeoAI / Spatial Analytics",
              "O APP 13 usa apenas regras heurísticas determinísticas, declaradas como não-IA treinada.",
              "Substituir progressivamente as regras por geoprocessamentos do ArcGIS GeoAI ou por modelos hospedados no Enterprise.",
            ],
            [
              "Comparação temporal de imagens",
              "Não disponível: o mapa base atual não tem histórico.",
              "Hospedar um imagery server histórico com referências temporais e habilitar a comparação de periods no APP 15.",
            ],
          ]
        ),
      ]
    )
  );

  /* -------------------------------------------------------- limitacoes */

  pagina.append(
    secao(
      "Limitações conhecidas",
      "Restrições assumidas nesta versão — registradas aqui para que ninguém interprete a tela além do que ela mostra.",
      [
        blocoAviso(
          "Dados de obras, contratos e ativos são simulados",
          "As bases de demonstração têm estrutura, relações e valores coerentes, mas não representam obras " +
            "reais. Todos os painéis que as exibem carregam a etiqueta SIMULADO.",
          "perigo"
        ),
        blocoAviso(
          "Comparação temporal de imagens exige imagery server histórico",
          "Sem um serviço com referências temporais, o mapa não compara imagens de períodos diferentes: o recorte " +
            "por período apenas atualiza as camadas pela data de início de cada registro.",
          "alerta"
        ),
        blocoAviso(
          "Roteamento exige serviço licenciado",
          "As distâncias do APP 06 são estimativas calculadas por caminho mínimo sobre a malha real, sem " +
            "impedimentos, sentidos ou restrições de carga. O roteamento oficial exige ArcGIS Network Analyst " +
            "licenciado e configurado.",
          "alerta"
        ),
        blocoAviso(
          "Autenticação real exige backend",
          "Sem VITE_API_BASE_URL configurado, o login ArcGIS e a troca de token não funcionam e o controle de " +
            "perfil é apenas demonstrativo.",
          "alerta"
        ),
        blocoAviso(
          "Convênios, áreas protegidas e zoneamento dependem de acesso oficial",
          "Convênios reais exigem o Portal da Transparência de Rondônia; áreas de proteção e unidades de " +
            "conservação exigem credencial do órgão publicador (CNPq, INPE, SEDAM); zoneamento e hidrografia " +
            "dependem de bases oficiais ainda não publicadas.",
          "alerta"
        ),
        blocoAviso(
          "Precisão da malha municipal generalizada",
          "Os limites municipais vêm do geoBoundaries (derivado do IBGE 2020) com generalização topológica: " +
            "erro de posição de fronteira de aproximadamente 1 km e área total 0,5% acima da oficial. " +
            "Não use a malha para demarcação de lotes.",
          "alerta"
        ),
      ]
    )
  );

  /* ----------------------------------------------------- creditos/licencas */

  pagina.append(
    secao(
      "Créditos e licenças",
      "A plataforma combina serviços públicos, bases geográficas oficiais e bibliotecas de código aberto.",
      [
        tabelaEstatica(
          ["Recurso", "Origem", "Licença / crédito"],
          [
            ["Mapas base e rótulos", "Esri — World Street Map, World Imagery, World Topographic, Light Gray, Dark Gray, Terrain, OpenStreetMap", "Crédito exibido no mapa: Esri, HERE, Garmin, FAO, NOAA, USGS"],
            ["Sistema Nacional de Viária (SNV)", "DNIT — FeatureServer público ArcGIS", "Serviço público ArcGIS Online, uso sujeito aos termos da Esri e do órgão publicador"],
            ["Malha viária estadual RO-xxx", "FeatureServer público «Rondonia Roads»", "Serviço público ArcGIS Online, uso sujeito aos termos da Esri"],
            ["Limites municipais", "IBGE (2020) via geoBoundaries BRA ADM2", "CC BY 3.0 IGO — atribuição obrigatória"],
            ["População e PIB municipal", "IBGE — SIDRA, tabelas 6579 (Censo 2022) e 5938", "Licença de uso livre do IBGE (LDAP 2.1)"],
            ["Áreas de proteção", "Serviço público de unidades de conservação", "Consulta pública conforme licença de cada base"],
            ["Mapas JS", "ArcGIS Maps SDK for JavaScript 4.30 (Esri)", "Termos de uso da Esri"],
            ["Gráficos", "Chart.js 4.6", "MIT"],
            ["Build e servidor", "Vite 7", "MIT"],
          ]
        ),
        el("p", {
          className: "painel__descricao",
          text:
            `Ambiente atual: modo de dados «${config.modoDados}», ${config.producao ? "backend configurado" : "sem backend (demonstração local)"}, ` +
            `PWA ${config.pwaAtivo ? "ativo" : "desativado"}. Todos os valores numéricos exibidos nos aplicativos ` +
            "são calculados a partir dos registros carregados — nenhum número é digitado à mão.",
        }),
      ]
    )
  );

  container.append(pagina);

  return {
    destruir() {
      limpar(pagina);
    },
  };
}
