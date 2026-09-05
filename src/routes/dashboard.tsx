import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRequireAuth, useAuth } from "@/lib/auth-context";
import { usePayment } from "@/lib/payment-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyFlights, withdrawFlight } from "@/lib/services/flights";
import {
  getSoldFlightIds,
  getMyTransactions,
  mapDbTransactionToFrontend,
  updateTransactionState,
  updateBuyerTransferData,
  confirmBuyerOk,
  reportProblem,
  resolveRefund,
  uploadCargoEvidence,
  reportConfirmedCargo,
  type TransactionState,
} from "@/lib/services/transactions";
import {
  getChatMessages,
  sendChatMessage,
  sendChatAttachment,
  subscribeToChatMessages,
  type DbChatMessage,
} from "@/lib/services/chat";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import { z } from "zod";
import {
  CheckCircle2,
  Circle,
  Lock,
  ShoppingBag,
  Store,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Upload,
  MessageCircle,
  Send,
  IdCard,
  PlaneTakeoff,
  Heart,
  AlertTriangle,
  ArchiveX,
  XCircle,
  Paperclip,
  FileText,
  Download,
  Loader2,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  flights,
  transactions as initialTransactions,
  type Transaction,
  type DatosCompradorEndoso,
  type TipoDocumento,
} from "@/lib/mock-data";
import {
  S,
  fmtDate,
  fmtTime,
  computeStatus,
  tramoVigente,
  comisionPlataforma,
  comisionEfectiva,
  cargoAerolineaConfirmadoVigente,
  montoNetoFinal,
  requiereRevisionManual,
  PLATFORM_COMMISSION_RATE,
  sanitizeNumeroDocumento,
  DOCUMENTO_MAX_LEN,
} from "@/lib/flight-utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthRequiredPlaceholder } from "@/components/site/auth/AuthRequiredPlaceholder";

const searchSchema = z.object({
  tx: z.string().optional(),
  vista: z.enum(["publicados", "proceso", "retirados", "finalizados"]).optional(),
  chat: z.union([z.literal("1"), z.literal(1)]).optional(),
  flight: z.string().optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Mis operaciones — Buelazo" },
      {
        name: "description",
        content: "Tus transacciones activas e historial como comprador y vendedor.",
      },
    ],
  }),
  component: Dashboard,
});

const stateLabels: Record<Transaction["state"], string> = {
  pago_retenido: "Pago confirmado",
  vendedor_inicia: "Vendedor inicia trámite",
  confirmado: "Traspaso confirmado",
  liberado: "Pago liberado",
  reembolsado: "Reembolsado",
  en_disputa: "Pago en pausa",
};

const stateOrder: Transaction["state"][] = [
  "pago_retenido",
  "vendedor_inicia",
  "confirmado",
  "liberado",
];

const MOTIVOS_REPORTE: Record<"buyer" | "seller", string[]> = {
  buyer: [
    "El vendedor no responde",
    "El vuelo o asiento no coincide con lo publicado",
    "Boleto inválido o rechazado por la aerolínea",
    "Sospecho de fraude",
    "Otro",
  ],
  seller: [
    "El comprador no responde",
    "Datos de endoso incorrectos o incompletos",
    "Sospecho de fraude",
    "Otro",
  ],
};

function pendienteCount(list: Transaction[], role: "buyer" | "seller") {
  return list.filter((t) => t.role === role && t.state !== "liberado" && t.state !== "reembolsado")
    .length;
}

const ESTADOS_FINALIZADOS: Transaction["state"][] = ["liberado", "reembolsado"];

// ¿Le toca a esta persona hacer algo ahora, o está esperando a la otra parte?
// Determina qué sube arriba en "En proceso" — sin esto, una operación donde ya
// tocó tu turno se pierde entre las que solo están esperando.
function necesitaAccion(t: Transaction): boolean {
  const buyerOk = t.isReal ? !!t.buyerConfirmedOk : true;
  if (t.role === "buyer") {
    if (t.state === "pago_retenido" && !t.datosCompradorEndoso.completadoPorComprador) return true;
    if (t.state === "confirmado" && !buyerOk) return true;
    return false;
  }
  if (t.state === "pago_retenido" && t.datosCompradorEndoso.completadoPorComprador) return true;
  if (t.state === "vendedor_inicia") return true;
  if (t.state === "confirmado" && buyerOk) return true;
  return false;
}

