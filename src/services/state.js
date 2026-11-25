/**
 * Store reativo simples (sem dependencias externas).
 * Um unico objeto de estado, alteracoes notificadas por chave.
 */

class Store {
  constructor(estadoInicial = {}) {
    this.estado = { ...estadoInicial };
    this.ouvintes = new Map();
    this.proximoId = 1;
  }

  /** Le um trecho do estado. */
  obter(chave) {
    return chave ? this.estado[chave] : this.estado;
  }

  /** Atualiza o estado e notifica os inscritos na chave (ou em todas). */
  definir(mudancas, opcoes = {}) {
    const chaves = Object.keys(mudancas);
    chaves.forEach((chave) => {
      this.estado[chave] = mudancas[chave];
    });
    if (!opcoes.silencioso) this.notificar(chaves);
    return this.estado;
  }

  /** Inscreve um ouvinte para uma chave (ou "*" para todas). */
  inscrever(chave, callback) {
    const id = this.proximoId++;
    if (!this.ouvintes.has(chave)) this.ouvintes.set(chave, new Map());
    this.ouvintes.get(chave).set(id, callback);
    return () => this.ouvintes.get(chave)?.delete(id);
  }

  /** Notifica os ouvintes afetados. */
  notificar(chaves) {
    const afetados = new Set();
    chaves.forEach((chave) => {
      this.ouvintes.get(chave)?.forEach((cb) => afetados.add(cb));
    });
    this.ouvintes.get("*")?.forEach((cb) => afetados.add(cb));
    afetados.forEach((cb) => {
      try {
        cb(this.estado);
      } catch (erro) {
        console.error("[store] erro no ouvinte:", erro);
      }
    });
  }
}

/** Filtros globais compartilhados por todos os aplicativos. */
export const FILTROS_INICIAIS = {
  municipio: null, // codigo IBGE
  municipioNome: null,
  categoria: null, // categoria de obra
  situacao: null, // situacao (obra/contrato/convenio)
  rodovia: null, // codigo BR/RO
  orgao: null,
  fonteRecurso: null,
  anoInicio: 2019,
  anoFim: 2026,
  apenasAtrasados: false,
  apenasCriticos: false,
  busca: "",
};

export const store = new Store({
  filtros: { ...FILTROS_INICIAIS },
  selecao: null, // { tipo: 'obra'|'municipio'|..., id }
  usuario: null,
 permissoes: [],
  camadaAtiva: null,
  mapaPronto: false,
  dadosCarregados: false,
  erroDados: null,
  resultados: null, // cache do ultimo recorte calculado
});

/** Atualiza filtros preservando os demais campos. */
export function definirFiltros(mudancas) {
  store.definir({ filtros: { ...store.obter("filtros"), ...mudancas } });
}

/** Limpa todos os filtros (mantem o intervalo de anos). */
export function limparFiltros() {
  const atual = store.obter("filtros");
  store.definir({
    filtros: { ...FILTROS_INICIAIS, anoInicio: atual.anoInicio, anoFim: atual.anoFim },
  });
}

/** Marca a selecao atual (obra, municipio, contrato...). */
export function selecionar(tipo, id, extras = {}) {
  store.definir({ selecao: { tipo, id, ...extras } });
}

export function limparSelecao() {
  store.definir({ selecao: null });
}

export default store;
