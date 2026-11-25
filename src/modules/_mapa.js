/**
 * Ajuste local da altura do mapa.
 *
 * O componente cartografico compartilhado (src/components/mapa.js) usa um
 * container sem altura definitiva; o canvas do ArcGIS acaba definindo a altura
 * do proprio container, e a interface cresce a cada novo resize. Aqui damos
 * uma altura fixa ao mapa para que a pagina mantenha o layout estavel.
 *
 * Nao ha CSS novo: apenas estilo inline sobre os elementos ja existentes.
 */
export function ajustarAlturaMapa(container, opcoes = {}) {
  const alturaArea = opcoes.alturaArea ?? 520;
  const alturaInterface = opcoes.alturaInterface ?? alturaArea + 100;

  const interfaceMapa = container.querySelector(".mapa-interface");
  const area = container.querySelector(".mapa-area");

  if (interfaceMapa) {
    interfaceMapa.style.height = `${alturaInterface}px`;
  }
  if (area) {
    area.style.height = `${alturaArea}px`;
    area.style.minHeight = `${alturaArea}px`;
    area.style.flex = "none";
  }
  return { interfaceMapa, area };
}
