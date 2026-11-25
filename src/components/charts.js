/**
 * Graficos com Chart.js — tema institucional, responsivo e acessivel.
 * Todos os valores sao calculados a partir dos registros carregados.
 */
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

Chart.defaults.font.family =
  '"Inter", "Segoe UI", system-ui, -apple-system, Arial, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = "#33404c";
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(11, 37, 69, 0.94)";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.padding = 14;

const PALETA = ["#0b6e4f", "#1f8a70", "#0b2545", "#2e7daf", "#c9a227", "#b23a48", "#d97a1f", "#5b4b8a", "#6b7a88"];

const graficos = new Set();

/** Cria (ou substitui) um grafico dentro de um container. */
export function criarGrafico(container, configuracao) {
  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", configuracao.opcoes?.accessibilityLabel || "Gráfico");
  container.append(canvas);
  const grafico = new Chart(canvas.getContext("2d"), configuracao);
  graficos.add(grafico);
  return grafico;
}

/** Destroi todos os graficos (troca de rota). */
export function destruirGraficos() {
  graficos.forEach((g) => g.destroy());
  graficos.clear();
}

function base(opcoes = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false, position: "bottom" },
      tooltip: { callbacks: {} },
      ...opcoes.plugins,
    },
    scales: opcoes.scales,
    ...opcoes.extra,
  };
}

/** Grafico de barras verticais. */
export function graficoBarras(container, { rotulos, valores, rotuloX = "", rotuloY = "", cor = PALETA[0], formatador = null, extras = {} }) {
  return criarGrafico(container, {
    type: "bar",
    data: {
      labels: rotulos,
      datasets: [
        {
          label: rotuloY || "Valor",
          data: valores,
          backgroundColor: cor,
          borderRadius: 4,
          maxBarThickness: 46,
        },
      ],
    },
    options: base({
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(19, 32, 45, 0.08)" },
          ticks: { callback: (v) => (formatador ? formatador(v) : v) },
          title: { display: !!rotuloY, text: rotuloY },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatador ? formatador(ctx.parsed.y) : ctx.parsed.y}`,
          },
        },
      },
      ...extras,
    }),
  });
}

/** Grafico de barras horizontais (rankings). */
export function graficoBarrasHorizontais(container, { rotulos, valores, formatador = null, cor = PALETA[0], extras = {} }) {
  return criarGrafico(container, {
    type: "bar",
    data: {
      labels: rotulos,
      datasets: [{ data: valores, backgroundColor: cor, borderRadius: 4, maxBarThickness: 22 }],
    },
    options: base({
      indexAxis: "y",
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(19, 32, 45, 0.08)" }, ticks: { callback: (v) => (formatador ? formatador(v) : v) } },
        y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${formatador ? formatador(ctx.parsed.x) : ctx.parsed.x}` } },
      },
      ...extras,
    }),
  });
}

/** Grafico de linha (series temporais). */
export function graficoLinha(container, { rotulos, series, rotuloX = "", rotuloY = "", formatador = null, extras = {} }) {
  return criarGrafico(container, {
    type: "line",
    data: {
      labels: rotulos,
      datasets: series.map((serie, indice) => ({
        label: serie.nome,
        data: serie.valores,
        borderColor: serie.cor || PALETA[indice % PALETA.length],
        backgroundColor: `${serie.cor || PALETA[indice % PALETA.length]}22`,
        fill: serie.preenchimento !== false,
        tension: 0.32,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
      })),
    },
    options: base({
      scales: {
        x: { grid: { display: false }, title: { display: !!rotuloX, text: rotuloX } },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(19, 32, 45, 0.08)" },
          ticks: { callback: (v) => (formatador ? formatador(v) : v) },
          title: { display: !!rotuloY, text: rotuloY },
        },
      },
      plugins: {
        legend: { display: series.length > 1, position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatador ? formatador(ctx.parsed.y) : ctx.parsed.y}` } },
      },
      ...extras,
    }),
  });
}

/** Grafico de rosca (composicao). */
export function graficoRosca(container, { rotulos, valores, cores = PALETA, extras = {} }) {
  return criarGrafico(container, {
    type: "doughnut",
    data: {
      labels: rotulos,
      datasets: [{ data: valores, backgroundColor: cores, borderColor: "#fff", borderWidth: 2 }],
    },
    options: base({
      cutout: "62%",
      scales: {},
      plugins: {
        legend: { display: true, position: "right" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}` } },
      },
      ...extras,
    }),
  });
}

/** Mapa de calor simples (matriz hora x dia) em tabela estilizada. */
export function tabelaMapaCalor(container, { linhas, colunas, valores, formatador = (v) => v, aoClicar }) {
  container.innerHTML = "";
  const maximo = Math.max(1, ...valores.flat());
  const tabela = document.createElement("table");
  tabela.className = "tabela tabela--calor";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th scope="col">${linhas[0] ?? ""}</th>${colunas.map((c) => `<th scope="col">${c}</th>`).join("")}</tr>`;
  const tbody = document.createElement("tbody");
  linhas.slice(1).forEach((linha, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<th scope="row">${linha}</th>` +
      valores[i].map((v) => {
        const intensidade = v / maximo;
        return `<td style="background: rgba(11,110,79,${(0.08 + intensidade * 0.78).toFixed(2)})" data-valor="${v}">${formatador(v)}</td>`;
      }).join("");
    tbody.append(tr);
  });
  tabela.append(thead, tbody);
  container.append(tabela);
  if (aoClicar) {
    tabela.addEventListener("click", (ev) => {
      const celula = ev.target.closest("td");
      if (celula) aoClicar(Number(celula.dataset.valor), ev.target);
    });
  }
  return tabela;
}

export { PALETA };
