import { createFileRoute, Link } from "@tanstack/react-router";
import { useRequireAuth, useAuth } from "@/lib/auth-context";
import { AuthRequiredPlaceholder } from "@/components/site/auth/AuthRequiredPlaceholder";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ShieldCheck,
  ChevronRight,
  Heart,
  Plane,
  X,
  BadgeCheck,
  SlidersHorizontal,
  Smartphone,
  CreditCard,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { airports, type Flight } from "@/lib/mock-data";
import { getFlightById } from "@/lib/services/flights";
import { updatePhone } from "@/lib/services/profile";
import { getMyRouteAlerts, deleteRouteAlert, type DbRouteAlert } from "@/lib/services/route-alerts";
import { splitPhone, joinPhone } from "@/lib/phone-prefixes";
import { PhoneInput } from "@/components/site/PhoneInput";
import { computeStatus, tramoVigente, S } from "@/lib/flight-utils";
import { useSaved } from "@/lib/saved-context";
import { usePayment, type MetodoCobroTipo, type MetodoPagoTipo } from "@/lib/payment-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const searchSchema = z.object({
  tab: z.enum(["datos", "preferencias", "guardados"]).optional(),
});

export const Route = createFileRoute("/profile")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Mi perfil — Buelazo" },
      {
        name: "description",
        content: "Tus datos, preferencias y viajes guardados en Buelazo.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { ready, isLoading: authLoading } = useRequireAuth();
  const { user, profile } = useAuth();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"datos" | "preferencias" | "guardados">(search.tab ?? "datos");
  useEffect(() => {
    if (search.tab) setTab(search.tab);
  }, [search.tab]);
  const { savedIds } = useSaved();

  if (authLoading) return null;
  if (!ready) return <AuthRequiredPlaceholder />;

  const nombreCompleto = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : (user?.email ?? "Usuario");
  const avatarUrl = profile?.avatar_url || null;
  const avatarFallback = (profile?.first_name?.[0] || "U").toUpperCase();
  const handle = user?.email ? `@${user.email.split("@")[0]}` : "";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear();
  const verifiedId = profile?.is_verified ?? false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
      <div className="flex flex-wrap items-center gap-6 p-6 md:p-8 rounded-[2rem] border border-border bg-white shadow-sm">
        <div className="relative">
          <Avatar className="h-24 w-24 border-2 border-white shadow-sm">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={nombreCompleto} />}
            <AvatarFallback className="font-display text-4xl">{avatarFallback}</AvatarFallback>
          </Avatar>
          {verifiedId && (
            <div className="absolute -bottom-2 -right-2 bg-[var(--color-secondary-token)] text-white p-1.5 rounded-full border-2 border-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
        </div>
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-[var(--color-ink)]">
            {nombreCompleto}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
            {handle && (
              <span className="text-[var(--color-primary-token)] font-bold">{handle}</span>
            )}
            <span>·</span>
            <span>miembro desde {memberSince}</span>
            {verifiedId && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-token)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-secondary-token)]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Identidad verificada
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
        {(
          [
            ["datos", "Mis datos", BadgeCheck],
            ["preferencias", "Preferencias", SlidersHorizontal],
            ["guardados", "Viajes guardados", Heart],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === key
                ? "bg-[var(--color-ink)] text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "guardados" && savedIds.length > 0 && (
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                  tab === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {savedIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-[2rem] border border-border bg-white p-6 md:p-8 shadow-sm">
        {tab === "datos" && (
          <>
            <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
              Mis datos
            </h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Estos datos no son públicos, solo se usan para contactarte sobre tus operaciones.
            </p>
            <div className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
              <TelefonoRow phone={profile?.phone ?? null} />
              <VerifyRow label="Correo electrónico" value={user?.email ?? ""} />
            </div>
          </>
        )}

        {tab === "preferencias" && (
          <>
            <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
              Preferencias
            </h2>

            <RouteAlertsSection />
            <MetodoPagoSection />
            <MetodoCobroSection />
          </>
        )}

        {tab === "guardados" && <GuardadosSection />}
      </section>
    </div>
  );
}

function GuardadosSection() {
  const { savedIds, removeSaved } = useSaved();
  const { data: guardados = [] } = useQuery({
    queryKey: ["saved-flights", savedIds],
    queryFn: async () => {
      const results = await Promise.all(savedIds.map((id) => getFlightById(id).catch(() => null)));
      return results.filter((f): f is Flight => Boolean(f));
    },
    enabled: savedIds.length > 0,
  });

  return (
    <>
      <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
        Viajes guardados
      </h2>

      {guardados.length === 0 ? (
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Toca el corazón en cualquier pasaje para guardarlo aquí y volver a verlo después.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {guardados.map((f) => {
            const status = computeStatus(f);
            const dbStatus = (f as { dbStatus?: string }).dbStatus;
            // "expired" cubre el caso por fecha; dbStatus cubre que ya se vendió
            // o se retiró antes de esa fecha — sin esto último, un vuelo vendido
            // seguía apareciendo como disponible acá aunque el detalle sí lo
            // mostrara correctamente como "ya fue vendido".
            const disponible =
              status !== "expired" && (!dbStatus || ["active", "last_call"].includes(dbStatus));
            const tramo = tramoVigente(f);
            return (
              <div
                key={f.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4"
              >
                {disponible ? (
                  <Link
                    to="/flight/$id"
                    params={{ id: f.id }}
                    search={{ from: "guardados" }}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2">
                      <Plane className="h-5 w-5 text-[var(--color-primary-token)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[var(--color-ink)]">
                        {tramo.origin.code} → {tramo.destination.code}
                      </span>
                      <div className="truncate text-sm text-muted-foreground">
                        {tramo.origin.city} → {tramo.destination.city} · {S(f.resalePrice)}
                      </div>
                    </div>
                  </Link>
                ) : (
                  // Ya no disponible (vendido/retirado/rechazado o expirado por fecha) —
                  // no lleva a ninguna pantalla: el detalle solo lo pueden ver el
                  // comprador y el vendedor reales, no un tercero que solo lo guardó.
                  <div className="flex min-w-0 flex-1 cursor-default items-center gap-4 opacity-60">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2">
                      <Plane className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--color-ink)]">
                          {tramo.origin.code} → {tramo.destination.code}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Ya no disponible
                        </span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {tramo.origin.city} → {tramo.destination.city}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeSaved(f.id)}
                  aria-label="Quitar de guardados"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-gray-100 hover:text-[var(--color-ink)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function VerifyRow({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 text-sm bg-white">
      <span className="font-bold text-gray-500">{label}</span>
      <span className="flex items-center gap-2 font-mono font-semibold text-[var(--color-ink)]">
        {value}
        {done && <ShieldCheck className="h-5 w-5 text-[var(--color-secondary-token)] ml-1" />}
      </span>
    </div>
  );
}

function TelefonoRow({ phone }: { phone: string | null }) {
  const { user, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [prefijo, setPrefijo] = useState("+51");
  const [numero, setNumero] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    const split = splitPhone(phone);
    setPrefijo(split.prefijo);
    setNumero(split.numero);
    setOpen(true);
  }

  async function guardar() {
    if (!user || !numero.trim()) return;
    setSaving(true);
    try {
      await updatePhone(user.id, joinPhone(prefijo, numero.trim()));
      await refreshProfile();
      toast.success("Teléfono actualizado.");
      setOpen(false);
    } catch {
      toast.error("No se pudo actualizar el teléfono.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex w-full items-center justify-between px-5 py-4 text-sm hover:bg-gray-50 transition-colors bg-white"
      >
        <span className="font-bold text-gray-500">Teléfono móvil</span>
        <span className="flex items-center gap-2 font-mono font-semibold text-[var(--color-ink)]">
          {phone || "No configurado"}
          <ChevronRight className="h-5 w-5 text-gray-400 ml-1" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold text-[var(--color-ink)]">
              Teléfono móvil
            </DialogTitle>
          </DialogHeader>
          <PhoneInput
            prefijo={prefijo}
            numero={numero}
            onChange={(p, n) => {
              setPrefijo(p);
              setNumero(n);
            }}
          />
          <DialogFooter>
            <button
              type="button"
              onClick={guardar}
              disabled={saving || !numero.trim()}
              className="w-full rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RouteAlertsSection() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState<DbRouteAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.id.startsWith("sim-")) {
      setLoading(false);
      return;
    }
    getMyRouteAlerts(user.id)
      .then(setAlertas)
      .finally(() => setLoading(false));
  }, [user]);

  async function eliminar(id: string) {
    setDeletingId(id);
    try {
      await deleteRouteAlert(id);
      setAlertas((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("No se pudo eliminar la alerta.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="mt-8">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Alertas de búsqueda
      </h3>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Rutas que activaste desde "Explorar vuelos". Te avisamos cuando aparezca un pasaje.
      </p>

      {alertas.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          No tienes alertas activas todavía.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          {alertas.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-5 py-4 text-sm bg-white"
            >
              <span className="font-bold text-[var(--color-ink)]">
                {airports[a.origin_code]?.city ?? a.origin_code} →{" "}
                {airports[a.destination_code]?.city ?? a.destination_code}
              </span>
              <button
                type="button"
                onClick={() => eliminar(a.id)}
                disabled={deletingId === a.id}
                aria-label="Eliminar alerta"
                className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-gray-100 hover:text-[var(--color-ink)] disabled:opacity-50 after:absolute after:-inset-1.5 after:content-['']"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const METODOS_PAGO_COMPRADOR: { id: MetodoPagoTipo; label: string; Icon: typeof Smartphone }[] = [
  { id: "yape", label: "Yape / Plin", Icon: Smartphone },
  { id: "tarjeta", label: "Tarjeta", Icon: CreditCard },
  { id: "transferencia", label: "Transferencia bancaria", Icon: Landmark },
];

function MetodoPagoSection() {
  const { metodoPago, setMetodoPago } = usePayment();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<MetodoPagoTipo>(metodoPago?.tipo ?? "yape");
  const [yapeNumero, setYapeNumero] = useState("");
  const [tarjetaNumero, setTarjetaNumero] = useState("");
  const [cci, setCci] = useState("");

  function openDialog() {
    setTipo(metodoPago?.tipo ?? "yape");
    setYapeNumero("");
    setTarjetaNumero("");
    setCci("");
    setOpen(true);
  }

  function guardar() {
    let detalle = "";
    if (tipo === "yape") {
      if (!yapeNumero.trim()) return;
      detalle = `Yape · ${yapeNumero}`;
    } else if (tipo === "tarjeta") {
      const digits = tarjetaNumero.replace(/\D/g, "");
      if (digits.length < 4) return;
      detalle = `Tarjeta •••• ${digits.slice(-4)}`;
    } else {
      if (!cci.trim()) return;
      detalle = `Transferencia · CCI •••••${cci.slice(-4)}`;
    }
    setMetodoPago({ tipo, detalle });
    toast.success("Método de pago actualizado.");
    setOpen(false);
  }

  return (
    <div className="mt-8">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Cómo pagas
      </h3>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Se preselecciona al pagar un pasaje, pero puedes cambiarlo en el momento si quieres.
      </p>
      <button
        type="button"
        onClick={openDialog}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm transition-colors hover:bg-gray-100"
      >
        <span className="font-bold text-gray-500">Método de pago</span>
        <span className="flex items-center gap-2 font-semibold text-[var(--color-ink)]">
          {metodoPago ? metodoPago.detalle : "No configurado"}
          <ChevronRight className="ml-1 h-5 w-5 text-gray-400" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold text-[var(--color-ink)]">
              Método de pago
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {METODOS_PAGO_COMPRADOR.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTipo(id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  tipo === id
                    ? "border-[var(--color-primary-token)] bg-[var(--color-primary-token)]/5"
                    : "border-border hover:bg-gray-50"
                }`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    tipo === id
                      ? "bg-[var(--color-primary-token)] text-white"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-[var(--color-ink)]">{label}</span>
              </button>
            ))}
          </div>

          {tipo === "yape" && (
            <input
              value={yapeNumero}
              onChange={(e) => setYapeNumero(e.target.value)}
              placeholder="Número de celular"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            />
          )}
          {tipo === "tarjeta" && (
            <input
              value={tarjetaNumero}
              onChange={(e) => setTarjetaNumero(e.target.value)}
              placeholder="Número de tarjeta"
              inputMode="numeric"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-mono font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            />
          )}
          {tipo === "transferencia" && (
            <input
              value={cci}
              onChange={(e) => setCci(e.target.value)}
              placeholder="Número de cuenta (CCI)"
              inputMode="numeric"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-mono font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            />
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={guardar}
              className="w-full rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const METODOS_COBRO: { id: MetodoCobroTipo; label: string; Icon: typeof Smartphone }[] = [
  { id: "yape", label: "Yape / Plin", Icon: Smartphone },
  { id: "cuenta_bancaria", label: "Cuenta bancaria (CCI)", Icon: Landmark },
];

function MetodoCobroSection() {
  const { profile } = useAuth();
  const { metodoCobro, setMetodoCobro } = usePayment();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<MetodoCobroTipo>(metodoCobro?.tipo ?? "yape");
  const [yapeNumero, setYapeNumero] = useState("");
  const [bancoNombre, setBancoNombre] = useState("");
  const [cci, setCci] = useState("");

  // No todos tienen el Yape asociado a su mismo celular registrado — por eso se
  // precarga como punto de partida, pero queda libre para editar.
  const yapeNumeroRegistrado = splitPhone(profile?.phone ?? null).numero;

  function openDialog() {
    setTipo(metodoCobro?.tipo ?? "yape");
    setYapeNumero(metodoCobro?.yapeNumero ?? yapeNumeroRegistrado);
    setBancoNombre(metodoCobro?.bancoNombre ?? "");
    setCci(metodoCobro?.cci ?? "");
    setOpen(true);
  }

  function guardar() {
    if (tipo === "yape") {
      if (!yapeNumero.trim()) return;
      setMetodoCobro({ tipo, yapeNumero });
    } else {
      if (!bancoNombre.trim() || !cci.trim()) return;
      setMetodoCobro({ tipo, bancoNombre, cci });
    }
    toast.success("Datos para recibir tus pagos actualizados.");
    setOpen(false);
  }

  const resumen = !metodoCobro
    ? null
    : metodoCobro.tipo === "yape"
      ? `Yape · ${metodoCobro.yapeNumero}`
      : `${metodoCobro.bancoNombre} · CCI •••••${(metodoCobro.cci ?? "").slice(-4)}`;

  return (
    <div className="mt-8">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Cómo recibes tus pagos
      </h3>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Se usa para transferirte el neto cuando liberes el pago de una venta.
      </p>

      {!metodoCobro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--color-warning-token)]/40 bg-[var(--color-warning-token)]/10 px-4 py-3 text-xs font-medium text-[var(--color-ink)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" />
          Sin esto configurado no podrás liberar el pago de tus ventas.
        </div>
      )}

      <button
        type="button"
        onClick={openDialog}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm transition-colors hover:bg-gray-100"
      >
        <span className="font-bold text-gray-500">Medio de cobro</span>
        <span className="flex items-center gap-2 font-semibold text-[var(--color-ink)]">
          {resumen ?? "No configurado"}
          <ChevronRight className="ml-1 h-5 w-5 text-gray-400" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold text-[var(--color-ink)]">
              Cómo recibes tus pagos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {METODOS_COBRO.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTipo(id);
                  if (id === "yape" && !yapeNumero.trim()) setYapeNumero(yapeNumeroRegistrado);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  tipo === id
                    ? "border-[var(--color-primary-token)] bg-[var(--color-primary-token)]/5"
                    : "border-border hover:bg-gray-50"
                }`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    tipo === id
                      ? "bg-[var(--color-primary-token)] text-white"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-[var(--color-ink)]">{label}</span>
              </button>
            ))}
          </div>

          {tipo === "yape" ? (
            <input
              value={yapeNumero}
              onChange={(e) => setYapeNumero(e.target.value)}
              placeholder="Número de celular"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            />
          ) : (
            <div className="space-y-2">
              <input
                value={bancoNombre}
                onChange={(e) => setBancoNombre(e.target.value)}
                placeholder="Banco (ej. BCP, BBVA, Interbank)"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
              <input
                value={cci}
                onChange={(e) => setCci(e.target.value)}
                placeholder="Número de cuenta (CCI)"
                inputMode="numeric"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-mono font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={guardar}
              className="w-full rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
