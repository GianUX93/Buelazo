// Mock inventory for the Buelazo prototype.
// Status is computed relative to the departure of the tramo actually being sold
// (see `tramoVigente` in flight-utils) and the persisted business flag `sellerAllowsLastCall`.
// - active: > 24h to departure and endoso is viable
// - last_call: < 24h but seller opted to keep it available (separate lane)
// - expired: departure passed OR sellerAllowsLastCall=false and <24h

export type FlightStatus = "active" | "last_call" | "expired";

export interface Airport {
  code: string;
  city: string;
  region: string;
}

// Un tramo (ida o regreso) tal como lo carga el vendedor al publicar.
export interface FlightSegment {
  origin: Airport;
  destination: Airport;
  departureAt: string; // ISO — fecha + hora de salida
  durationMin: number;
}

export type TipoBoleto = "solo_ida" | "ida_y_vuelta";
// Una sola oferta, un solo comprador: qué tramo(s) incluye esta publicación específica.
export type TramoAVender = "ida" | "regreso" | "ambos";

export interface DatosPasajero {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  telefono: string;
}

// En tarifas de asiento aleatorio, la aerolínea recién asigna el asiento en el boarding
// pass (~24h antes del vuelo) — el mismo momento en que se cierra la ventana legal del
// endoso. No hay ningún momento válido en el que este dato pueda "completarse después"
// mientras el pasaje siga siendo vendible, así que se resuelve por completo al publicar,
// sin ningún estado "pendiente".
export type AsientoTipo = "seleccionado" | "aleatorio";
export type AsientoCategoria = "ventana" | "medio" | "pasillo";

export interface Asiento {
  tipo: AsientoTipo;
  categoria: AsientoCategoria | null; // obligatorio si tipo="seleccionado", siempre null si "aleatorio"
  numero: string | null; // opcional, solo si tipo="seleccionado"
}

// Estimado privado del vendedor al publicar — nunca requiere evidencia, nunca lo ve
// el comprador, y solo alimenta el "neto estimado" que se muestra al publicar.
export interface CargoAerolineaEstimado {
  monto: number | null;
  ingresadoPorVendedor: boolean;
  verificado: false;
}

export const cargoAerolineaEstimadoDefault = (): CargoAerolineaEstimado => ({
  monto: null,
  ingresadoPorVendedor: false,
  verificado: false,
});

// Ley N° 32325 (may. 2025): el endoso de un pasaje nacional (hasta 24h antes del vuelo)
// es gratuito, incluida la emisión del nuevo boleto — línea base legal S/ 0 para las 3 aerolíneas.
// Este monto CONFIRMADO solo existe una vez que hay comprador y trámite en curso (ver
// Transaction.cargoAerolineaConfirmado): el vendedor puede reportar que le cobraron durante
// el trámite, pero el monto solo entra al cálculo del neto final una vez "aceptado" tras
// revisión — nunca mientras esté pendiente o rechazado.
export type CargoAerolineaOrigen = "default_legal" | "reportado_por_vendedor";
export type CargoAerolineaEstado = "no_aplica" | "pendiente_revision" | "aceptado" | "rechazado";

export interface CargoAerolineaConfirmado {
  monto: number;
  origen: CargoAerolineaOrigen;
  evidenciaUrl: string | null;
  estadoVerificacion: CargoAerolineaEstado;
  momentoDisponible: "confirmado_en_tramite";
  // true cuando el monto reportado superó el 50% del precio de venta al momento de
  // reportarlo — protección contra error de tipeo o evidencia manipulada. Un cargo así
  // nunca se acepta automáticamente aunque tenga evidencia adjunta; requiere que el panel
  // de revisión lo apruebe explícitamente.
  revisionManualRequerida: boolean;
}

