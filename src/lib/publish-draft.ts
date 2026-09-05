// Borrador local del Paso 1 de "Vender vuelos" — se guarda justo antes de
// pedir login por primera vez (para no perder lo llenado si el usuario cierra
// el modal o abandona la pestaña), y se borra recién cuando el pasaje se
// publica con éxito. No requiere backend: vive 100% en localStorage del
// navegador, por diseño (ver el prompt de "gatillo de login al final del
// Paso 1").
const DRAFT_KEY = "buelazo_publish_draft";

export function savePublishDraft(data: unknown) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // Sin storage disponible (privado/bloqueado): no rompe el flujo, solo no
    // hay borrador para recuperar si el usuario abandona.
  }
}

export function loadPublishDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearPublishDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // no-op
  }
}
