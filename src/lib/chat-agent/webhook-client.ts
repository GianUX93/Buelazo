import type { Airport, AsientoCategoria, Flight } from "@/lib/mock-data";
import { airportsList, cargoAerolineaEstimadoDefault } from "@/lib/mock-data";
import type { RawWebhookFlight } from "./types";

// URL de producción de n8n: requiere el workflow activo ("Active" en el
// editor) para responder de forma permanente, sin re-ejecutar manualmente.
const WEBHOOK_URL = "https://gianca93.app.n8n.cloud/webhook/Gianca";

export interface WebhookRequestBody {
  message: string;
  // Fijo por conversación (se genera al abrir el panel, no en cada mensaje) —
  // el nodo de memoria de n8n lo usa como Session Key para que el AI Agent
  // recuerde el contexto entre mensajes de un mismo chat. El backend ya
  // mantiene el estado de la conversación por su cuenta: el cliente no
  // reenvía filtros propios en cada turno.
  sessionId: string;
  // El mismo id de Supabase Auth (auth.users.id / flights.seller_id) que usa
  // la búsqueda manual para excluir las publicaciones propias del usuario
  // logueado (ver `explore.tsx`: fetchedFlights.filter(f => f.seller.id !==
  // user?.id)). null si no hay sesión — nunca se omite el campo.
  currentUserId: string | null;
}

export interface WebhookResponseBody {
  reply: string;
  flights?: Flight[];
  explanations?: Record<string, string>;
  alertConfirm?: { from: string; to: string };
}

const CITY_TO_AIRPORT: Record<string, Airport> = Object.fromEntries(
  airportsList.map((a) => [a.city, a]),
);

function airportFromCity(city: string): Airport {
  return CITY_TO_AIRPORT[city] ?? { code: "???", city, region: "" };
}

// Vendedor placeholder — se usa únicamente cuando el webhook no manda datos
// reales de seller (el contrato documentado hoy no los incluye). No inventa
// una reputación positiva ni una identidad verificada: deja explícito que el
// dato no vino del backend.
function placeholderSeller(id: string) {
  return {
    id,
    name: "Vendedor verificado",
    avatar: "V",
    avatarUrl: "",
    verifiedId: false,
    memberSince: "",
  };
}

// Adapta el shape plano y mínimo que manda el webhook de n8n al `Flight`
// completo que espera `FlightCard`. Nunca copia campos desconocidos del
// webhook tal cual (regla de negocio: el buyer no debe ver airline_fee_estimate
// ni otros campos internos) — solo lee, campo por campo, lo que el contrato
// documenta y lo que `FlightCard` efectivamente muestra.
function adaptFlight(raw: RawWebhookFlight, index: number): Flight | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    !raw.airline ||
    !raw.origin_city ||
    !raw.destination_city ||
    !raw.departure_date
  ) {
    return null;
  }

  // El webhook no manda id propio hoy: se sintetiza uno estable a partir de
  // los datos del vuelo para que la key de React no cambie entre renders. No
  // sirve como id real de Supabase — por eso el link a /flight/$id de este
  // vuelo puede no resolver hasta que n8n incluya el id real.
  const id =
    raw.id ?? `wh-${index}-${raw.origin_city}-${raw.destination_city}-${raw.departure_date}`;

  const tramoIda = {
    origin: airportFromCity(raw.origin_city),
    destination: airportFromCity(raw.destination_city),
    departureAt: raw.departure_date,
    durationMin: 0,
  };

  const tramoRegreso =
    raw.ticket_type === "ida_y_vuelta" && raw.return_date
      ? {
          origin: airportFromCity(raw.destination_city),
          destination: airportFromCity(raw.origin_city),
          departureAt: raw.return_date,
          durationMin: 0,
        }
      : null;

  const toAsiento = (s: RawWebhookFlight["seat_outbound"]): Flight["asientoIda"] => {
    if (!s) return null;
    const categoria: AsientoCategoria | null =
      s.estado === "ventana" || s.estado === "medio" || s.estado === "pasillo" ? s.estado : null;
    return { tipo: s.tipo, categoria, numero: null };
  };

  return {
    id,
    tipoBoleto: raw.ticket_type,
    tramoIda,
    tramoRegreso,
    tramoAVender: raw.sell_segment,
    airline: raw.airline as Flight["airline"],
    flightNumber: "",
    originalPrice: raw.original_price,
    resalePrice: raw.resale_price,
    baggage: "solo cabina",
    asientoIda: toAsiento(raw.seat_outbound),
    asientoRegreso: toAsiento(raw.seat_return),
    seller: raw.seller?.id
      ? {
          id: raw.seller.id,
          name: raw.seller.name ?? "Vendedor verificado",
          avatar: raw.seller.avatar ?? (raw.seller.name?.[0] ?? "V").toUpperCase(),
          avatarUrl: raw.seller.avatarUrl ?? "",
          verifiedId: raw.seller.verifiedId ?? false,
          memberSince: "",
        }
      : placeholderSeller(id),
    sellerAllowsLastCall: raw.status === "last_call",
    createdAt: new Date().toISOString(),
    views: 0,
    interested: 0,
    savedCount: 0,
    datosPasajero: {
      nombres: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      email: "",
      telefono: "",
    },
    cargoAerolineaEstimado: cargoAerolineaEstimadoDefault(),
  };
}

export async function askAgent(body: WebhookRequestBody): Promise<WebhookResponseBody> {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Webhook respondió ${res.status}`);
  }

  const raw = (await res.json()) as unknown;

  // Contrato real: todo viene anidado bajo `output` (lo envuelve el Structured
  // Output Parser de n8n). Degradación explícita si esa clave no viene, o si
  // llega en el shape viejo por compatibilidad hacia atrás.
  const container =
    raw && typeof raw === "object" && "output" in raw ? (raw as { output: unknown }).output : raw;

  if (!container || typeof container !== "object") {
    return { reply: "" };
  }

  const data = container as { reply?: unknown; flights?: unknown; alertConfirm?: unknown };

  const reply = typeof data.reply === "string" ? data.reply : "";

  // Filtro de seguridad del lado del cliente: aunque ya se le pide a n8n que
  // excluya las publicaciones propias por `currentUserId`, el agente puede
  // fallar en aplicarlo (falla de prompt, cambios futuros, etc.) — nunca hay
  // que confiar solo en que el LLM respete esta regla de negocio. Mismo
  // criterio que ya usa la búsqueda manual (explore.tsx).
  const flights = Array.isArray(data.flights)
    ? data.flights
        .map((f, i) => adaptFlight(f as RawWebhookFlight, i))
        .filter((f): f is Flight => f !== null)
        .filter((f) => !body.currentUserId || f.seller.id !== body.currentUserId)
    : undefined;

  const alertConfirm =
    data.alertConfirm &&
    typeof data.alertConfirm === "object" &&
    typeof (data.alertConfirm as Record<string, unknown>).from === "string" &&
    typeof (data.alertConfirm as Record<string, unknown>).to === "string"
      ? (data.alertConfirm as { from: string; to: string })
      : undefined;

  return { reply, flights, alertConfirm };
}
