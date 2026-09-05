import { Link } from "@tanstack/react-router";
import { ShieldCheck, Plane, Heart } from "lucide-react";
import type { Flight } from "@/lib/mock-data";
import {
  computeStatus,
  discountPct,
  fmtDay,
  fmtTime,
  S,
  airlineLogo,
  tramoVigente,
  tramoAVenderLabel,
  asientoVigente,
  totalAPagar,
} from "@/lib/flight-utils";
import { Countdown } from "./Countdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSaved } from "@/lib/saved-context";

/**
 * FlightCard. Renderiza SOLO ofertas active o last_call.
 * Devuelve null si el vuelo es expired (guarda de seguridad — nunca debe llegar aquí).
 */
export function FlightCard({
  flight,
  variant = "active",
  isOwnListing = false,
  // Marca de dónde se navega al detalle — hoy solo "agente" (card mostrada
  // dentro del chat de lucIA), para que el detalle sepa mostrar "Volver al
  // chat" en vez del "Volver a resultados" genérico.
  linkFrom,
}: {
  flight: Flight;
  variant?: "active" | "last_call";
  isOwnListing?: boolean;
  linkFrom?: "agente";
}) {
  const { isSaved, toggleSaved } = useSaved();
  const status = computeStatus(flight);
  if (status === "expired") return null;
  // Enforce lane separation
  if (variant === "active" && status !== "active") return null;
  if (variant === "last_call" && status !== "last_call") return null;

  const isWarn = status === "last_call";
  const tramo = tramoVigente(flight);
  const asiento = asientoVigente(flight);
  const saved = isSaved(flight.id);

  return (
    <Link
      to="/flight/$id"
      params={{ id: flight.id }}
      search={linkFrom ? { from: linkFrom } : undefined}
      className={`group tarjeta-boleto relative block self-start ${
        isWarn
          ? "border-[color-mix(in_srgb,var(--color-warning-token)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning-token)_5%,#FFFFFF)]"
          : ""
      }`}
    >
      {isWarn && (
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--color-warning-token)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warning-token)_15%,transparent)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-warning-token)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-warning-token)]"></span>
            </span>{" "}
            Última llamada
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <div className="font-mono text-[10px] animate-pulse-last-call">
              <Countdown iso={tramo.departureAt} tone="warn" />
            </div>
            <SaveHeartButton saved={saved} onToggle={() => toggleSaved(flight.id)} />
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex min-h-6 items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <img
            src={airlineLogo(flight.airline)}
            alt={flight.airline}
            className="h-3.5 w-auto max-w-[64px] shrink-0 object-contain"
          />
          <div className="ml-auto flex items-center gap-2">
            {isOwnListing ? (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-gray-500">
                Tu publicación
              </span>
            ) : (
              <>
                {asiento.tipo === "seleccionado" && asiento.categoria === "ventana" && (
                  <span className="shrink-0 rounded-full bg-[var(--color-secondary-token)]/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[var(--color-secondary-token)]">
                    🪟 Ventana confirmada
                  </span>
                )}
                {asiento.tipo === "aleatorio" && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-gray-500">
                    Asiento aleatorio
                  </span>
                )}
              </>
            )}
            {!isWarn && !isOwnListing && (
              <SaveHeartButton saved={saved} onToggle={() => toggleSaved(flight.id)} />
            )}
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="font-display text-3xl leading-none font-bold text-[var(--color-ink)]">
            {tramo.origin.code}
          </span>
          <Plane className="h-4 w-4 shrink-0 text-[var(--color-primary-token)]" />
          <span className="font-display text-3xl leading-none font-bold text-[var(--color-ink)]">
            {tramo.destination.code}
          </span>
          {flight.tipoBoleto === "ida_y_vuelta" && (
            <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {tramoAVenderLabel(flight.tramoAVender)}
            </span>
          )}
        </div>
        <div className="mt-1.5 text-sm text-muted-foreground font-medium truncate">
          {tramo.origin.city} → {tramo.destination.city}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground">
          <span className="text-[var(--color-ink)]">{fmtDay(tramo.departureAt)}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span className="text-[var(--color-ink)]">{fmtTime(tramo.departureAt)}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span>{tramo.durationMin}m</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground line-through font-mono">
              {S(flight.originalPrice)}
            </span>
            <span className="font-mono text-2xl font-semibold leading-none text-[var(--color-primary-token)]">
              {S(totalAPagar(flight))}
            </span>
          </div>
          <div className="inline-block shrink-0 rounded-md bg-[var(--color-secondary-token)] px-2 py-1 text-[11px] font-bold text-white shadow-sm">
            −{discountPct(flight)}% DTO
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-border px-5 py-3 text-xs text-muted-foreground bg-[var(--surface-2)]">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-6 w-6 shrink-0 border border-border shadow-sm">
            {flight.seller.avatarUrl && (
              <AvatarImage src={flight.seller.avatarUrl} alt={flight.seller.name} />
            )}
            <AvatarFallback className="text-[10px] font-bold text-[var(--color-ink)]">
              {flight.seller.avatar}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate font-medium text-[var(--color-ink)]">
            {flight.seller.name}
          </span>
          {flight.seller.verifiedId && (
            <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-secondary-token)]" />
          )}
        </div>
        {!isWarn && status === "active" && (
          <div className="shrink-0 font-mono text-[10px] text-[var(--color-secondary-token)] font-medium">
            <Countdown iso={tramo.departureAt} />
          </div>
        )}
      </div>
    </Link>
  );
}

function SaveHeartButton({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-label={saved ? "Quitar de guardados" : "Guardar viaje"}
      aria-pressed={saved}
      className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full transition-transform [@media(hover:hover)_and_(pointer:fine)]:hover:scale-110 active:scale-90 after:absolute after:-inset-2.5 after:content-['']"
    >
      <Heart
        className={`h-4 w-4 transition-colors ${
          saved
            ? "fill-[var(--color-primary-token)] text-[var(--color-primary-token)]"
            : "text-muted-foreground"
        }`}
      />
    </button>
  );
}
