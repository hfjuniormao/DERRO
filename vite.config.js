import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * CENTRAL INFRA RO 360
 *
 * Deploy alvo: Vercel (estatico) / GitHub Pages / qualquer hosting estatico.
 * O backend FastAPI/PostGIS (opcional) roda separado - ver backend/README.md.
 */

const RAIZ = fileURLToPath(new URL(".", import.meta.url));

/**
 * Copia a pasta `data/` para `dist/data/`.
 *
 * O Vite so copia `public/` na saida. As bases de dados (reais e simuladas)
 * ficam em `data/` na raiz do projeto — exigido pelo escopo — e sao baixadas
 * em tempo de execucao por `src/services/data.js`. Sem esta copia o build
 * seria publicado sem nenhum dado.
 */
function copiarPastaDados() {
  return {
    name: "central-infra-ro:copiar-dados",
    apply: "build",
    closeBundle() {
      const origem = `${RAIZ}data`;
      const destino = `${RAIZ}dist/data`;
      if (!existsSync(origem)) {
        this.warn("Pasta data/ nao encontrada — o build sera publicado sem as bases de dados.");
        return;
      }
      rmSync(destino, { recursive: true, force: true });
      cpSync(origem, destino, { recursive: true });
      this.info(`data/ copiada para dist/data (${existsSync(destino) ? "ok" : "falhou"}).`);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [copiarPastaDados()],
  build: {
    target: "es2022",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        // O pacote @arcgis/core nao declara `main`/`module`/`exports` — e
        // resolvido por caminho (ex.: @arcgis/core/Map). Forcar o SDK inteiro
        // em um chunk estoura a memoria do build, entao ele fica para a
        // divisao automatica do Rollup (chunk comum dos modulos lazy).
        manualChunks(id) {
          if (id.includes("node_modules/chart.js/")) return "charts";
          return undefined;
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