function Dashboard() {
  const { ready, isLoading: authLoading } = useRequireAuth();
  const { user, profile } = useAuth();
  const { metodoCobro } = usePayment();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [tab, setTab] = useState<"buyer" | "seller">(() => {
    const objetivo = search.tx && initialTransactions.find((t) => t.id === search.tx);
    if (objetivo) return objetivo.role;
    if (search.vista === "publicados") return "seller";
    return pendienteCount(initialTransactions, "seller") >=
      pendienteCount(initialTransactions, "buyer")
      ? "seller"
      : "buyer";
  });
  const [sellerView, setSellerView] = useState<
    "proceso" | "finalizados" | "publicados" | "retirados" | "rechazados"
  >(search.vista === "publicados" ? "publicados" : "proceso");
  const [montoInputs, setMontoInputs] = useState<Record<string, number>>({});
  const [subiendoCargoId, setSubiendoCargoId] = useState<string | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [realChatMessages, setRealChatMessages] = useState<Record<string, DbChatMessage[]>>({});
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [adjuntoPreview, setAdjuntoPreview] = useState<{ nombre: string; url: string } | null>(
    null,
  );
  const [liberadoModal, setLiberadoModal] = useState<{ monto: number; ruta: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Solo una tarjeta de "En proceso" expandida a la vez — con varias
  // transacciones de alturas distintas, mostrarlas todas completas genera
  // demasiado ruido visual.
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [retirarModal, setRetirarModal] = useState<{ id: string; ruta: string } | null>(null);
  const [retirando, setRetirando] = useState(false);
  const [reportModal, setReportModal] = useState<{
    id: string;
    role: "buyer" | "seller";
    ruta: string;
    isReal: boolean;
    state: Transaction["state"];
  } | null>(null);
  const [reportMotivo, setReportMotivo] = useState<string>("");
  const [reportDetalle, setReportDetalle] = useState("");
  // Ediciones del formulario de endoso para transacciones REALES — no se
  // escriben a Supabase en cada tecla, solo al enviar (a diferencia del mock,
  // que sí persiste cada cambio localmente en `transactions`).
  const [endosoEdits, setEndosoEdits] = useState<Record<string, Partial<DatosCompradorEndoso>>>({});

  const { data: myTransactionsRaw = [] } = useQuery({
    queryKey: ["transactions", "mine", user?.id],
    queryFn: () => getMyTransactions(user!.id),
    enabled: !!user,
  });
  const realTransactions = myTransactionsRaw.map((tx) => mapDbTransactionToFrontend(tx, user!.id));

  const porRol = [...transactions, ...realTransactions].filter((t) => t.role === tab);
  const enProcesoCount = porRol.filter((t) => !ESTADOS_FINALIZADOS.includes(t.state)).length;
  const finalizadosCount = porRol.filter((t) => ESTADOS_FINALIZADOS.includes(t.state)).length;
  const list = porRol
    .filter((t) =>
      sellerView === "finalizados"
        ? ESTADOS_FINALIZADOS.includes(t.state)
        : !ESTADOS_FINALIZADOS.includes(t.state),
    )
    .sort((a, b) => {
      if (sellerView !== "finalizados") {
        const prioridad = Number(necesitaAccion(b)) - Number(necesitaAccion(a));
        if (prioridad !== 0) return prioridad;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Chat real: solo se carga/suscribe mientras ese chat está abierto, y solo
  // si la transacción es real (las mock siguen viviendo 100% en `transactions`).
  useEffect(() => {
    if (!openChatId) return;
    const isRealTx = myTransactionsRaw.some((tx) => tx.id === openChatId);
    if (!isRealTx) return;

    let cancelled = false;
    getChatMessages(openChatId).then((rows) => {
      if (!cancelled) setRealChatMessages((prev) => ({ ...prev, [openChatId]: rows }));
    });

    const unsubscribe = subscribeToChatMessages(openChatId, (row) => {
      setRealChatMessages((prev) => {
        const existing = prev[openChatId] ?? [];
        if (existing.some((m) => m.id === row.id)) return prev;
        return { ...prev, [openChatId]: [...existing, row] };
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [openChatId, myTransactionsRaw]);

  // Mantiene la última burbuja siempre visible — sin esto, un mensaje nuevo
  // (propio o del otro lado, real o vía realtime) queda oculto bajo el scroll.
  useEffect(() => {
    if (!openChatId) return;
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [openChatId, realChatMessages, transactions]);

  const { data: myFlights = [] } = useQuery({
    queryKey: ["flights", "mine", user?.id],
    queryFn: () => getMyFlights(user!.id),
    enabled: !!user,
  });
  const { data: soldFlightIds = [] } = useQuery({
    queryKey: ["transactions", "sold", user?.id],
    queryFn: () => getSoldFlightIds(user!.id),
    enabled: !!user,
  });

  const publicados = myFlights.filter(
    (f) =>
      f.dbStatus !== "cancelled" && f.dbStatus !== "rechazado" && !soldFlightIds.includes(f.id),
  );
  // Separadas a propósito: "retirados" es una decisión del vendedor, "rechazados"
  // es algo a corregir (admin encontró un problema) — mismo trato antes generaba
  // confusión sobre qué acción tenía sentido en cada caso.
  const retirados = myFlights.filter((f) => f.dbStatus === "cancelled");
  const rechazados = myFlights.filter((f) => f.dbStatus === "rechazado");

  // El tab inicial (arriba) solo conoce las transacciones mock al montar —
  // una notificación real puede apuntar a una transacción real que todavía
  // no había cargado, así que la corrige apenas llega. La tarjeta de una
  // transacción solo existe en el DOM bajo "En proceso" (sellerView), así que
  // si el vendedor estaba viendo Publicados/Retirados, también hay que forzarlo.
  useEffect(() => {
    if (!search.tx) return;
    const real = realTransactions.find((t) => t.id === search.tx);
    if (real && real.role !== tab) setTab(real.role);
    const vistaCorrecta =
      real && ESTADOS_FINALIZADOS.includes(real.state) ? "finalizados" : "proceso";
    if (sellerView !== vistaCorrecta) setSellerView(vistaCorrecta);
  }, [search.tx, realTransactions, tab, sellerView]);

  useEffect(() => {
    if (!search.tx) return;
    const el = document.getElementById(`tx-${search.tx}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(search.tx);
    setExpandedTxId(search.tx);
    if (search.chat) setOpenChatId(search.tx);
    // Limpia tx/chat de la URL una vez que ya cumplieron su función — si se
    // quedan ahí, el efecto de arriba (que corrige sellerView) sigue forzando
    // "En proceso"/"Finalizados" en cada render y bloquea cambiar de sub-tab.
    navigate({ search: { ...search, tx: undefined, chat: undefined }, replace: true });
    const t = window.setTimeout(() => setHighlightId(null), 2000);
    return () => window.clearTimeout(t);
    // myTransactionsRaw: si el tab ya era correcto desde el montaje inicial
    // (heurística de pendienteCount), este efecto corre antes de que lleguen
    // las transacciones reales de Supabase, no encuentra la tarjeta y nunca
    // reintenta — sin esta dependencia, se queda sin hacer nada para siempre.
    //
    // ready: mientras el perfil (fetchProfile en auth-context.tsx) todavía no
    // resuelve, esta página entera muestra <AuthRequiredPlaceholder /> en vez
    // de las cards reales — aunque `user` ya exista y `myTransactionsRaw` ya
    // haya llegado. Si esa carrera se da (el perfil tarda más que las
    // transacciones), el efecto corre antes de que la card exista en el DOM y,
    // sin `ready` como dependencia, nunca se entera de que después sí apareció.
  }, [search.tx, search.chat, tab, myTransactionsRaw, ready]);

  // Notificaciones de aprobación/rechazo de una publicación (no una transacción)
  // apuntan acá — misma idea que el efecto de arriba para "tx", pero resolviendo
  // en qué sub-tab vive el vuelo (Publicados si se aprobó, Retirados si se
  // rechazó) en vez de asumir un valor fijo.
  useEffect(() => {
    if (!search.flight) return;
    if (tab !== "seller") setTab("seller");
    const objetivo = myFlights.find((f) => f.id === search.flight);
    if (objetivo) {
      const vistaCorrecta =
        objetivo.dbStatus === "cancelled" || objetivo.dbStatus === "rechazado"
          ? "retirados"
          : "publicados";
      if (sellerView !== vistaCorrecta) setSellerView(vistaCorrecta);
    }
  }, [search.flight, myFlights, tab, sellerView]);

  useEffect(() => {
    if (!search.flight) return;
    const el = document.getElementById(`flight-${search.flight}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(search.flight);
    navigate({ search: { ...search, flight: undefined }, replace: true });
    const t = window.setTimeout(() => setHighlightId(null), 2000);
    return () => window.clearTimeout(t);
    // myFlights: mismo motivo que con myTransactionsRaw arriba — si sellerView
    // ya era correcto desde el inicio, hay que reintentar cuando lleguen los datos.
    // ready: misma carrera que en el efecto de "tx" — ver ese comentario.
  }, [search.flight, sellerView, myFlights, ready]);

  function updateCargoConfirmado(
    id: string,
    update: Partial<Transaction["cargoAerolineaConfirmado"]>,
  ) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, cargoAerolineaConfirmado: { ...t.cargoAerolineaConfirmado, ...update } }
          : t,
      ),
    );
  }

  function updateDatosCompradorEndoso(t: Transaction, update: Partial<DatosCompradorEndoso>) {
    if (t.isReal) {
      setEndosoEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], ...update } }));
      return;
    }
    setTransactions((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, datosCompradorEndoso: { ...x.datosCompradorEndoso, ...update } }
          : x,
      ),
    );
  }

  // Envía el endoso completo del comprador a Supabase — solo se llama al
  // enviar el formulario, no en cada tecla (a diferencia del mock).
  async function submitDatosCompradorEndoso(t: Transaction, datosEndoso: DatosCompradorEndoso) {
    updateDatosCompradorEndoso(t, { completadoPorComprador: true });
    if (!t.isReal) {
      toast.success("Tus datos fueron enviados al vendedor.");
      return;
    }
    try {
      await updateBuyerTransferData(t.id, { ...datosEndoso, completadoPorComprador: true });
      await queryClient.invalidateQueries({ queryKey: ["transactions", "mine"] });
      toast.success("Tus datos fueron enviados al vendedor.");
    } catch (err) {
      toast.error(
        err instanceof Error ? `No se pudo enviar: ${err.message}` : "No se pudo enviar tus datos.",
      );
    }
  }

  async function advanceState(t: Transaction, state: Transaction["state"]) {
    if (t.isReal) {
      try {
        await updateTransactionState(
          t.id,
          state === "en_disputa"
            ? "disputa"
            : (state as "pago_retenido" | "vendedor_inicia" | "confirmado" | "liberado"),
        );
        await queryClient.invalidateQueries({ queryKey: ["transactions", "mine"] });
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `No se pudo actualizar: ${err.message}`
            : "No se pudo actualizar el estado.",
        );
        throw err;
      }
      return;
    }
    setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, state } : x)));
  }

  // Chat interno ligado a esta transacción específica — nunca WhatsApp ni el teléfono
  // real de nadie. Queda con historial revisable si alguna de las partes reporta un problema.
  function sendChatMensaje(t: Transaction) {
    const texto = (chatDrafts[t.id] ?? "").trim();
    if (!texto) return;
    setChatDrafts({ ...chatDrafts, [t.id]: "" });

    if (t.isReal) {
      sendChatMessage(t.id, user!.id, texto).catch(() => {
        toast.error("No se pudo enviar el mensaje.");
      });
      return;
    }

    setTransactions((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? {
              ...x,
              chatMensajes: [
                ...x.chatMensajes,
                {
                  autor: t.role === "buyer" ? "comprador" : "vendedor",
                  texto,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : x,
      ),
    );
  }

  // Adjuntar un archivo al chat (ej. foto del DNI cuando la aerolínea la exige para el
  // endoso) — sigue visible solo para el vendedor de esta transacción, igual que el resto
  // de sus datos de endoso. En transacciones reales sube el archivo a Storage; en mock
  // vive solo en memoria del navegador vía URL.createObjectURL.
  function sendChatAdjunto(t: Transaction, file: File) {
    if (t.isReal) {
      sendChatAttachment(t.id, user!.id, file)
        .then(() => toast.success("Archivo enviado por chat."))
        .catch(() => toast.error("No se pudo enviar el archivo."));
      return;
    }

    const url = URL.createObjectURL(file);
    setTransactions((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? {
              ...x,
              chatMensajes: [
                ...x.chatMensajes,
                {
                  autor: t.role === "buyer" ? "comprador" : "vendedor",
                  texto: "",
                  timestamp: new Date().toISOString(),
                  adjunto: { nombre: file.name, url },
                },
              ],
            }
          : x,
      ),
    );
    toast.success("Archivo enviado por chat.");
  }

  // Las 3 cards de resumen son globales (no filtran por tab comprador/vendedor),
  // así que deben incluir las transacciones reales igual que `porRol` más abajo —
  // antes solo leían `transactions` (el mock, vacío), por eso siempre daban S/0.
  const allTransactions = [...transactions, ...realTransactions];
  const retained = allTransactions
    .filter((t) => t.state !== "liberado" && t.state !== "reembolsado")
    .reduce((s, t) => s + t.amount, 0);
  const released = allTransactions
    .filter((t) => t.state === "liberado")
    .reduce((s, t) => s + t.amount, 0);

  if (authLoading) return null;
  if (!ready) return <AuthRequiredPlaceholder />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
            Hola, {profile?.first_name}
          </div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-extrabold text-[var(--color-ink)]">
            Mis operaciones
          </h1>
        </div>
        <Link
          to="/publish"
          className="rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          Publicar un pasaje
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card
          icon={<Lock className="h-5 w-5" />}
          label="Retenido en escrow"
          value={S(retained)}
          tone="signal"
        />
        <Card icon={<CheckCircle2 className="h-5 w-5" />} label="Liberado" value={S(released)} />
        <Card
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Transacciones"
          value={String(allTransactions.length)}
        />
      </div>

      <div className="mt-10 inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
        {(["buyer", "seller"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              tab === k
                ? "bg-[var(--color-ink)] text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {k === "buyer" ? <ShoppingBag className="h-4 w-4" /> : <Store className="h-4 w-4" />}
            {k === "buyer" ? "Como comprador" : "Como vendedor"}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["proceso", "En proceso", enProcesoCount],
            ["finalizados", "Finalizados", finalizadosCount],
            ...(tab === "seller"
              ? ([
                  ["publicados", "Publicados", publicados.length],
                  // Solo aparecen si hay algo que mostrar — así la mayoría de
                  // vendedores (sin rechazos) nunca ve una fila de chips más larga.
                  ...(retirados.length > 0
                    ? ([["retirados", "Retirados", retirados.length]] as const)
                    : []),
                  ...(rechazados.length > 0
                    ? ([["rechazados", "Rechazados", rechazados.length]] as const)
                    : []),
                ] as const)
              : []),
          ] as const
        ).map(([v, label, count]) => (
          <button
            key={v}
            onClick={() => setSellerView(v)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
              sellerView === v
                ? "border-[var(--color-primary-token)] bg-[var(--color-primary-token)]/10 text-[var(--color-primary-token)]"
                : "border-border bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1.5">· {count}</span>}
          </button>
        ))}
      </div>

      {tab === "seller" &&
      (sellerView === "publicados" || sellerView === "retirados" || sellerView === "rechazados") ? (
        <div className="mt-8 space-y-5">
          {(sellerView === "publicados"
            ? publicados
            : sellerView === "retirados"
              ? retirados
              : rechazados
          ).length === 0 && (
            <EmptyState
              icon={
                sellerView === "publicados" ? Send : sellerView === "retirados" ? ArchiveX : XCircle
              }
              text={
                sellerView === "publicados"
                  ? "No tienes pasajes publicados esperando comprador ahora mismo."
                  : sellerView === "retirados"
                    ? "No has retirado ninguna publicación."
                    : "No tienes publicaciones rechazadas."
              }
            />
          )}
          {(sellerView === "publicados"
            ? publicados
            : sellerView === "retirados"
              ? retirados
              : rechazados
          ).map((f) => {
            const status = computeStatus(f);
            const tramo = tramoVigente(f);
            const retirado = sellerView === "retirados";
            const rechazado = sellerView === "rechazados";
            const puedeReenviar = rechazado && (f.rejectionCount ?? 0) < 2;
            const enRevision = f.dbStatus === "pendiente_revision";
            return (
              <div
                key={f.id}
                id={`flight-${f.id}`}
                className={`rounded-[2rem] border p-6 shadow-sm transition-all duration-500 md:p-8 ${
                  highlightId === f.id
                    ? "border-[var(--color-primary-token)] ring-2 ring-[var(--color-primary-token)]/40"
                    : retirado
                      ? "border-border bg-gray-50 opacity-70"
                      : "border-border bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      <span
                        className={`rounded-full px-2.5 py-0.5 ${
                          rechazado
                            ? "bg-red-100 text-red-500"
                            : retirado
                              ? "bg-gray-200 text-gray-500"
                              : enRevision
                                ? "bg-gray-100 text-gray-500"
                                : status === "last_call"
                                  ? "bg-[var(--color-warning-token)]/20 text-[var(--color-ink)]"
                                  : "bg-[var(--color-secondary-token)]/10 text-[var(--color-secondary-token)]"
                        }`}
                      >
                        {rechazado
                          ? "Rechazado"
                          : retirado
                            ? "Retirado"
                            : enRevision
                              ? "En revisión"
                              : status === "last_call"
                                ? "Última llamada"
                                : "Publicado · activo"}
                      </span>
                      {f.airline} · <span className="font-mono">{f.flightNumber}</span>
                    </div>
                    <div className="mt-3 font-display text-2xl font-bold text-[var(--color-ink)]">
                      {tramo.origin.city}{" "}
                      <ChevronRight className="mx-1 inline h-5 w-5 text-gray-400" />{" "}
                      {tramo.destination.city}
                    </div>
                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                      {fmtDate(tramo.departureAt)}
                    </div>
                    {rechazado && f.rejectionReason && (
                      <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
                        <span className="font-bold">Motivo: </span>
                        {f.rejectionReason}
                        {f.rejectionDetail && `. ${f.rejectionDetail}`}
                      </div>
                    )}
                    {rechazado && !puedeReenviar && (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-medium text-gray-500">
                        Esta publicación alcanzó el límite de 2 rechazos y ya no se puede editar ni
                        reenviar. Crea una publicación nueva si quieres volver a ofrecer este
                        pasaje.
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <div className="font-mono text-3xl font-bold text-[var(--color-ink)]">
                        {S(f.resalePrice)}
                      </div>
                    </div>
                    {!retirado && (!rechazado || puedeReenviar) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Más opciones"
                            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gray-300 bg-white text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50 after:absolute after:-inset-1 after:content-['']"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            asChild
                            className="focus:bg-surface-2! focus:text-inherit!"
                          >
                            <Link
                              to="/flight/$id"
                              params={{ id: f.id }}
                              search={{ from: "dashboard", vista: "publicados" }}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" /> Ver publicación
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            asChild
                            className="focus:bg-surface-2! focus:text-inherit!"
                          >
                            <Link
                              to="/edit-flight/$id"
                              params={{ id: f.id }}
                              className="flex items-center gap-2"
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />{" "}
                              {rechazado ? "Editar y reenviar" : "Editar"}
                            </Link>
                          </DropdownMenuItem>
                          {!rechazado && (
                            <DropdownMenuItem
                              onClick={() =>
                                setRetirarModal({
                                  id: f.id,
                                  ruta: `${tramo.origin.code} → ${tramo.destination.code}`,
                                })
                              }
                              className="flex items-center gap-2 text-red-500 focus:bg-red-50! focus:text-red-500!"
                            >
                              <Trash2 className="h-4 w-4" /> Retirar publicación
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {!retirado && !rechazado && (
                  <div className="mt-6 grid grid-cols-3 gap-4 border-t border-dashed border-gray-200 pt-6">
                    <div>
                      <div className="font-mono text-2xl font-bold text-[var(--color-ink)]">
                        {f.views}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Vistas
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-2xl font-bold text-[var(--color-ink)]">
                        {f.interested}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Interesados
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 font-mono text-2xl font-bold text-[var(--color-ink)]">
                        <Heart className="h-4 w-4 text-[var(--color-primary-token)]" />
                        {f.savedCount}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Guardados
                      </div>
                    </div>
                  </div>
                )}

                {(retirado || (rechazado && !puedeReenviar)) && (
                  <div className="mt-6 flex items-center gap-3">
                    <Link
                      to="/flight/$id"
                      params={{ id: f.id }}
                      search={{ from: "dashboard", vista: "publicados" }}
                      className="rounded-full border border-gray-300 bg-white px-5 py-2.5 text-xs font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50"
                    >
                      Ver publicación
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8">
          {list.length === 0 && (
            <EmptyState
              icon={sellerView === "finalizados" ? CheckCircle2 : Inbox}
              text={
                sellerView === "finalizados"
                  ? "Todavía no tienes operaciones finalizadas."
                  : "No tienes operaciones en proceso ahora mismo."
              }
            />
          )}

          <div className="space-y-5">
            {list.map((t) => {
              const flight = t.isReal ? t.flight! : flights.find((f) => f.id === t.flightId)!;
              const status = computeStatus(flight);
              const enDisputa = t.state === "en_disputa";
              const stateIdx = stateOrder.indexOf(
                enDisputa && t.estadoAnteriorDisputa ? t.estadoAnteriorDisputa : t.state,
              );
              const tramo = tramoVigente(flight);
              const puedeReportarCargo =
                t.role === "seller" && (t.state === "vendedor_inicia" || t.state === "confirmado");
              const montoSugerido = flight.cargoAerolineaEstimado.monto ?? 0;
              const montoInput = montoInputs[t.id] ?? montoSugerido;
              // Trámite en curso: el pago ya está retenido y la transacción sigue abierta.
              const puedeGestionar =
                t.state !== "liberado" && t.state !== "reembolsado" && !enDisputa;
              // Prellenado desde el perfil real (nombres/apellidos) para no hacer
              // que el comprador reescriba lo que ya dio al registrarse.
              const datosEndoso = t.isReal
                ? {
                    ...t.datosCompradorEndoso,
                    nombres: t.datosCompradorEndoso.nombres || profile?.first_name || "",
                    apellidoPaterno:
                      t.datosCompradorEndoso.apellidoPaterno || profile?.last_name || "",
                    apellidoMaterno:
                      t.datosCompradorEndoso.apellidoMaterno || profile?.apellido_materno || "",
                    ...endosoEdits[t.id],
                  }
                : t.datosCompradorEndoso;
              // Normaliza mensajes mock y reales a un mismo shape para el render del chat.
              const expanded = expandedTxId === t.id;
              // Mock (no isReal) no tiene esta columna — se trata como ya
              // confirmada para no romper el flujo de demo existente.
              const buyerOk = t.isReal ? !!t.buyerConfirmedOk : true;
              const chatBubbles = t.isReal
                ? (realChatMessages[t.id] ?? []).map((m) => ({
                    texto: m.text,
                    timestamp: m.created_at,
                    adjunto: m.attachment_url
                      ? { nombre: m.attachment_name || "Archivo", url: m.attachment_url }
                      : undefined,
                    esMio: m.sender_id === user!.id,
                  }))
                : t.chatMensajes.map((m) => ({
                    texto: m.texto,
                    timestamp: m.timestamp,
                    adjunto: m.adjunto,
                    esMio: m.autor === (t.role === "buyer" ? "comprador" : "vendedor"),
                  }));
              return (
                <div
                  key={t.id}
                  id={`tx-${t.id}`}
                  className={`rounded-[2rem] border bg-white p-6 shadow-sm transition-all duration-500 md:p-8 ${
                    highlightId === t.id
                      ? "border-[var(--color-primary-token)] ring-2 ring-[var(--color-primary-token)]/40"
                      : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedTxId(expanded ? null : t.id)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Ocultar" : "Ver"} detalle de la transacción ${tramo.origin.code} → ${tramo.destination.code}`}
                    className="flex w-full flex-wrap items-start justify-between gap-6 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span
                          className={`rounded-full px-2.5 py-0.5 ${
                            t.role === "buyer"
                              ? "bg-[var(--color-primary-token)]/10 text-[var(--color-primary-token)]"
                              : "bg-gray-100 text-[var(--color-ink)]"
                          }`}
                        >
                          {t.role === "buyer" ? "Compra" : "Venta"}
                        </span>
                        {flight.airline} · <span className="font-mono">{flight.flightNumber}</span>
                        {status === "last_call" && (
                          <span className="text-warning-ink">· última llamada</span>
                        )}
                      </div>
                      <div className="mt-3 font-display text-2xl font-bold text-[var(--color-ink)]">
                        {tramo.origin.city}{" "}
                        <ChevronRight className="inline h-5 w-5 text-gray-400 mx-1" />{" "}
                        {tramo.destination.city}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground mt-1">
                        {fmtDate(tramo.departureAt)}
                        {flight.tipoBoleto === "ida_y_vuelta" &&
                          ` · ${flight.tramoAVender === "ambos" ? "ida y vuelta" : flight.tramoAVender === "regreso" ? "solo regreso" : "solo ida"}`}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <div className="font-mono text-3xl font-bold text-[var(--color-ink)]">
                          {S(t.amount)}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-secondary-token)] mt-1">
                          {stateLabels[t.state]}
                        </div>
                      </div>
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gray-300 bg-white text-[var(--color-ink)] shadow-sm">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <>
                      {/* Timeline */}
                      <div className="mt-8 grid grid-cols-4 gap-2">
                        {stateOrder.map((s, i) => {
                          const done = i <= stateIdx;
                          return (
                            <div key={s} className="flex flex-col items-start gap-2">
                              <div className="flex w-full items-center gap-2">
                                {done ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-secondary-token)]" />
                                ) : (
                                  <Circle className="h-5 w-5 shrink-0 text-gray-200" />
                                )}
                                <div
                                  className={`h-1 flex-1 rounded-full ${
                                    done ? "bg-[var(--color-secondary-token)]" : "bg-gray-100"
                                  }`}
                                />
                              </div>
                              <div
                                className={`text-[11px] font-bold uppercase tracking-wide pr-2 ${
                                  done ? "text-[var(--color-ink)]" : "text-gray-400"
                                }`}
                              >
                                {stateLabels[s]}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {puedeReportarCargo && (
                        <div className="mt-8 border-t border-dashed border-gray-200 pt-8">
                          <div className="text-sm font-bold text-[var(--color-ink)]">
                            ¿La aerolínea te cobró algo por el trámite?
                          </div>
                          <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">
                            Este es el monto real y verificado del endoso. Determina el neto final
                            que se libera del escrow, no el estimado que pusiste al publicar.
                          </p>

                          {t.cargoAerolineaConfirmado.estadoVerificacion === "no_aplica" && (
                            <div className="mt-4 space-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                              <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
                                  Monto que te cobró la aerolínea
                                </span>
                                <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm focus-within:border-[var(--color-primary-token)] focus-within:ring-1 focus-within:ring-[var(--color-primary-token)]">
                                  <span className="text-muted-foreground font-bold">S/</span>
                                  <input
                                    type="number"
                                    className="w-full bg-transparent font-mono font-bold text-[var(--color-ink)] focus:outline-none"
                                    value={montoInput === 0 ? "" : montoInput}
                                    onChange={(e) =>
                                      setMontoInputs({
                                        ...montoInputs,
                                        [t.id]: e.target.value === "" ? 0 : Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                {montoSugerido > 0 && (
                                  <span className="text-[11px] font-medium text-muted-foreground">
                                    Sugerido a partir de tu estimado al publicar: {S(montoSugerido)}
                                  </span>
                                )}
                              </label>
                              <label
                                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-xs font-bold transition-colors ${
                                  montoInput <= 0 || subiendoCargoId === t.id
                                    ? "cursor-not-allowed border-gray-200 text-gray-300"
                                    : "border-gray-300 text-gray-500 hover:border-[var(--color-primary-token)] hover:text-[var(--color-primary-token)]"
                                }`}
                              >
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  disabled={montoInput <= 0 || subiendoCargoId === t.id}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file || !user) return;
                                    setSubiendoCargoId(t.id);
                                    try {
                                      const evidenciaUrl = await uploadCargoEvidence(
                                        user.id,
                                        t.id,
                                        file,
                                      );
                                      const manual = requiereRevisionManual(montoInput, t.amount);
                                      if (t.isReal) {
                                        await reportConfirmedCargo(
                                          t.id,
                                          montoInput,
                                          evidenciaUrl,
                                          manual,
                                        );
                                        queryClient.invalidateQueries({
                                          queryKey: ["transactions", "mine"],
                                        });
                                      } else {
                                        updateCargoConfirmado(t.id, {
                                          monto: montoInput,
                                          origen: "reportado_por_vendedor",
                                          evidenciaUrl,
                                          estadoVerificacion: manual
                                            ? "pendiente_revision"
                                            : "aceptado",
                                          revisionManualRequerida: manual,
                                        });
                                      }
                                      toast.success(
                                        manual
                                          ? "Cargo reportado. Por su monto, requiere revisión manual."
                                          : "Cargo reportado y aceptado. Se incluyó en el neto final.",
                                      );
                                    } catch {
                                      toast.error(
                                        "No se pudo reportar el cargo. Intenta de nuevo.",
                                      );
                                    } finally {
                                      setSubiendoCargoId(null);
                                    }
                                  }}
                                />
                                {subiendoCargoId === t.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Subiendo…
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4" /> Subir evidencia y reportar cargo
                                  </>
                                )}
                              </label>
                            </div>
                          )}

                          {t.cargoAerolineaConfirmado.estadoVerificacion ===
                            "pendiente_revision" && (
                            <div
                              className={`mt-4 rounded-xl border p-4 text-xs font-medium text-[var(--color-ink)] ${
                                t.cargoAerolineaConfirmado.revisionManualRequerida
                                  ? "border-red-300 bg-red-50"
                                  : "border-[var(--color-warning-token)]/50 bg-yellow-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 font-bold">
                                <ShieldAlert className="h-4 w-4" />
                                {t.cargoAerolineaConfirmado.revisionManualRequerida
                                  ? "Requiere revisión manual"
                                  : "Cargo reportado en revisión."}
                              </div>
                              {t.cargoAerolineaConfirmado.revisionManualRequerida && (
                                <div className="mt-1 font-bold text-red-600">
                                  Este monto supera el 50% del precio de venta (S/ {t.amount}). No
                                  se acepta automáticamente aunque tenga evidencia. Un revisor debe
                                  confirmarlo explícitamente.
                                </div>
                              )}
                              <div className="mt-1 text-[var(--color-ink)]/70">
                                Reportaste {S(t.cargoAerolineaConfirmado.monto)}. El neto final solo
                                se recalcula si queda aceptado.
                              </div>
                              {t.isReal ? (
                                <div className="mt-3 border-t border-dashed border-red-300/60 pt-3 text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]/50">
                                  Un revisor de soporte confirmará este monto pronto.
                                </div>
                              ) : (
                                <div
                                  className={`mt-3 flex items-center gap-2 border-t border-dashed pt-3 ${
                                    t.cargoAerolineaConfirmado.revisionManualRequerida
                                      ? "border-red-300/60"
                                      : "border-[var(--color-warning-token)]/40"
                                  }`}
                                >
                                  <span className="self-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink)]/50">
                                    Demo del panel de revisión:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateCargoConfirmado(t.id, {
                                        estadoVerificacion: "aceptado",
                                      });
                                      toast.success("Cargo aceptado. Se incluyó en el neto final.");
                                    }}
                                    className="rounded-full bg-[var(--color-secondary-token)] px-3 py-1 text-[11px] font-bold text-white"
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateCargoConfirmado(t.id, {
                                        monto: 0,
                                        estadoVerificacion: "rechazado",
                                        revisionManualRequerida: false,
                                      });
                                      toast.error(
                                        "No pudimos verificar este cargo con la evidencia proporcionada.",
                                      );
                                    }}
                                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold text-gray-600"
                                  >
                                    Rechazar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {t.cargoAerolineaConfirmado.estadoVerificacion === "aceptado" && (
                            <div className="mt-4 rounded-xl border border-[var(--color-secondary-token)]/40 bg-[var(--color-secondary-token)]/5 p-4 text-xs font-bold text-[var(--color-secondary-token)]">
                              Cargo de {S(t.cargoAerolineaConfirmado.monto)} verificado y aplicado
                              al neto final.
                            </div>
                          )}

                          {t.cargoAerolineaConfirmado.estadoVerificacion === "rechazado" && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-600">
                              No pudimos verificar este cargo con la evidencia proporcionada. Se usó
                              S/ 0.{" "}
                              <button
                                type="button"
                                onClick={() =>
                                  updateCargoConfirmado(t.id, {
                                    estadoVerificacion: "no_aplica",
                                    evidenciaUrl: null,
                                    revisionManualRequerida: false,
                                  })
                                }
                                className="underline"
                              >
                                Reportar de nuevo
                              </button>
                            </div>
                          )}

                          {(() => {
                            const cargoVigente = cargoAerolineaConfirmadoVigente(t);
                            const comisionNormal = comisionPlataforma(t.amount);
                            const comisionAplicada = comisionEfectiva(t.amount, cargoVigente);
                            const comisionReducida = comisionAplicada < comisionNormal;
                            return (
                              <div className="tarjeta-boleto mt-4 p-5 space-y-2">
                                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                  Neto final a liberar
                                </div>
                                <ReceiptRow label="Precio de venta acordado" value={S(t.amount)} />
                                <ReceiptRow
                                  label="Cargo de aerolínea confirmado"
                                  value={`− ${S(cargoVigente)}`}
                                />
                                <ReceiptRow
                                  label={`Comisión Buelazo (${Math.round(PLATFORM_COMMISSION_RATE * 100)}%)`}
                                  value={`− ${S(comisionAplicada)}`}
                                  note={
                                    comisionReducida
                                      ? `Reducida desde ${S(comisionNormal)} para que tu neto nunca quede negativo`
                                      : undefined
                                  }
                                />
                                <div className="flex items-baseline justify-between border-t border-dashed border-gray-200 pt-2">
                                  <span className="text-sm font-bold text-[var(--color-ink)]">
                                    Neto final a liberar
                                  </span>
                                  <span className="font-mono text-xl font-bold text-[var(--color-primary-token)]">
                                    {S(montoNetoFinal(t))}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {puedeGestionar &&
                        t.role === "buyer" &&
                        !datosEndoso.completadoPorComprador && (
                          <div className="mt-8 border-t border-dashed border-gray-200 pt-8">
                            <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                              <IdCard className="h-4 w-4 text-[var(--color-primary-token)]" />
                              El vendedor necesita tus datos para transferirte el pasaje
                            </div>
                            <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">
                              La aerolínea exige identificar al nuevo titular para hacer el endoso.
                              Estos datos solo los ve el vendedor de esta transacción. Nunca se
                              piden por chat.
                            </p>
                            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-muted-foreground leading-relaxed">
                              <span aria-hidden="true">ℹ️</span>
                              El vendedor podría pedirte además una foto de tu documento por el chat
                              interno, si la aerolínea la exige para procesar el endoso.
                            </p>
                            <div className="tarjeta-boleto mt-4 p-5 space-y-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                <EndosoField label="Nombres">
                                  <input
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                                    value={datosEndoso.nombres}
                                    onChange={(e) =>
                                      updateDatosCompradorEndoso(t, { nombres: e.target.value })
                                    }
                                  />
                                </EndosoField>
                                <EndosoField label="Apellido paterno">
                                  <input
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                                    value={datosEndoso.apellidoPaterno}
                                    onChange={(e) =>
                                      updateDatosCompradorEndoso(t, {
                                        apellidoPaterno: e.target.value,
                                      })
                                    }
                                  />
                                </EndosoField>
                                <EndosoField label="Apellido materno">
                                  <input
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                                    value={datosEndoso.apellidoMaterno}
                                    onChange={(e) =>
                                      updateDatosCompradorEndoso(t, {
                                        apellidoMaterno: e.target.value,
                                      })
                                    }
                                  />
                                </EndosoField>
                                <EndosoField label="Tipo de documento">
                                  <select
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                                    value={datosEndoso.tipoDocumento}
                                    onChange={(e) =>
                                      updateDatosCompradorEndoso(t, {
                                        tipoDocumento: e.target.value as TipoDocumento,
                                      })
                                    }
                                  >
                                    <option value="DNI">DNI</option>
                                    <option value="Pasaporte">Pasaporte</option>
                                    <option value="Carné de Extranjería">
                                      Carné de Extranjería
                                    </option>
                                  </select>
                                </EndosoField>
                                <EndosoField label="Número de documento">
                                  <input
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm font-mono font-bold focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                                    inputMode={
                                      datosEndoso.tipoDocumento === "Pasaporte" ? "text" : "numeric"
                                    }
                                    maxLength={DOCUMENTO_MAX_LEN[datosEndoso.tipoDocumento]}
                                    value={datosEndoso.numeroDocumento}
                                    onChange={(e) =>
                                      updateDatosCompradorEndoso(t, {
                                        numeroDocumento: sanitizeNumeroDocumento(
                                          datosEndoso.tipoDocumento,
                                          e.target.value,
                                        ),
                                      })
                                    }
                                  />
                                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                                    {datosEndoso.numeroDocumento.length}/
                                    {DOCUMENTO_MAX_LEN[datosEndoso.tipoDocumento]} dígitos
                                  </p>
                                </EndosoField>
                              </div>
                              <button
                                type="button"
                                onClick={() => submitDatosCompradorEndoso(t, datosEndoso)}
                                disabled={
                                  !datosEndoso.nombres ||
                                  !datosEndoso.apellidoPaterno ||
                                  datosEndoso.numeroDocumento.length !==
                                    DOCUMENTO_MAX_LEN[datosEndoso.tipoDocumento]
                                }
                                className="rounded-full bg-[var(--color-primary-token)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Enviar mis datos al vendedor
                              </button>
                            </div>
                          </div>
                        )}

                      {puedeGestionar &&
                        t.role === "buyer" &&
                        // Solo mientras el trámite sigue en "Pago confirmado" — una vez
                        // que el vendedor avanza a "Vendedor inicia trámite" o más allá,
                        // este aviso ya no aporta nada (los datos ya se usaron) y se
                        // quedaba pegado en pantalla durante el resto del proceso.
                        t.state === "pago_retenido" &&
                        datosEndoso.completadoPorComprador && (
                          <div className="mt-8 flex items-center gap-2 rounded-xl border border-[var(--color-secondary-token)]/40 bg-[var(--color-secondary-token)]/5 p-4 text-xs font-bold text-[var(--color-secondary-token)]">
                            <IdCard className="h-4 w-4" /> Ya enviaste tus datos de endoso al
                            vendedor.
                          </div>
                        )}

                      {puedeGestionar &&
                        t.role === "buyer" &&
                        t.state === "confirmado" &&
                        !buyerOk && (
                          <div className="mt-8 rounded-2xl border border-[var(--color-primary-token)]/30 bg-[var(--color-primary-token)]/5 p-5">
                            <div className="text-sm font-bold text-[var(--color-ink)]">
                              ¿Ya revisaste tu pasaje y está todo correcto?
                            </div>
                            <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">
                              Revisa el ticket o la app de la aerolínea antes de confirmar. Recién
                              después de tu confirmación el vendedor puede liberar el pago retenido.
                            </p>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await confirmBuyerOk(t.id);
                                  queryClient.invalidateQueries({
                                    queryKey: ["transactions", "mine"],
                                  });
                                  toast.success(
                                    "Confirmado. El vendedor ya puede liberar el pago.",
                                  );
                                } catch {
                                  toast.error("No se pudo confirmar. Intenta de nuevo.");
                                }
                              }}
                              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Todo OK, liberar pago
                            </button>
                          </div>
                        )}

                      {puedeGestionar && t.role === "seller" && (
                        <div className="mt-8 border-t border-dashed border-gray-200 pt-8">
                          <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                            <IdCard className="h-4 w-4 text-[var(--color-primary-token)]" />
                            Datos del comprador para el endoso
                          </div>
                          {datosEndoso.completadoPorComprador ? (
                            <>
                              <dl className="mt-4 grid gap-3 rounded-xl border border-border bg-gray-50 p-4 text-xs sm:grid-cols-2">
                                <EndosoReadItem
                                  label="Nombre completo"
                                  value={`${datosEndoso.nombres} ${datosEndoso.apellidoPaterno} ${datosEndoso.apellidoMaterno}`.trim()}
                                />
                                <EndosoReadItem
                                  label="Documento"
                                  value={`${datosEndoso.tipoDocumento} ${datosEndoso.numeroDocumento}`}
                                />
                              </dl>
                              {t.state === "pago_retenido" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    advanceState(t, "vendedor_inicia");
                                    toast.success("Trámite iniciado con la aerolínea.");
                                  }}
                                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                                >
                                  <PlaneTakeoff className="h-4 w-4" /> Iniciar trámite con la
                                  aerolínea
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs font-medium text-muted-foreground">
                              Esperando a que el comprador complete sus datos para el endoso.
                            </p>
                          )}
                        </div>
                      )}

                      {puedeGestionar && t.role === "seller" && t.state === "vendedor_inicia" && (
                        <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-secondary-token)]/30 bg-[var(--color-secondary-token)]/5 p-5">
                          <div>
                            <div className="text-sm font-bold text-[var(--color-ink)]">
                              ¿La aerolínea ya confirmó el traspaso?
                            </div>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              Márcalo cuando tengas la confirmación oficial del endoso.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              advanceState(t, "confirmado");
                              toast.success("Traspaso confirmado por la aerolínea.");
                            }}
                            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Confirmar traspaso
                          </button>
                        </div>
                      )}

                      {puedeGestionar &&
                        t.role === "seller" &&
                        t.state === "confirmado" &&
                        !buyerOk && (
                          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
                            <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-bold text-[var(--color-ink)]">
                                Esperando confirmación del comprador
                              </div>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Podrás liberar tu pago apenas el comprador confirme que revisó el
                                pasaje/evidencia y está todo bien.
                              </p>
                            </div>
                          </div>
                        )}

                      {puedeGestionar &&
                        t.role === "seller" &&
                        t.state === "confirmado" &&
                        buyerOk &&
                        (metodoCobro ? (
                          <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-primary-token)]/30 bg-[var(--color-primary-token)]/5 p-5">
                            <div>
                              <div className="text-sm font-bold text-[var(--color-ink)]">
                                Traspaso confirmado: listo para liberar tu pago
                              </div>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                El neto final ({S(montoNetoFinal(t))}) se transferirá a tu cuenta.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                advanceState(t, "liberado");
                                setLiberadoModal({
                                  monto: montoNetoFinal(t),
                                  ruta: `${tramoVigente(flight).origin.code} → ${tramoVigente(flight).destination.code}`,
                                });
                              }}
                              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                            >
                              <Lock className="h-4 w-4" /> Liberar pago retenido
                            </button>
                          </div>
                        ) : (
                          <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-warning-token)]/50 bg-[var(--color-warning-token)]/10 p-5">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                                <AlertTriangle className="h-4 w-4 text-warning-ink" />
                                Configura cómo recibir tu pago
                              </div>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Falta tu Yape o cuenta bancaria para poder liberar el neto (
                                {S(montoNetoFinal(t))}) de esta venta.
                              </p>
                            </div>
                            <Link
                              to="/profile"
                              search={{ tab: "preferencias" }}
                              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                            >
                              Configurar
                            </Link>
                          </div>
                        ))}

                      <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                          to="/flight/$id"
                          params={{ id: flight.id }}
                          search={{ from: "dashboard", tx: t.id }}
                          className="rounded-full border border-gray-300 bg-white px-5 py-2.5 text-xs font-bold text-[var(--color-ink)] hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          Ver detalle
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOpenChatId(openChatId === t.id ? null : t.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-xs font-bold text-[var(--color-ink)] hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Contactar{" "}
                          {t.role === "buyer" ? "vendedor" : "comprador"}
                          {chatBubbles.length > 0 && (
                            <span className="ml-0.5 rounded-full bg-[var(--color-primary-token)]/10 px-1.5 text-[10px] text-[var(--color-primary-token)]">
                              {chatBubbles.length}
                            </span>
                          )}
                        </button>
                        {t.state !== "liberado" && t.state !== "reembolsado" && !enDisputa && (
                          <button
                            type="button"
                            onClick={() => {
                              setReportModal({
                                id: t.id,
                                role: t.role,
                                ruta: `${tramo.origin.code} → ${tramo.destination.code}`,
                                isReal: !!t.isReal,
                                state: t.state,
                              });
                              setReportMotivo("");
                              setReportDetalle("");
                            }}
                            className="rounded-full bg-transparent px-5 py-2.5 text-xs font-bold text-muted-foreground hover:text-gray-900 transition-colors ml-auto"
                          >
                            Reportar problema
                          </button>
                        )}
                        {enDisputa && (
                          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-xs font-bold text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Soporte está revisando · pago
                            en pausa
                          </span>
                        )}
                      </div>

                      {enDisputa && t.isReal && t.role === "seller" && (
                        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                          <p className="text-xs font-medium text-red-600 leading-relaxed">
                            Sin panel de soporte todavía. Si ya confirmaste con la aerolínea que el
                            cambio no procede, marca el reembolso tú mismo.
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await resolveRefund(t.id);
                                queryClient.invalidateQueries({
                                  queryKey: ["transactions", "mine"],
                                });
                                toast.success("Transacción marcada como reembolsada.");
                              } catch {
                                toast.error("No se pudo marcar el reembolso.");
                              }
                            }}
                            className="shrink-0 rounded-full bg-red-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                          >
                            Marcar como reembolsado
                          </button>
                        </div>
                      )}

                      {openChatId === t.id && (
                        <div className="mt-4 rounded-2xl border border-border bg-gray-50 p-4">
                          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            Chat interno de la transacción: nunca WhatsApp ni tu teléfono real
                          </div>
                          <div
                            ref={chatScrollRef}
                            className="mt-3 max-h-64 space-y-2 overflow-y-auto"
                          >
                            {chatBubbles.length === 0 && (
                              <div className="text-xs font-medium text-muted-foreground">
                                Todavía no hay mensajes. Escribe el primero.
                              </div>
                            )}
                            {chatBubbles.map((m, i) => (
                              <div
                                key={i}
                                className={`flex ${m.esMio ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs font-medium ${
                                    m.esMio
                                      ? "bg-[var(--color-primary-token)] text-white"
                                      : "border border-border bg-white text-[var(--color-ink)]"
                                  }`}
                                >
                                  {m.adjunto ? (
                                    <button
                                      type="button"
                                      onClick={() => setAdjuntoPreview(m.adjunto!)}
                                      className={`flex w-full items-center gap-2 rounded-xl p-2 text-left ${
                                        m.esMio ? "bg-white/15" : "bg-gray-50"
                                      }`}
                                    >
                                      {m.adjunto.nombre.toLowerCase().endsWith(".pdf") ? (
                                        <span
                                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                                            m.esMio ? "bg-white/15" : "bg-white"
                                          }`}
                                        >
                                          <FileText className="h-5 w-5" />
                                        </span>
                                      ) : (
                                        <img
                                          src={m.adjunto.url}
                                          alt={m.adjunto.nombre}
                                          loading="lazy"
                                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                        />
                                      )}
                                      <span className="truncate text-[11px] font-bold underline">
                                        {m.adjunto.nombre}
                                      </span>
                                    </button>
                                  ) : (
                                    m.texto
                                  )}
                                  <div
                                    className={`mt-1 text-[10px] font-bold ${m.esMio ? "text-white/70" : "text-muted-foreground"}`}
                                  >
                                    {fmtTime(m.timestamp)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition-colors hover:bg-gray-50">
                              <Paperclip className="h-4 w-4" />
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) sendChatAdjunto(t, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <input
                              className="w-full rounded-full border border-border bg-white px-4 py-2 text-base sm:text-sm focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                              placeholder="Escribe un mensaje..."
                              value={chatDrafts[t.id] ?? ""}
                              onChange={(e) =>
                                setChatDrafts({ ...chatDrafts, [t.id]: e.target.value })
                              }
                              onKeyDown={(e) => e.key === "Enter" && sendChatMensaje(t)}
                            />
                            <button
                              type="button"
                              onClick={() => sendChatMensaje(t)}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-token)] text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!adjuntoPreview} onOpenChange={(o) => !o && setAdjuntoPreview(null)}>
        <DialogContent className="max-w-2xl">
          {adjuntoPreview && (
            <div className="space-y-4">
              <div className="truncate text-sm font-bold text-[var(--color-ink)]">
                {adjuntoPreview.nombre}
              </div>
              {adjuntoPreview.nombre.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={adjuntoPreview.url}
                  title={adjuntoPreview.nombre}
                  className="h-[70vh] w-full rounded-xl border border-border"
                />
              ) : (
                <img
                  src={adjuntoPreview.url}
                  alt={adjuntoPreview.nombre}
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              )}
              <a
                href={adjuntoPreview.url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-xs font-bold text-[var(--color-ink)] hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> Descargar
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!liberadoModal} onOpenChange={(o) => !o && setLiberadoModal(null)}>
        <DialogContent className="max-w-md overflow-hidden">
          <Confetti active={!!liberadoModal} />
          <div className="py-2 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--color-secondary-token)] text-white">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-extrabold text-[var(--color-ink)]">
              ¡Pago liberado!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirmaste el traspaso de {liberadoModal?.ruta} y liberaste el pago retenido.
            </p>

            <div className="mt-6 flex items-baseline justify-between rounded-2xl border border-border bg-surface-2 p-4 text-left">
              <span className="text-sm font-bold text-[var(--color-ink)]">Monto liberado</span>
              <span className="font-mono text-2xl font-bold text-[var(--color-primary-token)]">
                {S(liberadoModal?.monto ?? 0)}
              </span>
            </div>

            <p className="mt-4 text-xs font-medium text-muted-foreground">
              Suele reflejarse en tu cuenta dentro de las próximas 24 horas hábiles.
            </p>

            <button
              type="button"
              onClick={() => setLiberadoModal(null)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform ease-snappy hover:scale-[1.02] active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!retirarModal} onOpenChange={(o) => !o && setRetirarModal(null)}>
        <DialogContent className="max-w-md">
          <div className="py-2 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-500">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-extrabold text-[var(--color-ink)]">
              ¿Retirar publicación?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {retirarModal?.ruta} dejará de ser visible en el marketplace de inmediato. Quienes lo
              tenían guardado ya no podrán completarlo.
            </p>

            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-xs font-medium text-red-700">
              Esta acción no elimina el historial: podrás verla en "Retirados" dentro de Mis
              operaciones.
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRetirarModal(null)}
                className="flex-1 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={retirando}
                onClick={async () => {
                  if (!retirarModal) return;
                  setRetirando(true);
                  try {
                    await withdrawFlight(retirarModal.id);
                    await queryClient.invalidateQueries({ queryKey: ["flights", "mine"] });
                    toast.success("Publicación retirada.");
                    setRetirarModal(null);
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? `No se pudo retirar: ${err.message}`
                        : "No se pudo retirar la publicación.",
                    );
                  } finally {
                    setRetirando(false);
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform ease-snappy hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              >
                {retirando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArchiveX className="h-4 w-4" />
                )}
                Sí, retirar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportModal} onOpenChange={(o) => !o && setReportModal(null)}>
        <DialogContent className="max-w-md">
          <div className="py-2">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-500">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-center font-display text-2xl font-extrabold text-[var(--color-ink)]">
              Reportar un problema
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {reportModal?.ruta} · el pago retenido queda en pausa mientras revisamos tu caso.
            </p>

            <div className="mt-6 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
                ¿Qué ocurrió?
              </span>
              {(reportModal ? MOTIVOS_REPORTE[reportModal.role] : []).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setReportMotivo(m)}
                  className={`block w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                    reportMotivo === m
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
                Cuéntanos más (opcional)
              </span>
              <textarea
                rows={3}
                maxLength={400}
                value={reportDetalle}
                onChange={(e) => setReportDetalle(e.target.value)}
                placeholder="Agrega cualquier detalle que ayude a resolver el caso más rápido…"
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
            </label>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setReportModal(null)}
                className="flex-1 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reportMotivo}
                onClick={async () => {
                  if (!reportModal) return;
                  if (reportModal.isReal) {
                    try {
                      await reportProblem(
                        reportModal.id,
                        reportModal.state as TransactionState,
                        reportMotivo,
                        reportDetalle,
                      );
                      queryClient.invalidateQueries({ queryKey: ["transactions", "mine"] });
                    } catch {
                      toast.error("No se pudo enviar el reporte.");
                      return;
                    }
                  } else {
                    setTransactions((prev) =>
                      prev.map((t) =>
                        t.id === reportModal.id
                          ? {
                              ...t,
                              estadoAnteriorDisputa: t.state,
                              state: "en_disputa",
                              reporte: {
                                motivo: reportMotivo,
                                detalle: reportDetalle,
                                createdAt: new Date().toISOString(),
                              },
                            }
                          : t,
                      ),
                    );
                  }
                  toast.success(
                    "Reporte enviado. Pausamos el pago retenido mientras revisamos tu caso.",
                  );
                  setReportModal(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform ease-snappy hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              >
                Enviar reporte
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CONFETTI_COLORES = [
  "var(--color-primary-token)",
  "var(--color-secondary-token)",
  "var(--color-warning-token)",
  "var(--color-accent-token)",
];

// Confeti sutil (unos 20 trozos) para el momento de celebración al liberar un
// pago — con gsap, ya usado en el resto de la app, sin agregar una librería
// nueva solo para esto.
function Confetti({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (!active || !containerRef.current) return;
      // Puramente celebratorio — el ícono y el texto de "¡Pago liberado!" ya
      // comunican el éxito sin el confeti, así que quien pide menos movimiento
      // simplemente no lo ve, sin perder ninguna información real.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const container = containerRef.current;
      const piezas: HTMLDivElement[] = [];
      for (let i = 0; i < 20; i++) {
        const el = document.createElement("div");
        const size = 5 + Math.random() * 4;
        el.style.position = "absolute";
        el.style.top = "-10px";
        el.style.left = `${5 + Math.random() * 90}%`;
        el.style.width = `${size}px`;
        el.style.height = `${size * 0.5}px`;
        el.style.borderRadius = "1px";
        el.style.background = CONFETTI_COLORES[i % CONFETTI_COLORES.length];
        el.style.opacity = "0";
        container.appendChild(el);
        piezas.push(el);
      }

      const tl = gsap.timeline();
      piezas.forEach((el, i) => {
        tl.fromTo(
          el,
          { y: 0, opacity: 1, rotation: 0 },
          {
            y: 140 + Math.random() * 60,
            x: (Math.random() - 0.5) * 60,
            rotation: (Math.random() - 0.5) * 360,
            opacity: 0,
            duration: 1.1 + Math.random() * 0.4,
            ease: "power1.in",
          },
          i * 0.02,
        );
      });

      // El revert automático de useGSAP mata el timeline, pero no borra los
      // divs que creamos a mano — eso sigue siendo responsabilidad nuestra.
      return () => {
        piezas.forEach((el) => el.remove());
      };
    },
    { scope: containerRef, dependencies: [active] },
  );

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible"
    />
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-gray-400 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "signal";
}) {
  return (
    <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span
          className={`grid h-10 w-10 place-items-center rounded-full ${
            tone === "signal"
              ? "bg-[var(--color-primary-token)]/10 text-[var(--color-primary-token)]"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {icon}
        </span>
        {label}
      </div>
      <div
        className={`mt-4 font-mono text-4xl font-extrabold ${tone === "signal" ? "text-[var(--color-primary-token)]" : "text-[var(--color-ink)]"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <div className="font-medium text-gray-600">{label}</div>
        {note && <div className="mt-0.5 text-xs font-medium text-muted-foreground">{note}</div>}
      </div>
      <span className="shrink-0 font-mono font-bold text-[var(--color-ink)]">{value}</span>
    </div>
  );
}

function EndosoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function EndosoReadItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-semibold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
