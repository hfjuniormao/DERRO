# Integração com ArcGIS Enterprise — CENTRAL INFRA RO 360

## 1. Panorama

O frontend funciona sem ArcGIS Enterprise (modo demonstração). Com ele, três
capacidades são habilitadas:

1. **Camadas corporativas reais** (DER-RO, DEOSP, obras em execução).
2. **Autenticação OAuth 2.0** com o portal corporativo.
3. **Serviços analíticos**: Network Analyst (roteamento), Geometry Server,
   Geoprocessing e Image Server.

## 2. Publicando um FeatureServer do Estado

1. No portal (`https://<portal>.arcgis.com`), crie um **Feature Service** com
   as camadas do órgão (obras, contratos, ativos).
2. Defina **allowed origins** (HTTPS do domínio publicado + `localhost:5173`).
3. Configure a **capacidade de download** apenas se a política institucional
   permitir; caso contrário, o frontend usa consultas REST com `query` e a
   exportação client-side.
4. Publique como "Public" somente para itens não sensíveis; itens restritos
   usam "Organization" ou "Private" + OAuth.

### Consumindo no frontend

```js
// src/maps/layers.js — exemplo de camada corporativa
{
  id: "obras-der",
  titulo: "Obras do DER-RO",
  grupo: "obras",
  status: "REAL",
  opcoes: {
    url: "https://services.exemplo.arcgis.com/arcgis/rest/services/DER_RO_Obras/FeatureServer/0",
    portalItem: { id: "<item-id>" },
  },
  renderer: { /* ... */ },
}
```

O `GeoJSONLayer` atende às bases locais; para serviços do portal use
`FeatureLayer` com `url` + `portalItem` (a chave da API e o item id bastam).

## 3. Roteamento e acessibilidade (APP 06)

Exige o serviço **Network Analysis** habilitado no servidor:

1. Publique um serviço de rotas (`arcgis/rest/services/World/Route/NAServer`).
2. Configure o perfil de transporte (caminho de veículo, caminhão).
3. No módulo de logística, chame `route.solve()` com as coordenadas da malha
   **efetiva** (não estimada por distância).

> Nesta versão, a estimativa de acessibilidade usa distância de malha e está
> rotulada como *estimativa*, nunca como roteamento oficial.

## 4. Comparação temporal de imagens

Requer um **Image Server** com mosaicos históricos:

1. Publique o acervo histórico como `Image Server` com campos de tempo.
2. No geoportal, use `WebMap`/`MapImageLayer` com `timeExtent` e habilite o
   controle de tempo (`ArcGIS Maps SDK — Timeline`).
3. Sem esse serviço, a plataforma filtra registros por período (implementado).

## 5. Survey123 e Field Maps (APP 10)

- **Survey123:** publique o formulário e registre o `portalItem.id`; a
  interface abre o formulário no app Field Maps ou no navegador.
- **Field Maps:** use o `FeatureLayer` do survey como destino das vistorias
  (criação de feição via `applyEdits`) e mantenha o `surveyItemId` no backend.
- Sincronização: o frontend atual usa `localStorage` + detecção de
  `navigator.onLine`; em produção, troque o destino local por
  `POST /api/vistorias` (já implementado no backend).

## 6. GeoAI e modelos preditivos (APP 13)

Caminho de integração:

1. Treine/valide o modelo em **ArcGIS Pro** ou em Python (scikit-learn,
   PyTorch) e publique como **ArcGIS Pro Model** ou **Deep Learning Model**.
2. Exponha a inferência como **GeoProcessing Service** (ou `ArcGIS Notebook`
   no ArcGIS Enterprise).
3. O frontend chama o serviço com `execute()` e **exibe o resultado como
   previsão do modelo**, com a identificação do modelo e da data de treino.

> Nesta versão, as análises do APP 13 são **regras heurísticas** claramente
> identificadas como simulação — conforme a exigência do projeto de não
> apresentar resultado fictício como IA treinada.

## 7. Ciclo de vida de uma publicação

```
ArcGIS Pro  → Portal (item)  →  Feature/Map/Image Server
      │             │
      │             └─ allowed origins, papel, visibilidade
      └─ backup e versionamento (arcpy.mp / ArcGIS Data Reviewer)
```

Checklist por item publicado:

- [ ] sistema de referência SIRGAS 2000 (ou reprojetado na publicação)
- [ ] metadados preenchidos (orgão, data, metodologia, licença)
- [ ] `allowed origins` = domínios oficiais
- [ ] capacidade de exportação conforme a política de dados abertos
- [ ] item sem dados pessoais ou sensíveis

## 8. Anexo: endpoints públicos já verificados

| Serviço | URL |
|---|---|
| SNV (rodovias) | `https://services8.arcgis.com/WnoZVgMq9I8Pjaoc/arcgis/rest/services/Rodovias/FeatureServer/0` |
| Malha viária RO | `https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/Rondonia_Roads/FeatureServer/0` |
| Áreas de proteção | `https://services.arcgis.com/hVnyNvwbpFFPDV5j/arcgis/rest/services/Rondonia_Protected_Forests/FeatureServer/0` |
| Municípios (referência) | `https://services7.arcgis.com/0aIYoePYWCc92Hxe/arcgis/rest/services/Municípios_de_Rondônia/FeatureServer/0` |
| Geocodificador Esri | `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer` |
