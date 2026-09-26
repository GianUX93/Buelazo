// Borrador local de "Vender vuelos" — se guarda en cada cambio de datos o de
// paso (0, 1 o 2; nunca en 3, que ya se publicó), sin importar si hay sesión
// o no. Antes solo se guardaba una vez, justo antes de pedir login por
// primera vez — un usuario ya logueado que avanzaba a Precio/Listo y
// navegaba a otra sección perdía todo, porque nunca se había guardado nada
// para él y el paso en sí nunca se persistía. Se borra recién cuando el
// pasaje se publica con éxito (o el usuario elige "Empezar de nuevo"). No
// requiere backend: vive 100% en localStorage del navegador.
const DRAFT_KEY = "buelazo_publish_draft";

export interface PublishDraft {
  step: number;
  data: Record<string, unknown>;
}

export function savePublishDraft(data: Record<string, unknown>, step: number) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data }));
  } catch {
    // Sin storage disponible (privado/bloqueado): no rompe el flujo, solo no
    // hay borrador para recuperar si el usuario abandona.
  }
}

export function loadPublishDraft(): PublishDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Compat con el borrador viejo (guardaba solo los campos de `data`, sin
    // envoltorio ni `step`) — se asume Paso 1 (Precio), que es adonde
    // apuntaba el único punto de guardado que existía antes de este cambio.
    if (parsed && typeof parsed === "object" && "data" in parsed && "step" in parsed) {
      return parsed as PublishDraft;
    }
    return { step: 1, data: parsed as Record<string, unknown> };
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

// Distingue "me fui a loguear con Google (redirect completo, se pierde todo
// el estado en memoria) para seguir publicando" de "volví a /publish días
// después y quedó un borrador viejo por ahí": solo en el primer caso el Paso
// 1 debe recuperarse solo y avanzar al Precio sin preguntar — en el segundo,
// sigue teniendo sentido ofrecer el modal de "¿recuperar o empezar de
// nuevo?". Vive en sessionStorage (no localStorage) porque es una señal de
// un solo viaje de ida y vuelta, no algo que deba sobrevivir a cerrar la
// pestaña.
const AUTO_RESUME_KEY = "buelazo_publish_auto_resume";

export function markPendingAutoResume() {
  try {
    sessionStorage.setItem(AUTO_RESUME_KEY, "1");
  } catch {
    // no-op
  }
}

export function consumePendingAutoResume(): boolean {
  try {
    const pending = sessionStorage.getItem(AUTO_RESUME_KEY) === "1";
    sessionStorage.removeItem(AUTO_RESUME_KEY);
    return pending;
  } catch {
    return false;
  }
}

// Lee la señal SIN borrarla — a diferencia de consumePendingAutoResume(), que
// se usaba en el mount y asumía que cualquier recarga después de "Continuar"
// significaba "Google devolvió con sesión". Eso era falso si el usuario
// cerró el modal de login o recargó sin loguearse: igual se consumía la
// señal y se aplicaba el borrador en silencio, sin preguntar y sin haber
// sesión real. Ahora se espera a que la sesión termine de resolverse
// (ver el efecto en publish.tsx que usa esto junto con isLoading) antes de
// decidir — recién ahí se consume, con consumePendingAutoResume().
export function peekPendingAutoResume(): boolean {
  try {
    return sessionStorage.getItem(AUTO_RESUME_KEY) === "1";
  } catch {
    return false;
  }
}