export const cargoAerolineaConfirmadoDefault = (): CargoAerolineaConfirmado => ({
  monto: 0,
  origen: "default_legal",
  evidenciaUrl: null,
  estadoVerificacion: "no_aplica",
  momentoDisponible: "confirmado_en_tramite",
  revisionManualRequerida: false,
});

// Sin rating/reviews a propósito: la mayoría de vendedores usa la plataforma
// una sola vez (vendió el pasaje que ya no podía usar), así que un promedio
// de estrellas casi siempre tendría 0-1 reseñas — una señal de confianza que
// no aporta nada real y hasta resta (una estrella vacía en cada card sugiere
// "nadie ha probado a este vendedor" cuando el riesgo real ya está mitigado
// por otro lado: revisión manual + escrow + confirmación del comprador). La
// señal de confianza que sí importa es `verifiedId` (identidad verificada).
export interface Seller {
  id: string;
  name: string;
  avatar: string;
  avatarUrl: string;
  verifiedId: boolean;
  memberSince: string;
}

export interface Flight {
  id: string;
  tipoBoleto: TipoBoleto;
  tramoIda: FlightSegment;
  tramoRegreso: FlightSegment | null; // solo existe si tipoBoleto = "ida_y_vuelta"
  tramoAVender: TramoAVender;
  airline: "LATAM" | "Sky Airline" | "JetSmart";
  flightNumber: string;
  originalPrice: number; // soles
  resalePrice: number; // soles
  baggage: "solo cabina" | "23kg incluido" | "cabina + 23kg";
  // Tarifa específica de la aerolínea (ej. "Light", "Basic") — catálogo por
  // aerolínea en flight-utils.ts. Opcional: los vuelos mock anteriores a este
  // campo no lo tienen, y no es obligatorio mostrarlo si falta.
  fareType?: string;
  // El asiento se define por tramo — el vendedor puede tener sillas distintas en ida y vuelta.
  // null cuando ese tramo no forma parte de esta oferta (ej. tramoAVender = "regreso").
  asientoIda: Asiento | null;
  asientoRegreso: Asiento | null;
  seller: Seller;
  sellerAllowsLastCall: boolean; // when <24h, whether it enters last_call lane
  createdAt: string;
  views: number;
  interested: number;
  // Cuántas personas guardaron esta oferta (corazón) — señal de intención más fuerte
  // que una vista, ya que implica "quiero volver a esto".
  savedCount: number;
  note?: string;
  // Presente solo cuando dbStatus === "rechazado" — el motivo que dejó el
  // revisor en /admin/revisiones al rechazar la publicación.
  rejectionReason?: string;
  rejectionDetail?: string;
  // Cuántas veces fue rechazada en total (incluye rechazos anteriores ya corregidos) —
  // al llegar a 2, ya no se puede editar y reenviar a revisión (ver dashboard.tsx).
  rejectionCount?: number;
  datosPasajero: DatosPasajero;
  cargoAerolineaEstimado: CargoAerolineaEstimado;
}

export const airports: Record<string, Airport> = {
  LIM: { code: "LIM", city: "Lima", region: "Callao" },
  CUZ: { code: "CUZ", city: "Cusco", region: "Cusco" },
  AQP: { code: "AQP", city: "Arequipa", region: "Arequipa" },
  PIU: { code: "PIU", city: "Piura", region: "Piura" },
  IQT: { code: "IQT", city: "Iquitos", region: "Loreto" },
  TRU: { code: "TRU", city: "Trujillo", region: "La Libertad" },
  TPP: { code: "TPP", city: "Tarapoto", region: "San Martín" },
  CIX: { code: "CIX", city: "Chiclayo", region: "Lambayeque" },
};

