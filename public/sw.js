/**
 * CENTRAL INFRA RO 360 — Service worker (PWA).
 *
 * Estrategia:
 *  - App shell (HTML/JS/CSS): cache-first com atualizacao em segundo plano.
 *  - Datasets em /data: stale-while-revalidate (permite uso offline do mapa).
 *  - Cartografia da Esri: nunca e cacheada (o SDK ja gerencia o proprio cache).
 */
const VERSAO = "central-infra-ro-v1";
const CACHE_SHELL = `${VERSAO}-shell`;
const CACHE_DADOS = `${VERSAO}-dados`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(["./", "./index.html", "./manifest.webmanifest"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((chave) => !chave.startsWith(VERSAO)).map((chave) => caches.delete(chave)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requisicao = event.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return; // Esri, CDN e fontes externas ficam por conta própria

  if (url.pathname.includes("/data/")) {
    event.respondWith(
      caches.open(CACHE_DADOS).then(async (cache) => {
        const emCache = await cache.match(requisicao);
        const rede = fetch(requisicao)
          .then((resposta) => {
            if (resposta.ok) cache.put(requisicao, resposta.clone());
            return resposta;
          })
          .catch(() => emCache);
        return emCache || rede;
      })
    );
    return;
  }

  if (requisicao.mode === "navigate") {
    event.respondWith(
      fetch(requisicao).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_SHELL).then(async (cache) => {
      const emCache = await cache.match(requisicao);
      const rede = fetch(requisicao)
        .then((resposta) => {
          if (resposta.ok) cache.put(requisicao, resposta.clone());
          return resposta;
        })
        .catch(() => emCache);
      return emCache || rede;
    })
  );
});
