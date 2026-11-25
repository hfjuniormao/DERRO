/**
 * Trilha de auditoria local (localStorage).
 *
 * Registra as acoes administrativas e de campo executadas neste dispositivo.
 * A trilha local e COMPLEMENTAR — a trilha oficial deve ser gravada pelo
 * backend (ArcGIS Enterprise + FastAPI), que valida usuario, perfil e hora.
 */
import { store } from "../services/state.js";

export const CHAVE_AUDITORIA = "central-infra-ro:auditoria";
const LIMITE = 500;

/** Le a trilha de auditoria gravada localmente. */
export function lerAuditoria() {
  try {
    const bruto = localStorage.getItem(CHAVE_AUDITORIA);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

/**
 * Grava um registro na trilha de auditoria.
 * @param {object} entrada { acao, detalhe, alvo }
 */
export function registrarAuditoria({ acao, detalhe = "", alvo = null }) {
  const usuario = store.obter("usuario");
  const registro = {
    id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    data: new Date().toISOString(),
    usuario: usuario?.nome || "Visitante",
    perfil: usuario?.perfil || "cidadao",
    acao,
    detalhe,
    alvo,
    origem: "local",
  };
  try {
    const lista = lerAuditoria();
    lista.unshift(registro);
    localStorage.setItem(CHAVE_AUDITORIA, JSON.stringify(lista.slice(0, LIMITE)));
  } catch (erro) {
    console.warn("[auditoria] falha ao gravar o registro local:", erro);
  }
  return registro;
}

/** Limpa a trilha de auditoria local. */
export function limparAuditoria() {
  try {
    localStorage.removeItem(CHAVE_AUDITORIA);
    return true;
  } catch {
    return false;
  }
}