const sellers: Seller[] = [
  {
    id: "s1",
    name: "Camila R.",
    avatar: "CR",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    verifiedId: true,
    memberSince: "2024",
  },
  {
    id: "s2",
    name: "Diego M.",
    avatar: "DM",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
    verifiedId: true,
    memberSince: "2025",
  },
  {
    id: "s3",
    name: "Valeria P.",
    avatar: "VP",
    avatarUrl: "https://i.pravatar.cc/150?img=25",
    verifiedId: true,
    memberSince: "2023",
  },
  {
    id: "s4",
    name: "Rodrigo A.",
    avatar: "RA",
    avatarUrl: "https://i.pravatar.cc/150?img=33",
    verifiedId: false,
    memberSince: "2025",
  },
  {
    id: "s5",
    name: "Lucía Q.",
    avatar: "LQ",
    avatarUrl: "https://i.pravatar.cc/150?img=44",
    verifiedId: true,
    memberSince: "2022",
  },
  // El mismo currentUser ("Andrea Salazar", u-me) como vendedora — necesario para poder
  // demostrar pasajes publicados por el usuario actual que todavía no tienen comprador.
  {
    id: "u-me",
    name: "Andrea Salazar",
    avatar: "AS",
    avatarUrl: "https://i.pravatar.cc/150?img=5",
    verifiedId: true,
    memberSince: "2024",
  },
];

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

// Datos del titular actual del boleto (no el futuro comprador) — necesarios para el
// trámite real de endoso con la aerolínea más adelante.
const pasajeros: Record<string, DatosPasajero> = {
  camila: {
    nombres: "Camila",
    apellidoPaterno: "Ramírez",
    apellidoMaterno: "Torres",
    email: "camila.ramirez@correo.pe",
    telefono: "+51 987 654 321",
  },
  diego: {
    nombres: "Diego",
    apellidoPaterno: "Medina",
    apellidoMaterno: "Flores",
    email: "diego.medina@correo.pe",
    telefono: "+51 976 543 210",
  },
  valeria: {
    nombres: "Valeria",
    apellidoPaterno: "Paredes",
    apellidoMaterno: "Rojas",
    email: "valeria.paredes@correo.pe",
    telefono: "+51 965 432 109",
  },
  rodrigo: {
    nombres: "Rodrigo",
    apellidoPaterno: "Alvarado",
    apellidoMaterno: "Campos",
    email: "rodrigo.alvarado@correo.pe",
    telefono: "+51 954 321 098",
  },
  lucia: {
    nombres: "Lucía",
    apellidoPaterno: "Quispe",
    apellidoMaterno: "Vargas",
    email: "lucia.quispe@correo.pe",
    telefono: "+51 943 210 987",
  },
  andrea: {
    nombres: "Andrea",
    apellidoPaterno: "Salazar",
    apellidoMaterno: "Rojas",
    email: "andrea@correo.pe",
    telefono: "+51 932 109 876",
  },
};

