import type {
  Asiento,
  AsientoCategoria,
  Flight,
  FlightSegment,
  FlightStatus,
  Transaction,
  TramoAVender,
  TipoDocumento,
} from "./mock-data";

const HOUR = 3600_000;
export const LAST_CALL_WINDOW_H = 24;
export const MIN_VIABLE_H = 3; // hard floor: below this, endoso operativo no es viable

export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / HOUR;
}

// El tramo que efectivamente se está transfiriendo en esta oferta. Cuando se vende
// "ambos", el tramo de ida es el que primero necesita endoso, así que gobierna la vigencia.
export function tramoVigente(f: Flight): FlightSegment {
  return f.tramoAVender === "regreso" && f.tramoRegreso ? f.tramoRegreso : f.tramoIda;
}

// El asiento del tramo vigente (ver tramoVigente). Cae a "aleatorio" si por alguna
// razón el tramo vigente no tiene asiento registrado (no debería pasar en datos válidos).
export function asientoVigente(f: Flight): Asiento {
  const a = f.tramoAVender === "regreso" ? f.asientoRegreso : f.asientoIda;
  return a ?? { tipo: "aleatorio", categoria: null, numero: null };
}

export function tramoAVenderLabel(t: TramoAVender): string {
  switch (t) {
    case "ida":
      return "Solo ida";
    case "regreso":
      return "Solo regreso";
    case "ambos":
      return "Ida y vuelta";
  }
}

export const ASIENTO_CATEGORIA_LABEL: Record<AsientoCategoria, string> = {
  ventana: "Ventana",
  medio: "Medio",
  pasillo: "Pasillo",
};

export const ASIENTO_ALEATORIO_MENSAJE =
  "Asiento asignado por la aerolínea al momento del embarque — no se puede garantizar ubicación.";

export function asientoLabel(a: Asiento): string {
  if (a.tipo === "aleatorio" || !a.categoria) return "Asignación aleatoria";
  return a.numero
    ? `${ASIENTO_CATEGORIA_LABEL[a.categoria]} · ${a.numero}`
    : ASIENTO_CATEGORIA_LABEL[a.categoria];
}

export function computeStatus(f: Flight): FlightStatus {
  const h = hoursUntil(tramoVigente(f).departureAt);
  if (h <= 0) return "expired";
  if (h < MIN_VIABLE_H) return "expired"; // no viable, aunque el vendedor quiera
  if (h < LAST_CALL_WINDOW_H) return f.sellerAllowsLastCall ? "last_call" : "expired";
  return "active";
}

export function isVisibleAnywhere(f: Flight): boolean {
  const s = computeStatus(f);
  return s === "active" || s === "last_call";
}

export function activeFlights(list: Flight[]): Flight[] {
  return list.filter((f) => computeStatus(f) === "active");
}

export function lastCallFlights(list: Flight[]): Flight[] {
  return list.filter((f) => computeStatus(f) === "last_call");
}

export const PLATFORM_COMMISSION_RATE = 0.05;

export function comisionPlataforma(monto: number): number {
  return Math.round(monto * PLATFORM_COMMISSION_RATE);
}

// Lo que el comprador paga de verdad hoy (precio de reventa + comisión) — el
// número que debe protagonizar cualquier tarjeta o pantalla de precio, nunca
// el precio de reventa solo.
export function totalAPagar(f: Flight): number {
  return f.resalePrice + comisionPlataforma(f.resalePrice);
}

export function discountPct(f: Flight): number {
  return Math.round((1 - totalAPagar(f) / f.originalPrice) * 100);
}

// Neto ESTIMADO al publicar (Paso 4): usa el estimado privado y no verificado del vendedor,
// si lo ingresó — nunca requiere evidencia, nunca lo ve el comprador.
export function montoNetoEstimado(f: Flight): number {
  const cargoEstimado = f.cargoAerolineaEstimado.monto ?? 0;
  return f.resalePrice - cargoEstimado - comisionPlataforma(f.resalePrice);
}

// Regla Ley N° 32325: el cargo CONFIRMADO solo entra al cálculo del neto final
// una vez que la revisión lo marcó "aceptado" — mientras esté pendiente o rechazado, es S/ 0.
export function cargoAerolineaConfirmadoVigente(t: Transaction): number {
  return t.cargoAerolineaConfirmado.estadoVerificacion === "aceptado"
    ? t.cargoAerolineaConfirmado.monto
    : 0;
}

// Un cargo confirmado que supere este umbral del precio de venta nunca se acepta
// automáticamente, aunque tenga evidencia — puede ser un error de tipeo o evidencia
// manipulada (las aerolíneas suelen cobrar ~S/15-60). Requiere revisión manual explícita.
export const REVISION_MANUAL_UMBRAL = 0.5;

export function requiereRevisionManual(monto: number, precioVenta: number): boolean {
  return monto > precioVenta * REVISION_MANUAL_UMBRAL;
}

