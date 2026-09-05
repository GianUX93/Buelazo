import type { Flight } from "@/lib/mock-data";

// Shape real que devuelve el webhook de n8n por cada vuelo — plano, tal como
// sale de la tool de Supabase dentro del AI Agent, NO el shape completo de
// `Flight` que usa el resto de la app. `id` y `seller` son opcionales porque
// el contrato documentado hoy no los incluye; si n8n los agrega más adelante
// se usan tal cual en vez del fallback.
export interface RawWebhookFlight {
  id?: string;
  airline: string;
  origin_city: string;
  destination_city: string;
  departure_date: string;
  return_date: string | null;
  ticket_type: "solo_ida" | "ida_y_vuelta";
  sell_segment: "ida" | "regreso" | "ambos";
  seat_outbound: { tipo: "seleccionado" | "aleatorio"; estado: string | null } | null;
  seat_return: { tipo: "seleccionado" | "aleatorio"; estado: string | null } | null;
  original_price: number;
  resale_price: number;
  status: "active" | "last_call" | "expired";
  seller?: {
    id?: string;
    name?: string;
    avatar?: string;
    avatarUrl?: string;
    verifiedId?: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text?: string;
  flights?: Flight[];
  explanations?: Record<string, string>;
  alertConfirm?: { from: string; to: string };
  timestamp: string;
}