export const flights: Flight[] = [
  {
    id: "f-001",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.CUZ,
      departureAt: hoursFromNow(72),
      durationMin: 85,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "LATAM",
    flightNumber: "LA 2043",
    originalPrice: 480,
    resalePrice: 219,
    baggage: "cabina + 23kg",
    asientoIda: { tipo: "seleccionado", categoria: "ventana", numero: "12A" },
    asientoRegreso: null,
    seller: sellers[0],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-8),
    views: 214,
    interested: 18,
    savedCount: 26,
    note: "Cambio de planes familiares. Endoso permitido sin costo por LATAM.",
    datosPasajero: pasajeros.camila,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-002",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.AQP,
      departureAt: hoursFromNow(48),
      durationMin: 100,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "Sky Airline",
    flightNumber: "H2 831",
    originalPrice: 310,
    resalePrice: 149,
    baggage: "solo cabina",
    asientoIda: { tipo: "seleccionado", categoria: "pasillo", numero: "18C" },
    asientoRegreso: null,
    seller: sellers[1],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-4),
    views: 98,
    interested: 9,
    savedCount: 14,
    datosPasajero: pasajeros.diego,
    cargoAerolineaEstimado: { monto: 25, ingresadoPorVendedor: true, verificado: false },
  },
  {
    id: "f-003",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.PIU,
      departureAt: hoursFromNow(120),
      durationMin: 105,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "JetSmart",
    flightNumber: "JA 411",
    originalPrice: 265,
    resalePrice: 129,
    baggage: "solo cabina",
    asientoIda: { tipo: "seleccionado", categoria: "ventana", numero: "07F" },
    asientoRegreso: null,
    seller: sellers[2],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-22),
    views: 341,
    interested: 24,
    savedCount: 33,
    datosPasajero: pasajeros.valeria,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-004",
    // Ida y vuelta, se vende como una sola oferta con ambos tramos.
    tipoBoleto: "ida_y_vuelta",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.IQT,
      departureAt: hoursFromNow(200),
      durationMin: 115,
    },
    tramoRegreso: {
      origin: airports.IQT,
      destination: airports.LIM,
      departureAt: hoursFromNow(272),
      durationMin: 115,
    },
    tramoAVender: "ambos",
    airline: "LATAM",
    flightNumber: "LA 2401",
    originalPrice: 520,
    resalePrice: 289,
    baggage: "23kg incluido",
    // Asiento distinto en cada tramo — el vendedor eligió filas diferentes para ida y vuelta.
    asientoIda: { tipo: "seleccionado", categoria: "medio", numero: "22B" },
    asientoRegreso: { tipo: "seleccionado", categoria: "ventana", numero: "14A" },
    seller: sellers[4],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-2),
    views: 66,
    interested: 4,
    savedCount: 9,
    datosPasajero: pasajeros.lucia,
    cargoAerolineaEstimado: { monto: 18, ingresadoPorVendedor: true, verificado: false },
  },
  {
    id: "f-005",
    // Ida y vuelta, pero esta oferta vende SOLO el tramo de regreso (el de ida ya voló).
    // Prueba clave: el countdown/estado se calcula sobre tramoRegreso, no sobre tramoIda.
    tipoBoleto: "ida_y_vuelta",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.CUZ,
      departureAt: hoursFromNow(-50),
      durationMin: 85,
    },
    tramoRegreso: {
      origin: airports.CUZ,
      destination: airports.LIM,
      departureAt: hoursFromNow(19),
      durationMin: 90,
    }, // last_call
    tramoAVender: "regreso",
    airline: "Sky Airline",
    flightNumber: "H2 214",
    originalPrice: 360,
    resalePrice: 139,
    baggage: "solo cabina",
    asientoIda: null,
    asientoRegreso: { tipo: "seleccionado", categoria: "pasillo", numero: "09D" },
    seller: sellers[0],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-3),
    views: 402,
    interested: 31,
    savedCount: 45,
    note: "Ya no puedo tomarlo. Endoso rápido, respondo en minutos.",
    datosPasajero: pasajeros.camila,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-006",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.TRU,
      departureAt: hoursFromNow(9),
      durationMin: 75,
    }, // last_call, close margin
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "JetSmart",
    flightNumber: "JA 502",
    originalPrice: 220,
    resalePrice: 79,
    baggage: "solo cabina",
    asientoIda: { tipo: "aleatorio", categoria: null, numero: null },
    asientoRegreso: null,
    seller: sellers[3],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-1),
    views: 89,
    interested: 6,
    savedCount: 12,
    datosPasajero: pasajeros.rodrigo,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-007",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.TPP,
      departureAt: hoursFromNow(-6),
      durationMin: 95,
    }, // expired (past)
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "LATAM",
    flightNumber: "LA 2311",
    originalPrice: 410,
    resalePrice: 179,
    baggage: "cabina + 23kg",
    asientoIda: { tipo: "seleccionado", categoria: "pasillo", numero: "05C" },
    asientoRegreso: null,
    seller: sellers[1],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-40),
    views: 512,
    interested: 22,
    savedCount: 28,
    datosPasajero: pasajeros.diego,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-008",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.CIX,
      departureAt: hoursFromNow(14),
      durationMin: 80,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "Sky Airline",
    flightNumber: "H2 640",
    originalPrice: 240,
    resalePrice: 99,
    baggage: "solo cabina",
    asientoIda: { tipo: "aleatorio", categoria: null, numero: null },
    asientoRegreso: null,
    seller: sellers[4],
    sellerAllowsLastCall: false, // <24h and seller withdrew → expired for the marketplace
    createdAt: hoursFromNow(-10),
    views: 61,
    interested: 2,
    savedCount: 5,
    datosPasajero: pasajeros.lucia,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-009",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.AQP,
      destination: airports.LIM,
      departureAt: hoursFromNow(96),
      durationMin: 95,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "LATAM",
    flightNumber: "LA 2088",
    originalPrice: 340,
    resalePrice: 169,
    baggage: "23kg incluido",
    asientoIda: { tipo: "seleccionado", categoria: "ventana", numero: "11F" },
    asientoRegreso: null,
    seller: sellers[2],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-14),
    views: 178,
    interested: 11,
    savedCount: 19,
    datosPasajero: pasajeros.valeria,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-010",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.CUZ,
      departureAt: hoursFromNow(240),
      durationMin: 85,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "JetSmart",
    flightNumber: "JA 220",
    originalPrice: 290,
    resalePrice: 155,
    baggage: "solo cabina",
    asientoIda: { tipo: "seleccionado", categoria: "ventana", numero: "20A" },
    asientoRegreso: null,
    seller: sellers[4],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-30),
    views: 89,
    interested: 5,
    savedCount: 10,
    datosPasajero: pasajeros.lucia,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  // Publicados por el propio currentUser (Andrea) y todavía sin comprador — demuestran
  // la pestaña "Publicados" de Mis operaciones (vistas/interesados de una oferta viva,
  // no de una transacción en curso).
  {
    id: "f-011",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.AQP,
      departureAt: hoursFromNow(168),
      durationMin: 100,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "LATAM",
    flightNumber: "LA 2150",
    originalPrice: 310,
    resalePrice: 165,
    baggage: "23kg incluido",
    asientoIda: { tipo: "seleccionado", categoria: "ventana", numero: "16A" },
    asientoRegreso: null,
    seller: sellers[5],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-48),
    views: 132,
    interested: 7,
    savedCount: 15,
    datosPasajero: pasajeros.andrea,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-012",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.TRU,
      departureAt: hoursFromNow(60),
      durationMin: 75,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "Sky Airline",
    flightNumber: "H2 305",
    originalPrice: 210,
    resalePrice: 99,
    baggage: "solo cabina",
    asientoIda: { tipo: "aleatorio", categoria: null, numero: null },
    asientoRegreso: null,
    seller: sellers[5],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-3),
    views: 6,
    interested: 0,
    savedCount: 2,
    datosPasajero: pasajeros.andrea,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-013",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.CUZ,
      departureAt: hoursFromNow(36),
      durationMin: 85,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "Sky Airline",
    flightNumber: "H2 412",
    originalPrice: 260,
    resalePrice: 129,
    baggage: "23kg incluido",
    asientoIda: { tipo: "aleatorio", categoria: null, numero: null },
    asientoRegreso: null,
    seller: sellers[1],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-10),
    views: 41,
    interested: 3,
    savedCount: 6,
    datosPasajero: pasajeros.andrea,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-014",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.PIU,
      departureAt: hoursFromNow(60),
      durationMin: 90,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "LATAM",
    flightNumber: "LA 2038",
    originalPrice: 290,
    resalePrice: 155,
    baggage: "23kg incluido",
    asientoIda: { tipo: "seleccionado", categoria: "pasillo", numero: "10C" },
    asientoRegreso: null,
    seller: sellers[3],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-20),
    views: 28,
    interested: 2,
    savedCount: 4,
    datosPasajero: pasajeros.andrea,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
  {
    id: "f-015",
    tipoBoleto: "solo_ida",
    tramoIda: {
      origin: airports.LIM,
      destination: airports.CUZ,
      departureAt: hoursFromNow(180),
      durationMin: 85,
    },
    tramoRegreso: null,
    tramoAVender: "ida",
    airline: "JetSmart",
    flightNumber: "JA 771",
    originalPrice: 220,
    resalePrice: 98,
    baggage: "solo cabina",
    asientoIda: { tipo: "aleatorio", categoria: null, numero: null },
    asientoRegreso: null,
    seller: sellers[2],
    sellerAllowsLastCall: true,
    createdAt: hoursFromNow(-5),
    views: 14,
    interested: 1,
    savedCount: 1,
    datosPasajero: pasajeros.andrea,
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  },
];

