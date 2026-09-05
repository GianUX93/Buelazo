import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, FileText, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { getPendingFlights, approveFlight, rejectFlight } from "@/lib/services/flights";
import { getPendingCargoReviews, resolveCargoReview } from "@/lib/services/transactions";
import { S, fmtDate } from "@/lib/flight-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuthRequiredPlaceholder } from "@/components/site/auth/AuthRequiredPlaceholder";

const MOTIVOS_RECHAZO = [
  "Comprobante ilegible o incompleto",
  "Datos no coinciden con el PNR",
  "Precio o condiciones inválidas",
  "Vuelo ya no disponible o expiró",
  "Otro",
];

export const Route = createFileRoute("/admin/revisiones")({
  head: () => ({
    meta: [{ title: "Revisiones — Buelazo" }],
  }),
  component: AdminRevisiones,
});

function AdminRevisiones() {
  const { ready, isLoading: authLoading } = useRequireAuth();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; ruta: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");

  const { data: pendientes = [], isLoading } = useQuery({
    queryKey: ["flights", "pendientes"],
    queryFn: getPendingFlights,
    enabled: !!profile?.is_admin,
  });

  const { data: cargosPendientes = [], isLoading: isLoadingCargos } = useQuery({
    queryKey: ["transactions", "cargos-pendientes"],
    queryFn: getPendingCargoReviews,
    enabled: !!profile?.is_admin,
  });

  if (authLoading) return null;
  if (!ready) return <AuthRequiredPlaceholder />;

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-[var(--color-ink)]">
          No autorizado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta sección es solo para revisores.</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-bold text-[var(--color-primary-token)] hover:underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  async function aprobar(id: string) {
    setProcesandoId(id);
    try {
      await approveFlight(id);
      toast.success("Publicación aprobada. Ya está visible en el marketplace.");
      queryClient.invalidateQueries({ queryKey: ["flights", "pendientes"] });
    } catch {
      toast.error("No se pudo completar la acción. Intenta de nuevo.");
    } finally {
      setProcesandoId(null);
    }
  }

  async function confirmarRechazo() {
    if (!rejectModal || !motivo) return;
    setProcesandoId(rejectModal.id);
    try {
      await rejectFlight(rejectModal.id, motivo, detalle);
      toast.success("Publicación rechazada.");
      queryClient.invalidateQueries({ queryKey: ["flights", "pendientes"] });
      setRejectModal(null);
    } catch {
      toast.error("No se pudo completar la acción. Intenta de nuevo.");
    } finally {
      setProcesandoId(null);
    }
  }

  async function resolverCargo(id: string, decision: "aceptado" | "rechazado") {
    setProcesandoId(id);
    try {
      await resolveCargoReview(id, decision);
      toast.success(decision === "aceptado" ? "Cargo aceptado." : "Cargo rechazado.");
      queryClient.invalidateQueries({ queryKey: ["transactions", "cargos-pendientes"] });
    } catch {
      toast.error("No se pudo completar la acción. Intenta de nuevo.");
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
        Revisiones
      </div>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-[var(--color-ink)]">
        Publicaciones pendientes
      </h1>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        Confirma que el boleto sea válido y endosable antes de aprobar.
      </p>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pendientes.length === 0 ? (
        <div className="mt-8 rounded-[2rem] border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm font-medium text-muted-foreground">
          No hay publicaciones pendientes de revisión ahora mismo.
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {pendientes.map((f) => {
            const vendedor = f.profiles as {
              first_name?: string;
              last_name?: string;
              email?: string;
            } | null;
            const esPdf = (f.voucher_url ?? "").toLowerCase().endsWith(".pdf");
            const procesando = procesandoId === f.id;
            return (
              <div
                key={f.id}
                className="rounded-[2rem] border border-border bg-white p-6 shadow-sm md:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {f.airline} · <span className="font-mono">{f.booking_code}</span> · enviado{" "}
                      {fmtDate(f.created_at)}
                    </div>
                    <div className="mt-2 font-display text-2xl font-bold text-[var(--color-ink)]">
                      {f.origin_city} ({f.origin_code}) → {f.destination_city} ({f.destination_code}
                      )
                    </div>
                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                      Sale {fmtDate(f.departure_date)}
                      {f.ticket_type === "ida_y_vuelta" && ` · vuelve ${fmtDate(f.return_date)}`}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Vendedor:{" "}
                      <span className="font-bold text-[var(--color-ink)]">
                        {vendedor?.first_name} {vendedor?.last_name}
                      </span>{" "}
                      · {vendedor?.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-[var(--color-ink)]">
                      {S(Number(f.resale_price))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      original {S(Number(f.original_price))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-dashed border-gray-200 pt-5">
                  <div className="text-sm">
                    <span className="font-bold text-[var(--color-ink)]">PNR: </span>
                    <span className="font-mono">{f.reservation_code || "—"}</span>
                  </div>
                  {f.voucher_url ? (
                    <a
                      href={f.voucher_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-[var(--color-ink)] hover:bg-gray-50"
                    >
                      <FileText className="h-3.5 w-3.5" /> Ver comprobante (
                      {esPdf ? "PDF" : "imagen"})
                    </a>
                  ) : (
                    <span className="text-xs font-bold text-red-500">Sin comprobante subido</span>
                  )}
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    disabled={procesando}
                    onClick={() => {
                      setRejectModal({
                        id: f.id,
                        ruta: `${f.origin_code} → ${f.destination_code}`,
                      });
                      setMotivo("");
                      setDetalle("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-500 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={procesando}
                    onClick={() => aprobar(f.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-token)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {procesando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Aprobar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-14">
        <h2 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
          Cargos de aerolínea pendientes de revisión
        </h2>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          El vendedor reportó un cargo que supera el 50% del precio de venta. Confírmalo con la
          evidencia antes de aceptarlo.
        </p>

        {isLoadingCargos ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cargosPendientes.length === 0 ? (
          <div className="mt-6 rounded-[2rem] border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm font-medium text-muted-foreground">
            No hay cargos pendientes de revisión ahora mismo.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {cargosPendientes.map((t) => {
              const flight = t.flights as {
                origin_code?: string;
                destination_code?: string;
                airline?: string;
                booking_code?: string;
              } | null;
              const vendedor = t.seller as { first_name?: string; last_name?: string } | null;
              const procesandoCargo = procesandoId === t.id;
              return (
                <div
                  key={t.id}
                  className="rounded-[2rem] border border-red-200 bg-white p-6 shadow-sm md:p-8"
                >
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {flight?.airline} ·{" "}
                        <span className="font-mono">{flight?.booking_code}</span>
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold text-[var(--color-ink)]">
                        {flight?.origin_code} → {flight?.destination_code}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        Vendedor:{" "}
                        <span className="font-bold text-[var(--color-ink)]">
                          {vendedor?.first_name} {vendedor?.last_name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold text-red-500">
                        {S(Number(t.confirmed_airline_fee))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        de {S(Number(t.agreed_price))} de venta
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-dashed border-gray-200 pt-5">
                    {t.transfer_evidence_url ? (
                      <a
                        href={t.transfer_evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-[var(--color-ink)] hover:bg-gray-50"
                      >
                        <FileText className="h-3.5 w-3.5" /> Ver evidencia
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-red-500">Sin evidencia subida</span>
                    )}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      disabled={procesandoCargo}
                      onClick={() => resolverCargo(t.id, "rechazado")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-5 py-2.5 text-xs font-bold text-red-500 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Rechazar
                    </button>
                    <button
                      type="button"
                      disabled={procesandoCargo}
                      onClick={() => resolverCargo(t.id, "aceptado")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-secondary-token)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {procesandoCargo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Aceptar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold text-[var(--color-ink)]">
              Rechazar publicación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{rejectModal?.ruta}</p>

          <div className="mt-2 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
              Motivo
            </span>
            {MOTIVOS_RECHAZO.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={`block w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                  motivo === m
                    ? "border-red-400 bg-red-50 text-red-600"
                    : "border-border bg-white text-[var(--color-ink)] hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
              Detalle (opcional)
            </span>
            <textarea
              rows={3}
              maxLength={280}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Agrega cualquier detalle que ayude al vendedor a corregirlo…"
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            />
          </label>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setRejectModal(null)}
              className="flex-1 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!motivo || procesandoId === rejectModal?.id}
              onClick={confirmarRechazo}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rechazar publicación
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
