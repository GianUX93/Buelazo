import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { getFlightById, updateFlight, type NewFlightInput } from "@/lib/services/flights";
import {
  airportsList,
  airlines,
  type AsientoCategoria,
  type Asiento,
  type TramoAVender,
} from "@/lib/mock-data";
import { S, PLATFORM_COMMISSION_RATE, tramoAVenderLabel } from "@/lib/flight-utils";
import { Field, PillToggle, AsientoFields, ReceiptRow } from "@/components/site/PublishFormFields";
import { AuthRequiredPlaceholder } from "@/components/site/auth/AuthRequiredPlaceholder";

export const Route = createFileRoute("/edit-flight/$id")({
  head: () => ({
    meta: [{ title: "Editar publicación — Buelazo" }],
  }),
  component: EditFlight,
});

function buildIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function splitIso(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function EditFlight() {
  const { ready, isLoading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const { data: flight, isLoading } = useQuery({
    queryKey: ["flight", id],
    queryFn: () => getFlightById(id),
  });

  const [guardando, setGuardando] = useState(false);
  const [data, setData] = useState<{
    airline: string;
    flightNumber: string;
    date: string;
    time: string;
    arrivalTime: string;
    returnDate: string;
    returnTime: string;
    returnArrivalTime: string;
    tramoAVender: TramoAVender;
    price: number;
    cargoEstimado: number | null;
    notaVendedor: string;
    asientoIdaTipo: Asiento["tipo"];
    asientoIdaCategoria: AsientoCategoria | null;
    asientoIdaNumero: string;
    asientoRegresoTipo: Asiento["tipo"];
    asientoRegresoCategoria: AsientoCategoria | null;
    asientoRegresoNumero: string;
  } | null>(null);

  // Prellena el formulario una sola vez, apenas llega el vuelo — solo con los
  // campos que de verdad tienen columna en la BD (ver comentario en updateFlight).
  useEffect(() => {
    if (!flight || data) return;
    const ida = splitIso(flight.tramoIda.departureAt);
    const vuelta = splitIso(flight.tramoRegreso?.departureAt ?? null);
    setData({
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      date: ida.date,
      time: ida.time,
      arrivalTime: "",
      returnDate: vuelta.date,
      returnTime: vuelta.time,
      returnArrivalTime: "",
      tramoAVender: flight.tramoAVender,
      price: flight.resalePrice,
      cargoEstimado: flight.cargoAerolineaEstimado.monto || null,
      notaVendedor: flight.note ?? "",
      asientoIdaTipo: flight.asientoIda?.tipo ?? "aleatorio",
      asientoIdaCategoria: flight.asientoIda?.categoria ?? null,
      asientoIdaNumero: flight.asientoIda?.numero ?? "",
      asientoRegresoTipo: flight.asientoRegreso?.tipo ?? "aleatorio",
      asientoRegresoCategoria: flight.asientoRegreso?.categoria ?? null,
      asientoRegresoNumero: flight.asientoRegreso?.numero ?? "",
    });
  }, [flight, data]);

  if (!ready) {
    if (authLoading) {
      return (
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return <AuthRequiredPlaceholder />;
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
          No encontramos esta publicación.
        </h1>
        <Link
          to="/dashboard"
          className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-token)] hover:underline"
        >
          Volver a Mis operaciones
        </Link>
      </div>
    );
  }

  const esDueño = user?.id === flight.seller.id;
  // Una publicación rechazada 2 veces ya no se puede reenviar — el vendedor tiene
  // que crear una nueva desde cero (ver dashboard.tsx, límite duro de reintentos).
  const limiteReintentosAlcanzado =
    flight.dbStatus === "rechazado" && (flight.rejectionCount ?? 0) >= 2;
  const editable =
    (flight.dbStatus === "active" ||
      flight.dbStatus === "last_call" ||
      flight.dbStatus === "pendiente_revision" ||
      flight.dbStatus === "rechazado") &&
    !limiteReintentosAlcanzado;
  const tieneRegreso = !!flight.tramoRegreso;

  if (!esDueño || !editable) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
          {esDueño
            ? "Esta publicación ya no se puede editar."
            : "No puedes editar esta publicación."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {!esDueño
            ? "Esta publicación no te pertenece."
            : limiteReintentosAlcanzado
              ? "Alcanzó el límite de 2 rechazos. Crea una publicación nueva si quieres volver a ofrecer este pasaje."
              : "Solo se pueden editar publicaciones activas, antes de tener comprador."}
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-token)] hover:underline"
        >
          Volver a Mis operaciones
        </Link>
      </div>
    );
  }

  const precioMinimo = Math.max(1, Math.ceil(flight.originalPrice * 0.1));
  const precioMaximo = Math.max(precioMinimo, flight.originalPrice - 1);
  const precioError =
    data.price >= flight.originalPrice
      ? `El precio de reventa debe ser menor al original (${S(flight.originalPrice)}).`
      : data.price < precioMinimo
        ? `El precio mínimo permitido es ${S(precioMinimo)} (10% del original).`
        : null;

  const comision = Math.round(data.price * PLATFORM_COMMISSION_RATE);
  const montoNetoEstimado = data.price - (data.cargoEstimado ?? 0) - comision;

  async function guardar() {
    if (!data || precioError) return;
    const departureIso = buildIso(data.date, data.time);
    if (!departureIso) {
      toast.error("Falta la fecha y hora de salida del vuelo de ida.");
      return;
    }
    const returnIso = tieneRegreso ? buildIso(data.returnDate, data.returnTime) : null;
    if (tieneRegreso && !returnIso) {
      toast.error("Falta la fecha y hora de salida del vuelo de vuelta.");
      return;
    }

    const vendeIda = data.tramoAVender === "ida" || data.tramoAVender === "ambos" || !tieneRegreso;
    const vendeRegreso =
      tieneRegreso && (data.tramoAVender === "regreso" || data.tramoAVender === "ambos");

    const input: Partial<NewFlightInput> = {
      airline: data.airline,
      booking_code: data.flightNumber,
      departure_date: departureIso,
      return_date: returnIso,
      sell_segment: data.tramoAVender,
      resale_price: data.price,
      airline_fee_estimate: data.cargoEstimado,
      seller_note: data.notaVendedor.trim() || null,
      seat_outbound: vendeIda
        ? data.asientoIdaTipo === "seleccionado"
          ? {
              tipo: "seleccionado",
              categoria: data.asientoIdaCategoria,
              numero: data.asientoIdaNumero || null,
            }
          : { tipo: "aleatorio", categoria: null, numero: null }
        : null,
      seat_return: vendeRegreso
        ? data.asientoRegresoTipo === "seleccionado"
          ? {
              tipo: "seleccionado",
              categoria: data.asientoRegresoCategoria,
              numero: data.asientoRegresoNumero || null,
            }
          : { tipo: "aleatorio", categoria: null, numero: null }
        : null,
    };

    // Si estaba rechazada, editarla la reenvía a revisión — no tiene sentido
    // corregirla y dejarla "rechazada" para siempre sin que nadie la revise de nuevo.
    // El motivo/detalle del rechazo anterior se limpia: el vendedor ya lo corrigió,
    // no tiene sentido que siga viéndolo mientras espera el nuevo veredicto.
    if (flight.dbStatus === "rechazado") {
      input.status = "pendiente_revision";
      input.rejection_reason = null;
      input.rejection_detail = null;
    }

    setGuardando(true);
    try {
      await updateFlight(id, input);
      toast.success(
        flight.dbStatus === "rechazado"
          ? "Publicación actualizada y reenviada a revisión."
          : "Publicación actualizada.",
      );
      navigate({ to: "/dashboard", search: { vista: "publicados" } });
    } catch {
      toast.error("No se pudo guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
        Editar publicación
      </div>
      <h1 className="mt-2 font-display text-4xl md:text-5xl font-extrabold text-[var(--color-ink)]">
        Ajusta tu pasaje publicado.
      </h1>

      <div className="mt-10 space-y-10 rounded-[2rem] border border-border bg-white p-6 shadow-sm md:p-10">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Aerolínea">
            <div className="relative">
              <select
                className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                value={data.airline}
                onChange={(e) => setData({ ...data, airline: e.target.value })}
              >
                {airlines.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </Field>
          <Field label="Número de vuelo">
            <input
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              value={data.flightNumber}
              onChange={(e) => setData({ ...data, flightNumber: e.target.value })}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-gray-50 p-6 space-y-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">
            Tramo de ida:{" "}
            {airportsList.find((a) => a.code === flight.tramoIda.origin.code)?.city ??
              flight.tramoIda.origin.city}{" "}
            ({flight.tramoIda.origin.code}) → {flight.tramoIda.destination.city} (
            {flight.tramoIda.destination.code})
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fecha">
              <input
                type="date"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                value={data.date}
                onChange={(e) => setData({ ...data, date: e.target.value })}
              />
            </Field>
            <Field label="Hora salida">
              <input
                type="time"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                value={data.time}
                onChange={(e) => setData({ ...data, time: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {tieneRegreso && (
          <div className="rounded-2xl border border-border bg-gray-50 p-6 space-y-5">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">
              Tramo de regreso: {flight.tramoRegreso!.origin.city} (
              {flight.tramoRegreso!.origin.code}) → {flight.tramoRegreso!.destination.city} (
              {flight.tramoRegreso!.destination.code})
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Fecha">
                <input
                  type="date"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                  value={data.returnDate}
                  onChange={(e) => setData({ ...data, returnDate: e.target.value })}
                />
              </Field>
              <Field label="Hora salida">
                <input
                  type="time"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                  value={data.returnTime}
                  onChange={(e) => setData({ ...data, returnTime: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}

        {tieneRegreso && (
          <Field label="¿Qué tramo estás vendiendo?">
            <div className="inline-flex flex-wrap self-start rounded-full border border-border bg-white p-1 shadow-sm">
              {(["ida", "regreso", "ambos"] as TramoAVender[]).map((t) => (
                <PillToggle
                  key={t}
                  active={data.tramoAVender === t}
                  onClick={() => setData({ ...data, tramoAVender: t })}
                  label={tramoAVenderLabel(t)}
                />
              ))}
            </div>
          </Field>
        )}

        <AsientoFields
          title={tieneRegreso ? "Asiento de ida" : undefined}
          tipo={data.asientoIdaTipo}
          categoria={data.asientoIdaCategoria}
          numero={data.asientoIdaNumero}
          onTipoChange={(t) => setData({ ...data, asientoIdaTipo: t })}
          onCategoriaChange={(c) => setData({ ...data, asientoIdaCategoria: c })}
          onNumeroChange={(v) => setData({ ...data, asientoIdaNumero: v })}
        />

        {tieneRegreso && (
          <AsientoFields
            title="Asiento de regreso"
            tipo={data.asientoRegresoTipo}
            categoria={data.asientoRegresoCategoria}
            numero={data.asientoRegresoNumero}
            onTipoChange={(t) => setData({ ...data, asientoRegresoTipo: t })}
            onCategoriaChange={(c) => setData({ ...data, asientoRegresoCategoria: c })}
            onNumeroChange={(v) => setData({ ...data, asientoRegresoNumero: v })}
          />
        )}

        <div className="space-y-3">
          <Field label={`Precio de venta (original ${S(flight.originalPrice)})`} required>
            <input
              type="number"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              value={data.price === 0 ? "" : data.price}
              onChange={(e) =>
                setData({ ...data, price: e.target.value === "" ? 0 : Number(e.target.value) })
              }
            />
          </Field>
          {precioError && <p className="text-xs font-bold text-red-500">{precioError}</p>}
          <p className="text-xs font-medium text-muted-foreground">
            Rango permitido: {S(precioMinimo)} – {S(precioMaximo)}.
          </p>
        </div>

        <Field label="Cargo estimado de la aerolínea (opcional)">
          <input
            type="number"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            value={data.cargoEstimado ?? ""}
            onChange={(e) =>
              setData({ ...data, cargoEstimado: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>

        <Field label="Nota para compradores (opcional)">
          <textarea
            rows={3}
            maxLength={280}
            value={data.notaVendedor}
            onChange={(e) => setData({ ...data, notaVendedor: e.target.value })}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
          />
        </Field>

        {/* Desglose tipo recibo — mismo patrón que al publicar, para que quede
            claro cómo cambia el neto apenas se toca el precio o el cargo. */}
        <div className="tarjeta-boleto space-y-3 p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Desglose del neto estimado
          </div>
          <ReceiptRow
            label={`Precio de venta (${tieneRegreso ? tramoAVenderLabel(data.tramoAVender) : "solo ida"})`}
            value={S(data.price)}
          />
          <ReceiptRow
            label={`Comisión Buelazo (${Math.round(PLATFORM_COMMISSION_RATE * 100)}%)`}
            value={`− ${S(comision)}`}
          />
          {data.cargoEstimado != null ? (
            <ReceiptRow
              label="Cargo estimado de aerolínea"
              value={`− ${S(data.cargoEstimado)}`}
              note="Estimado por ti, no verificado"
            />
          ) : (
            <ReceiptRow
              label="Cargo estimado de aerolínea"
              value={S(0)}
              note="No ingresaste un estimado. Tu neto real podría ser menor a este cálculo."
              warn
            />
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-gray-200 pt-3">
            <span className="text-sm font-bold text-[var(--color-ink)]">
              Neto estimado a recibir
            </span>
            <span className="font-mono text-2xl font-bold text-[var(--color-primary-token)]">
              {S(montoNetoEstimado)}
            </span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Cifra estimada, no garantizada
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between gap-4">
        <Link
          to="/dashboard"
          search={{ vista: "publicados" }}
          className="rounded-full bg-white border border-border px-8 py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Cancelar
        </Link>
        <button
          onClick={guardar}
          disabled={guardando || !!precioError}
          className="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-10 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
        >
          {guardando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : (
            <>
              Guardar cambios <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