export const airportsList = Object.values(airports);
export const airlines = ["LATAM", "Sky Airline", "JetSmart"] as const;

// Chat interno ligado a una transacción específica — nunca WhatsApp ni el teléfono real de
// nadie. Es el único canal de coordinación entre comprador y vendedor, y queda con historial
// revisable por la plataforma si alguna de las partes reporta un problema.
//
// `adjunto`: algunas aerolíneas piden, además de los datos estructurados de endoso, una foto
// del documento de identidad — no encaja como campo fijo del formulario (no todas la piden),
// así que el vendedor la solicita puntualmente por chat y el comprador la adjunta aquí. Sigue
// visible solo para el vendedor de esta transacción, igual que el resto de sus datos de endoso.
export interface ChatMensaje {
  autor: "comprador" | "vendedor";
  texto: string;
  timestamp: string; // ISO
  adjunto?: { nombre: string; url: string };
}

// Los datos estructurados de endoso nunca se piden por chat de texto libre — el vendedor los
// necesita para el trámite (la aerolínea exige identificar al nuevo titular), así que van en
// un formulario propio, visible solo para el vendedor de esta transacción específica. Una foto
// del documento sí puede solicitarse por chat cuando la aerolínea la exige (ver `ChatMensaje`).
export type TipoDocumento = "DNI" | "Pasaporte" | "Carné de Extranjería";

