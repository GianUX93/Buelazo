import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Circle,
  XCircle,
  ArrowRight,
  Plane,
  Info,
  Bell,
  AlertTriangle,
  Heart,
  Smartphone,
  CreditCard,
  Landmark,
  Loader2,
  Share2,
  Copy,
  Facebook,
  Instagram,
  Eye,
  HelpCircle,
} from "lucide-react";

import { useSaved } from "@/lib/saved-context";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { usePayment } from "@/lib/payment-context";
import { getFlightById, incrementFlightCounter } from "@/lib/services/flights";
import { createTransaction, getTransactionForFlight } from "@/lib/services/transactions";
import {
  computeStatus,
  fmtDate,
  S,
  airlineLogo,
  comisionPlataforma,
  discountPct,
  tramoVigente,
  tramoAVenderLabel,
  asientoLabel,
  asientoVigente,
  ASIENTO_ALEATORIO_MENSAJE,
} from "@/lib/flight-utils";
import { Countdown } from "@/components/site/Countdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/site/WhatsAppIcon";
import { SOPORTE_WHATSAPP_URL } from "@/lib/support";

type MetodoPago = "yape" | "tarjeta" | "transferencia";

const METODOS_PAGO: { id: MetodoPago; label: string; desc: string; Icon: typeof Smartphone }[] = [
  { id: "yape", label: "Yape / Plin", desc: "Pago instantáneo desde tu app", Icon: Smartphone },
  {
    id: "tarjeta",
    label: "Tarjeta de crédito o débito",
    desc: "Visa, Mastercard, Amex",
    Icon: CreditCard,
  },
  {
    id: "transferencia",
    label: "Transferencia bancaria",
    desc: "BCP, BBVA, Interbank, Scotiabank",
    Icon: Landmark,
  },
];

const searchSchema = z.object({
  from: z.enum(["dashboard", "guardados", "agente"]).optional(),
  tx: z.string().optional(),
  vista: z.enum(["publicados", "proceso"]).optional(),
});

export const Route = createFileRoute("/flight/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  head: ({ loaderData }) => {
    const f = loaderData?.flight;
    if (!f) {
      return {
        meta: [{ title: "Vuelo no disponible — Buelazo" }, { name: "robots", content: "noindex" }],
      };
    }
    const tramo = tramoVigente(f);
    return {
      meta: [
        {
          title: `${tramo.origin.city} → ${tramo.destination.city} · ${S(f.resalePrice)} — Buelazo`,
        },
        {
          name: "description",
          content: `Pasaje ${f.airline} ${tramo.origin.code}-${tramo.destination.code} el ${fmtDate(tramo.departureAt)} en ${S(f.resalePrice)}. Pago retenido hasta confirmar el endoso.`,
        },
      ],
    };
  },
  loader: async ({ params }) => {
    try {
      const f = await getFlightById(params.id);
      return { flight: f };
    } catch (e) {
      throw notFound();
    }
  },
  component: FlightDetail,
});