// El neto del vendedor nunca puede quedar negativo. Primero se descuenta el cargo de
// aerolínea del precio de venta; la comisión de Buelazo se cobra normalmente si todavía
// queda margen, pero se reduce (o se renuncia por completo) hasta el punto necesario para
// mantener el piso en S/0 — la plataforma nunca gana una comisión que deje al vendedor en
// negativo, pero tampoco "regresa" dinero de su bolsillo más allá de eso.
export function comisionEfectiva(precioVenta: number, cargoConfirmado: number): number {
  const comisionNormal = comisionPlataforma(precioVenta);
  return Math.min(comisionNormal, Math.max(0, precioVenta - cargoConfirmado));
}

// Neto FINAL a liberar del escrow (Paso 5): usa el cargo confirmado y verificado durante
// el trámite real, no el estimado que el vendedor puso al publicar.
export function montoNetoFinal(t: Transaction): number {
  const cargo = cargoAerolineaConfirmadoVigente(t);
  return Math.max(0, t.amount - cargo - comisionEfectiva(t.amount, cargo));
}

// Decisión de negocio: el cargo de aerolínea (cuando aplica) lo absorbe el vendedor de su
// neto — no se le suma aparte al comprador. Constante fácil de cambiar si eso cambia; hoy
// el checkout del comprador ni siquiera muestra una línea de cargo (ver Paso 6).
export const cargoAerolineaLoAsumeVendedor = true;

const soles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 0,
});
// Intl inserta un espacio de ancho normal (U+00A0) entre "S/" y el monto — en las
// fuentes monoespaciadas grandes de precios (font-mono, text-2xl+) eso se renderiza
// tan ancho como un dígito, separando el prefijo del monto de forma exagerada. Un
// espacio fino (U+2009) mantiene la legibilidad sin ese salto visual.
export const S = (n: number) => soles.format(n).replace("PEN", "S/").replace(" ", " ");

const dtf = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export const fmtDate = (iso: string) => dtf.format(new Date(iso));

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(new Date(iso));
export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// DNI y Carné de Extranjería peruanos son siempre numéricos — pero un pasaporte
// no lo es: la mayoría de países emite pasaportes alfanuméricos (ej. Brasil
// "AB123456"), así que restringir a solo dígitos ahí bloquearía a extranjeros
// reales. Solo DNI/CE se filtran a dígitos; pasaporte permite letras y números.
export function sanitizeNumeroDocumento(tipo: TipoDocumento, value: string): string {
  if (tipo === "Pasaporte") {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  return value.replace(/\D/g, "");
}

// DNI peruano: siempre 8 dígitos exactos. Carné de Extranjería: formato numérico
// más largo (hasta 9). Pasaporte: sin estándar internacional fijo — dejamos un
// tope generoso (12) en vez de una longitud exacta, ya que varía mucho por país.
export const DOCUMENTO_MAX_LEN: Record<TipoDocumento, number> = {
  DNI: 8,
  "Carné de Extranjería": 9,
  Pasaporte: 12,
};

// Catálogo genérico por aerolínea — no está integrado a ninguna API real de
// aerolínea, es solo lo que el vendedor selecciona como dato informativo al
// publicar (ver publish.tsx). Nombres basados en las tarifas típicas que cada
// aerolínea ofrece hoy en sus propios canales de venta.
export const FARE_TYPES: Record<Flight["airline"], string[]> = {
  LATAM: ["Basic", "Light", "Full", "Premium Economy"],
  "Sky Airline": ["Basic", "Light", "Standard", "Max", "Max Flex"],
  JetSmart: ["Ligero", "Smart", "Full"],
};

// Cada opción visible mapea a uno de los 3 valores canónicos de Flight["baggage"]
// (el mismo dato que ya usan los filtros y el chat) — solo cambia la etiqueta
// que ve el vendedor según cómo su aerolínea llama a esa franquicia.
export const BAGGAGE_OPTIONS: Record<
  Flight["airline"],
  { value: Flight["baggage"]; label: string }[]
> = {
  LATAM: [
    { value: "solo cabina", label: "Solo cabina" },
    { value: "cabina + 23kg", label: "Cabina + 23kg" },
  ],
  "Sky Airline": [
    { value: "solo cabina", label: "Solo cabina" },
    { value: "23kg incluido", label: "23kg incluido" },
  ],
  JetSmart: [
    { value: "solo cabina", label: "Bolso o mochila (solo cabina)" },
    { value: "23kg incluido", label: "Equipaje en bodega (23kg)" },
  ],
};

export function airlineLogo(a: Flight["airline"]): string {
  switch (a) {
    case "LATAM":
      return "https://upload.wikimedia.org/wikipedia/commons/f/fe/Latam-logo_-v_%28Indigo%29.svg";
    case "Sky Airline":
      return "https://upload.wikimedia.org/wikipedia/commons/6/65/Sky_Airline_Logo.svg";
    case "JetSmart":
      return "https://upload.wikimedia.org/wikipedia/commons/f/fb/Logo_JetSmart.svg";
  }
}