export interface DatosCompradorEndoso {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  completadoPorComprador: boolean;
}

export const datosCompradorEndosoDefault = (): DatosCompradorEndoso => ({
  nombres: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  tipoDocumento: "DNI",
  numeroDocumento: "",
  completadoPorComprador: false,
});

export interface ReporteProblema {
  motivo: string;
  detalle: string;
  createdAt: string;
}

// Mock user transactions
export interface Transaction {
  id: string;
  flightId: string;
  role: "buyer" | "seller";
  state:
    "pago_retenido" | "vendedor_inicia" | "confirmado" | "liberado" | "reembolsado" | "en_disputa";
  amount: number;
  createdAt: string;
  // Solo existe una vez que hay comprador — el "trámite en curso" de esta transacción
  // específica es lo que determina el neto final que se libera del escrow.
  cargoAerolineaConfirmado: CargoAerolineaConfirmado;
  chatMensajes: ChatMensaje[];
  datosCompradorEndoso: DatosCompradorEndoso;
  // Estado previo al reportar un problema — permite congelar el timeline en el paso
  // correcto mientras la transacción está en disputa, y no perderlo si se resuelve.
  estadoAnteriorDisputa?: Transaction["state"];
  reporte?: ReporteProblema;
  // Presente solo en transacciones reales de Supabase — chat, disputas y la
  // verificación detallada del cargo de aerolínea todavía no están conectados
  // para estas, así que la UI las oculta cuando isReal es true.
  isReal?: boolean;
  flight?: Flight | null;
  // Gate de confianza: el vendedor no puede liberar el pago retenido hasta que
  // el comprador confirme que revisó el pasaje/evidencia y está todo bien.
  // Solo aplica a transacciones reales — las mock no tienen esta columna, así
  // que se tratan como ya confirmadas para no romper la demo existente.
  buyerConfirmedOk?: boolean;
}