function FlightDetail() {
  const { flight } = Route.useLoaderData();
  const search = Route.useSearch();
  const { isSaved, toggleSaved } = useSaved();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { metodoPago: metodoPagoGuardado } = usePayment();
  const status = computeStatus(flight);
  const esPropiaOferta = !!user && user.id === flight.seller.id;
  // dbStatus solo existe en vuelos reales de Supabase (mock no lo tiene).
  const dbStatus = (flight as { dbStatus?: string }).dbStatus;
  // Si ya no está "active"/"last_call" (vendido, retirado, rechazado), no se puede
  // volver a comprar — pero el motivo por el que no está disponible varía (ver el
  // badge de "Protección Escrow" más abajo, que distingue vendido de retirado/rechazado).
  const noDisponibleParaComprar = !!dbStatus && !["active", "last_call"].includes(dbStatus);
  const [step, setStep] = useState(0);
  const [payOpen, setPayOpen] = useState(false);

  // Transacción real de este vuelo, solo si quien mira es parte de ella (comprador
  // o vendedor) — RLS ya filtra esto, así que si no aplica simplemente llega null.
  const { data: misTransaccion } = useQuery({
    queryKey: ["transactionForFlight", flight.id, user?.id],
    queryFn: () => getTransactionForFlight(flight.id, user!.id),
    enabled: !!user && !!(flight as { dbStatus?: string }).dbStatus,
  });

  // El login ahora es un modal que abre en el lugar (no navega a /login), así
  // que la intención de "quería comprar" solo necesita sobrevivir en memoria
  // mientras el modal está abierto — apenas `user` pasa a existir, se retoma
  // la compra sola en vez de hacer buscar el botón de nuevo. `useSaved()` ya
  // resuelve el mismo patrón para el corazón de guardar por su cuenta.
  const pendingBuyRef = useRef(false);
  useEffect(() => {
    if (!user || esPropiaOferta) return;
    if (pendingBuyRef.current) {
      pendingBuyRef.current = false;
      setPayOpen(true);
    }
  }, [user, esPropiaOferta]);

  // Cuenta como vista real solo si no es el propio vendedor viendo su publicación.
  useEffect(() => {
    if (esPropiaOferta) return;
    incrementFlightCounter(flight.id, "views", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id]);

  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(metodoPagoGuardado?.tipo ?? null);
  const [procesando, setProcesando] = useState(false);
  const [pagoExitoso, setPagoExitoso] = useState(false);
  const [nuevaTransaccionId, setNuevaTransaccionId] = useState<string | null>(null);
  const tramo = tramoVigente(flight);
  const asiento = asientoVigente(flight);
  const comision = comisionPlataforma(flight.resalePrice);
  const totalARetener = flight.resalePrice + comision;

  // Ofertas expired nunca se muestran — bloqueamos con estado explícito
  if (status === "expired") {
    return (
      <ExpiredNotice id={flight.id} route={`${tramo.origin.code} → ${tramo.destination.code}`} />
    );
  }

  // Si ya se vendió (o se retiró/rechazó) y quien mira no es ni el comprador
  // ni el vendedor, no tiene sentido dejarle ver ruta, precio ni datos del
  // vendedor de una oferta que ya no puede tomar — solo comprador y vendedor
  // siguen viendo el detalle completo.
  const esParticipante = esPropiaOferta || !!misTransaccion;
  if (noDisponibleParaComprar && !esParticipante) {
    return <SoldNotice route={`${tramo.origin.code} → ${tramo.destination.code}`} />;
  }

  const isWarn = status === "last_call";
  const saved = isSaved(flight.id);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTexto = `Mira este pasaje ${tramo.origin.code} → ${tramo.destination.code} en Buelazo`;

  function copiarLink() {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <div className="flex items-center justify-between gap-4">
        {search.from === "dashboard" ? (
          <Link
            to="/dashboard"
            search={{ tx: search.tx, vista: search.vista }}
            className="text-sm font-bold text-[var(--color-primary-token)] hover:underline inline-flex items-center gap-1"
          >
            ← Volver a mis operaciones
          </Link>
        ) : search.from === "guardados" ? (
          <Link
            to="/profile"
            search={{ tab: "guardados" }}
            className="text-sm font-bold text-[var(--color-primary-token)] hover:underline inline-flex items-center gap-1"
          >
            ← Volver a guardados
          </Link>
        ) : search.from === "agente" ? (
          <Link
            to="/explore"
            className="text-sm font-bold text-[var(--color-primary-token)] hover:underline inline-flex items-center gap-1"
          >
            ← Volver al chat
          </Link>
        ) : (
          <Link
            to="/explore"
            className="text-sm font-bold text-[var(--color-primary-token)] hover:underline inline-flex items-center gap-1"
          >
            ← Volver a resultados
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50"
              >
                <Share2 className="h-4 w-4" /> Compartir
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {shareUrl}
                </span>
                <button
                  type="button"
                  onClick={copiarLink}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-2.5 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${shareTexto} ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Compartir por WhatsApp"
                  className="grid h-11 w-11 place-items-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Compartir en Facebook"
                  className="grid h-11 w-11 place-items-center rounded-full bg-[#1877F2] text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    copiarLink();
                    toast.message("Instagram no permite compartir link directo", {
                      description: "Pégalo en tu historia o en un mensaje.",
                    });
                  }}
                  aria-label="Compartir en Instagram"
                  className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <Instagram className="h-5 w-5" />
                </button>
              </div>
            </PopoverContent>
          </Popover>
          {!esPropiaOferta && !noDisponibleParaComprar && (
            <button
              type="button"
              onClick={() => {
                toggleSaved(flight.id);
                incrementFlightCounter(flight.id, "saved_count", saved ? -1 : 1);
              }}
              aria-pressed={saved}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
                saved
                  ? "border-[var(--color-primary-token)]/30 bg-[var(--color-primary-token)]/10 text-[var(--color-primary-token)]"
                  : "border-border bg-white text-[var(--color-ink)] hover:bg-gray-50"
              }`}
            >
              <Heart className={`h-4 w-4 ${saved ? "fill-[var(--color-primary-token)]" : ""}`} />
              {saved ? "Guardado" : "Guardar"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[1.4fr_1fr]">
        {/* Left: flight info */}
        <div className="space-y-6">
          {isWarn && (
            <div className="flex items-start gap-4 rounded-[2rem] border border-[var(--color-warning-token)] bg-yellow-50 p-6 shadow-sm">
              <div className="bg-[var(--color-warning-token)] p-2 rounded-full mt-1">
                <AlertTriangle className="h-5 w-5 text-[var(--color-ink)]" />
              </div>
              <div>
                <div className="font-extrabold text-[var(--color-ink)] font-display text-xl">
                  Última llamada
                </div>
                <p className="mt-1 text-sm font-medium text-[var(--color-ink)]/80 leading-relaxed">
                  Este vuelo sale en menos de 24 horas. El trámite de endoso con la aerolínea tomará
                  entre 1 y 3 horas. Solo continúa si puedes coordinar en tiempo real con el
                  vendedor.
                </p>
                <div className="mt-3">
                  <Countdown iso={tramo.departureAt} tone="warn" size="lg" />
                </div>
              </div>
            </div>
          )}

          <div className="tarjeta-boleto p-8 md:p-10 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <img
                src={airlineLogo(flight.airline)}
                alt={flight.airline}
                className="h-4 w-auto max-w-[80px] object-contain"
              />
              {flight.airline} · <span className="font-mono">{flight.flightNumber}</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {esPropiaOferta ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold normal-case tracking-normal text-gray-500">
                    Tu publicación
                  </span>
                ) : (
                  asiento.tipo === "seleccionado" &&
                  asiento.categoria === "ventana" && (
                    <span className="rounded-full bg-[var(--color-secondary-token)]/10 px-2.5 py-1 text-[10px] font-bold normal-case tracking-normal text-[var(--color-secondary-token)]">
                      🪟 Ventana confirmada
                    </span>
                  )
                )}
                {flight.tipoBoleto === "ida_y_vuelta" && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Esta oferta incluye: {tramoAVenderLabel(flight.tramoAVender)}
                  </span>
                )}
              </div>
            </div>

            {flight.tramoAVender === "ambos" && (
              <div className="mt-6 text-[11px] font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
                Ida
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-4">
              <div>
                <div className="font-display text-5xl md:text-7xl font-extrabold text-[var(--color-ink)]">
                  {tramo.origin.code}
                </div>
                <div className="mt-1 text-sm font-medium text-muted-foreground">
                  {tramo.origin.city}
                </div>
              </div>
              <div className="flex-1 px-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 border-t-2 border-dashed border-gray-300" />
                  <Plane className="h-5 w-5 shrink-0 text-[var(--color-primary-token)]" />
                  <div className="h-px flex-1 border-t-2 border-dashed border-gray-300" />
                </div>
                <div className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {tramo.durationMin} min · directo
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-5xl md:text-7xl font-extrabold text-[var(--color-ink)]">
                  {tramo.destination.code}
                </div>
                <div className="mt-1 text-sm font-medium text-muted-foreground">
                  {tramo.destination.city}
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-dashed border-border pt-8 sm:grid-cols-4">
              <Meta label="Salida" value={fmtDate(tramo.departureAt)} isMono />
              <Meta label="Equipaje" value={flight.baggage} />
              <Meta label="Asiento" value={asientoLabel(asiento)} isMono />
              <Meta label="Ruta" value="Directo" />
            </div>

            {flight.tramoAVender === "ambos" && flight.tramoRegreso && (
              <div className="mt-8 border-t border-dashed border-border pt-8">
                <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
                  Vuelta
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-display text-3xl md:text-4xl font-extrabold text-[var(--color-ink)]">
                      {flight.tramoRegreso.origin.code}
                    </div>
                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                      {flight.tramoRegreso.origin.city}
                    </div>
                  </div>
                  <div className="flex-1 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 border-t-2 border-dashed border-gray-300" />
                      <Plane className="h-4 w-4 shrink-0 rotate-180 text-[var(--color-primary-token)]" />
                      <div className="h-px flex-1 border-t-2 border-dashed border-gray-300" />
                    </div>
                    <div className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {flight.tramoRegreso.durationMin} min · directo
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-3xl md:text-4xl font-extrabold text-[var(--color-ink)]">
                      {flight.tramoRegreso.destination.code}
                    </div>
                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                      {flight.tramoRegreso.destination.city}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Meta label="Salida" value={fmtDate(flight.tramoRegreso.departureAt)} isMono />
                  <Meta label="Equipaje" value={flight.baggage} />
                  <Meta
                    label="Asiento"
                    value={asientoLabel(
                      flight.asientoRegreso ?? { tipo: "aleatorio", categoria: null, numero: null },
                    )}
                    isMono
                  />
                  <Meta label="Ruta" value="Directo" />
                </div>
              </div>
            )}

            {asiento.tipo === "aleatorio" && (
              <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-5 text-sm font-medium text-gray-600">
                <span className="text-[var(--color-ink)] font-bold block mb-1">
                  Sobre el asiento:{" "}
                </span>
                {ASIENTO_ALEATORIO_MENSAJE}
              </div>
            )}

            {flight.note && (
              <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-5 text-sm font-medium text-gray-600">
                <span className="text-[var(--color-ink)] font-bold block mb-1">
                  Nota del vendedor:{" "}
                </span>
                {flight.note}
              </div>
            )}

            {esPropiaOferta && (
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-dashed border-gray-200 pt-8">
                <div>
                  <div className="flex items-center gap-1 font-mono text-2xl font-bold text-[var(--color-ink)]">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    {flight.views}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Vistas
                  </div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-bold text-[var(--color-ink)]">
                    {flight.interested}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Interesados
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 font-mono text-2xl font-bold text-[var(--color-ink)]">
                    <Heart className="h-4 w-4 text-[var(--color-primary-token)]" />
                    {flight.savedCount}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Guardados
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seller */}
          <div className="rounded-[2rem] border border-border bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-5">
              <Avatar className="h-16 w-16 border border-border shadow-sm">
                {flight.seller.avatarUrl && (
                  <AvatarImage src={flight.seller.avatarUrl} alt={flight.seller.name} />
                )}
                <AvatarFallback className="font-display text-2xl font-bold text-[var(--color-ink)]">
                  {flight.seller.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-[var(--color-ink)]">
                    {flight.seller.name}
                  </span>
                  {flight.seller.verifiedId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-secondary-token)]/10 px-2.5 py-0.5 text-xs font-bold text-[var(--color-secondary-token)]">
                      <ShieldCheck className="h-3.5 w-3.5" /> ID validado
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-muted-foreground mt-0.5">
                  miembro desde {flight.seller.memberSince}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: checkout card */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div
            className={`rounded-[2rem] border p-8 shadow-sm ${
              isWarn
                ? "border-[color-mix(in_srgb,var(--color-warning-token)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning-token)_5%,#FFFFFF)]"
                : "border-border bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm font-mono text-muted-foreground line-through decoration-gray-400">
                  {S(flight.originalPrice)}
                </div>
                <div className="font-mono text-5xl font-semibold text-[var(--color-primary-token)] mt-1">
                  {S(totalARetener)}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Total a pagar hoy
                </div>
              </div>
              <div className="rounded-md bg-[var(--color-secondary-token)] px-3 py-1.5 text-sm font-bold text-white shadow-sm">
                −{discountPct(flight)}% DTO
              </div>
            </div>
            {flight.tipoBoleto === "ida_y_vuelta" && (
              <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-primary-token)]">
                Precio por: {tramoAVenderLabel(flight.tramoAVender)}
              </div>
            )}
            <div className="mt-4 text-xs font-medium text-muted-foreground">
              Ahorro real de {S(flight.originalPrice - totalARetener)} vs. precio actual en la
              aerolínea.
            </div>

            <div className="my-6 border-b border-dashed border-gray-200" />

            <div className="space-y-3 text-sm">
              <Row label="Precio del pasaje" value={S(flight.resalePrice)} />
              <Row label="Servicio Buelazo (5%)" value={S(comision)} />
              <Row label="Asiento" value={asientoLabel(asiento)} muted />
              <Row label="Verificación aerolínea" value="Incluido" muted />
            </div>

            {esPropiaOferta ? null : noDisponibleParaComprar ? null : (
              <>
                <button
                  onClick={() => {
                    if (step === 0) {
                      if (!user) {
                        pendingBuyRef.current = true;
                        openAuthModal("login");
                        return;
                      }
                      setPayOpen(true);
                      incrementFlightCounter(flight.id, "interested_count", 1);
                      return;
                    }
                    setStep((s) => Math.min(3, s + 1));
                    toast.success(
                      step === 1
                        ? "Vendedor notificado"
                        : step === 2
                          ? "Endoso confirmado"
                          : "Pago liberado",
                    );
                  }}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold shadow-sm transition-transform ease-snappy hover:scale-[1.02] active:scale-[0.98] ${
                    isWarn
                      ? "bg-[var(--color-ink)] text-white hover:bg-black"
                      : "bg-[var(--color-primary-token)] text-white hover:bg-[var(--color-primary-token)]/90"
                  }`}
                >
                  {step === 0
                    ? user
                      ? "Comprar vuelo"
                      : "Ingresa para comprar"
                    : step === 1
                      ? "Confirmar endoso iniciado"
                      : step === 2
                        ? "Confirmar boleto recibido"
                        : "Traspaso exitoso ✓"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <Lock className="h-4 w-4 text-[var(--color-secondary-token)]" />
                  Tu pago no va al vendedor hasta confirmar.
                </div>
              </>
            )}
          </div>

          <Dialog
            open={payOpen}
            onOpenChange={(o) => {
              if (procesando) return;
              setPayOpen(o);
              if (!o) {
                setMetodoPago(metodoPagoGuardado?.tipo ?? null);
                if (pagoExitoso) {
                  setPagoExitoso(false);
                  setStep(1);
                }
              }
            }}
          >
            <DialogContent className="max-w-md">
              {pagoExitoso ? (
                <div className="py-2 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--color-secondary-token)] text-white">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-extrabold text-[var(--color-ink)]">
                    ¡Pago protegido con éxito!
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Guardamos tu dinero de forma segura. Solo se le entrega al vendedor cuando tú
                    confirmes que recibiste el traspaso.
                  </p>

                  <div className="mt-6 space-y-2 rounded-2xl border border-border bg-surface-2 p-4 text-left text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Monto retenido</span>
                      <span className="font-mono font-bold text-[var(--color-ink)]">
                        {S(totalARetener)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Método de pago</span>
                      <span className="font-bold text-[var(--color-ink)]">
                        {METODOS_PAGO.find((m) => m.id === metodoPago)?.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 text-left">
                    <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Qué sigue
                    </div>
                    <ol className="space-y-3">
                      <TimelineStep
                        done
                        title="1. Vendedor inicia trámite"
                        desc="Normalmente responde dentro de las próximas 24 horas."
                      />
                      <TimelineStep
                        title="2. Aerolínea confirma el endoso"
                        desc="Verificamos que el boleto quedó a tu nombre."
                      />
                      <TimelineStep
                        title="3. Confirmas y se libera el pago"
                        desc="Tú confirmas que recibiste el boleto correctamente."
                      />
                    </ol>
                  </div>

                  <div className="mt-8 flex flex-col gap-2">
                    <Link
                      to="/dashboard"
                      search={nuevaTransaccionId ? { tx: nuevaTransaccionId } : undefined}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform ease-snappy hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Comenzar trámite <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setPayOpen(false);
                        setMetodoPago(metodoPagoGuardado?.tipo ?? null);
                        setPagoExitoso(false);
                        setStep(1);
                      }}
                      className="text-sm font-bold text-muted-foreground hover:text-[var(--color-ink)]"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : procesando ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[var(--color-primary-token)]" />
                  <div>
                    <div className="font-display text-lg font-extrabold text-[var(--color-ink)]">
                      Procesando pago…
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Estamos reteniendo tu dinero en escrow, no se libera al vendedor todavía.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                      Elige tu método de pago
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-2">
                    {METODOS_PAGO.map(({ id, label, desc, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setMetodoPago(id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                          metodoPago === id
                            ? "border-[var(--color-primary-token)] bg-[var(--color-primary-token)]/5"
                            : "border-border hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                            metodoPago === id
                              ? "bg-[var(--color-primary-token)] text-white"
                              : "bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[var(--color-ink)]">{label}</div>
                          <div className="text-xs text-muted-foreground">{desc}</div>
                        </div>
                        <div
                          className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                            metodoPago === id
                              ? "border-[var(--color-primary-token)] bg-[var(--color-primary-token)]"
                              : "border-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-baseline justify-between rounded-xl bg-[var(--surface-2)] p-4">
                    <span className="text-sm font-bold text-[var(--color-ink)]">
                      Total a pagar hoy
                    </span>
                    <span className="font-mono text-xl font-bold text-[var(--color-ink)]">
                      {S(totalARetener)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!metodoPago}
                    onClick={async () => {
                      if (!user) return;
                      setProcesando(true);
                      try {
                        const nuevaTransaccion = await createTransaction({
                          flight_id: flight.id,
                          buyer_id: user.id,
                          seller_id: flight.seller.id,
                          agreed_price: flight.resalePrice,
                          platform_fee: comision,
                        });
                        setProcesando(false);
                        setNuevaTransaccionId(nuevaTransaccion.id);
                        setPagoExitoso(true);
                      } catch (err) {
                        setProcesando(false);
                        const message =
                          err instanceof Error
                            ? err.message
                            : typeof err === "object" && err !== null && "message" in err
                              ? String((err as { message: unknown }).message)
                              : null;
                        toast.error(
                          message
                            ? `No se pudo confirmar el pago: ${message}`
                            : "No se pudo confirmar el pago.",
                        );
                      }
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-transform ease-snappy hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:active:scale-100"
                  >
                    <Lock className="h-4 w-4" /> Confirmar pago
                  </button>
                  <p className="text-center text-xs font-medium text-muted-foreground">
                    Tu pago queda retenido en garantía. No se libera al vendedor hasta confirmar el
                    endoso.
                  </p>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* How escrow works (moved below checkout for mobile flow) — nunca
              para el propio vendedor: RLS le permite ver la transacción real
              (es participante), pero el progreso del comprador no le sirve
              acá, ya tiene su propia vista en "Mis operaciones". */}
          {esPropiaOferta ? null : misTransaccion ? (
            <div className="mt-6 rounded-[2rem] border border-border bg-white p-6 shadow-sm">
              <div className="mb-5 text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">
                Protección Escrow
              </div>
              {misTransaccion.state === "reembolsado" ? (
                <p className="text-sm text-muted-foreground">
                  Esta transacción fue reembolsada. El pago no llegó a liberarse al vendedor.
                </p>
              ) : (
                <ol className="space-y-5 text-sm">
                  {(() => {
                    const realState =
                      misTransaccion.state === "en_disputa"
                        ? (misTransaccion.estadoAnteriorDisputa ?? "vendedor_inicia")
                        : misTransaccion.state;
                    const idx = [
                      "pago_retenido",
                      "vendedor_inicia",
                      "confirmado",
                      "liberado",
                    ].indexOf(realState);
                    return (
                      <>
                        <TimelineStep
                          done={idx >= 0}
                          title="1. Pago confirmado"
                          desc="Buelazo guarda tu dinero seguro."
                        />
                        <TimelineStep
                          done={idx >= 1}
                          title="2. Trámite iniciado"
                          desc="Vendedor solicita cambio de titular."
                        />
                        <TimelineStep
                          done={idx >= 2}
                          title="3. Verificación"
                          desc="Validamos que el boleto está a tu nombre."
                        />
                        <TimelineStep
                          done={idx >= 3}
                          title="4. Pago liberado"
                          desc="El vendedor recibe su dinero."
                        />
                      </>
                    );
                  })()}
                </ol>
              )}
              {misTransaccion.state === "en_disputa" && (
                <p className="mt-4 text-xs font-medium text-amber-600">
                  Esta transacción está en pausa por un reporte abierto.
                </p>
              )}
            </div>
          ) : noDisponibleParaComprar ? (
            <div className="mt-6 flex items-center gap-2 rounded-[2rem] border border-border bg-white p-6 shadow-sm">
              {dbStatus === "rechazado" || dbStatus === "cancelled" ? (
                <>
                  <XCircle className="h-5 w-5 shrink-0 text-gray-400" />
                  <span className="text-sm font-bold text-[var(--color-ink)]">
                    Esta publicación ya no está disponible
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-secondary-token)]" />
                  <span className="text-sm font-bold text-[var(--color-ink)]">
                    Este pasaje ya fue vendido
                  </span>
                </>
              )}
            </div>
          ) : (
            // Antes de comprar todavía no existe una transacción, así que el
            // timeline de escrow (1-4) aparecía completo pero apagado — los
            // usuarios lo leían como algo por hacer, no como información.
            // Ese mismo timeline con datos reales ya vive en "Mis
            // operaciones" una vez que sí hay una transacción en curso; acá
            // se reemplaza por algo accionable para quien todavía duda.
            <div className="mt-6 rounded-[2rem] border border-border bg-white p-6 shadow-sm">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-secondary-token)]" />
                Tu pago queda protegido hasta confirmar el traspaso
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Buelazo retiene el dinero en garantía y recién lo libera al vendedor cuando
                confirmas que el boleto quedó a tu nombre.
              </p>
              <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-border pt-4">
                <Link
                  to="/trust"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-xs font-bold text-[var(--color-ink)] transition-colors hover:bg-muted"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Ver cómo funciona el proceso
                </Link>
                <a
                  href={SOPORTE_WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  Escribir a soporte por WhatsApp
                </a>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value, isMono }: { label: string; value: string; isMono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 text-sm font-medium text-[var(--color-ink)] ${isMono ? "font-mono font-semibold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium text-gray-600">{label}</span>
      <span
        className={
          muted
            ? "text-muted-foreground font-medium"
            : "font-mono font-bold text-[var(--color-ink)]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function TimelineStep({ done, title, desc }: { done?: boolean; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-secondary-token)]" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
      )}
      <div>
        <div className={`font-bold ${done ? "text-[var(--color-ink)]" : "text-gray-400"}`}>
          {title}
        </div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </li>
  );
}

function SoldNotice({ route }: { route: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-24">
      <div className="rounded-[2rem] border border-border bg-white p-8 text-center md:p-12 shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gray-100 text-gray-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-extrabold text-[var(--color-ink)]">
          Este pasaje ya fue vendido
        </h1>
        <p className="mt-3 text-sm font-medium text-muted-foreground leading-relaxed">
          Otra persona ya lo compró — el detalle completo solo queda visible para el comprador y el
          vendedor.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() =>
              toast.success("Alerta creada", {
                description: `Te avisaremos si aparece otro vuelo ${route}.`,
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95 shadow-sm"
          >
            <Bell className="h-4 w-4" /> Alertas para esta ruta
          </button>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-6 py-3 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Ver otros vuelos
          </Link>
        </div>
      </div>
    </div>
  );
}

function ExpiredNotice({ route }: { id: string; route: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-24">
      <div className="rounded-[2rem] border border-border bg-white p-8 text-center md:p-12 shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gray-100 text-gray-400">
          <Info className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-extrabold text-[var(--color-ink)]">
          Oferta ya no disponible
        </h1>
        <p className="mt-3 text-sm font-medium text-muted-foreground leading-relaxed">
          Este pasaje ya no cumple los tiempos mínimos para completar el trámite de endoso de forma
          segura. Buelazo nunca vende inventario que no puedas usar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() =>
              toast.success("Alerta creada", {
                description: `Te avisaremos si aparece otro vuelo ${route}.`,
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95 shadow-sm"
          >
            <Bell className="h-4 w-4" /> Alertas para esta ruta
          </button>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-6 py-3 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Ver otros vuelos
          </Link>
        </div>
      </div>
    </div>
  );
}