export const transactions: Transaction[] = [];

export const currentUser = {
  id: "u-me",
  name: "Andrea Salazar",
  handle: "@andreasal",
  avatar: "AS",
  avatarUrl: "https://i.pravatar.cc/150?img=5",
  verifiedId: true,
  memberSince: "2024",
  dni: "•••••4821",
  phone: "+51 9•• ••1 342",
  email: "andrea@•••.pe",
};

export const testimonials = [
  {
    name: "Miguel A.",
    avatarUrl: "https://i.pravatar.cc/150?img=14",
    role: "Compró Lima → Cusco",
    quote:
      "Encontré un pasaje a Cusco por S/ 149 con 8 horas de anticipación. El pago quedó retenido hasta que la aerolínea me pasó el ticket a mi nombre. Cero fricción.",
  },
  {
    name: "Renata V.",
    avatarUrl: "https://i.pravatar.cc/150?img=29",
    role: "Vendió Lima → Piura",
    quote:
      "Recuperé el 70% de un pasaje que iba a perder. Todo el trámite con LATAM se manejó desde la app.",
  },
  {
    name: "Joaquín F.",
    avatarUrl: "https://i.pravatar.cc/150?img=51",
    role: "Compró Cusco → Lima",
    quote:
      "La sección de última llamada es honesta: te avisa cuánto tiempo real queda para completar el endoso. Nunca sentí que me apuraran a pagar.",
  },
  {
    name: "Valentina R.",
    avatarUrl: "https://i.pravatar.cc/150?img=32",
    role: "Creó una alerta de ruta",
    quote:
      "No había nada para Arequipa esa semana, así que dejé una alerta. Al día siguiente me llegó la notificación apenas alguien publicó — lo compré antes que nadie.",
  },
  {
    name: "Braulio S.",
    avatarUrl: "https://i.pravatar.cc/150?img=60",
    role: "Compró Lima → Tarapoto",
    quote:
      "Nunca tuve que dar mi número a nadie. Todo el intercambio con el vendedor fue por el chat interno, incluso cuando la aerolínea pidió una foto de mi DNI.",
  },
  {
    name: "Camila T.",
    avatarUrl: "https://i.pravatar.cc/150?img=45",
    role: "Compró con asiento confirmado",
    quote:
      "Filtré solo por asientos de ventana ya confirmados. Llegué al aeropuerto y era exactamente el asiento que decía la publicación.",
  },
  {
    name: "Diego M.",
    avatarUrl: "https://i.pravatar.cc/150?img=33",
    role: "Guardó vuelos antes de decidir",
    quote:
      "Fui guardando tres opciones distintas durante dos días para comparar precios con calma, sin perderlas de vista entre tanta pestaña abierta.",
  },
  {
    name: "Fiorella N.",
    avatarUrl: "https://i.pravatar.cc/150?img=25",
    role: "Compró con endoso verificado",
    quote:
      "Lo que más me tranquilizó fue ver que el vendedor tenía la identidad verificada antes de pagar. Se nota que revisan las publicaciones.",
  },
  {
    name: "Ismael Ch.",
    avatarUrl: "https://i.pravatar.cc/150?img=52",
    role: "Compró Tarapoto → Lima",
    quote:
      "El dinero quedó retenido hasta que confirmé que el boleto llegó a mi nombre. Si algo salía mal, no perdía mi plata — esa garantía vale más que el descuento.",
  },
  {
    name: "Lucía Q.",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    role: "Vendió su pasaje en minutos",
    quote:
      "Subí mi comprobante de reserva y en menos de cinco minutos ya estaba publicado. No esperaba que fuera tan directo.",
  },
];
