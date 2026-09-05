import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import {
  createFlight,
  uploadFlightVoucher,
  getSimilarActiveResalePrices,
} from "@/lib/services/flights";
import { submitFeatureFeedback, type FeedbackScore } from "@/lib/services/feedback";
import { savePublishDraft, loadPublishDraft, clearPublishDraft } from "@/lib/publish-draft";
import { PublishDraftRecoveryModal } from "@/components/site/publish/PublishDraftRecoveryModal";
import { CompleteDocumentModal } from "@/components/site/auth/CompleteDocumentModal";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Upload,
  Loader2,
  ChevronDown,
  PlaneLanding,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  airportsList,
  airports,
  airlines,
  type AsientoCategoria,
  type Asiento,
  type TramoAVender,
  type TipoDocumento,
} from "@/lib/mock-data";
import {
  PLATFORM_COMMISSION_RATE,
  S,
  asientoLabel,
  tramoAVenderLabel,
  sanitizeNumeroDocumento,
  DOCUMENTO_MAX_LEN,
  FARE_TYPES,
  BAGGAGE_OPTIONS,
  hoursUntil,
  MIN_VIABLE_H,
} from "@/lib/flight-utils";
import { PhoneInput } from "@/components/site/PhoneInput";
import { Field, PillToggle, AsientoFields, ReceiptRow } from "@/components/site/PublishFormFields";
import { LucIAName } from "@/components/site/agent-chat/LucIAName";

// scrollIntoView ignora el header sticky y deja el contenido tapado detrás de
// él — todo scroll programático de esta página calcula el offset a mano
// contra esta misma constante.
const SITE_HEADER_HEIGHT = 56;

// Mismo orden que `primerCampoFaltantePaso0()` (más abajo, dentro de
// `Publish`) — se declara acá afuera porque no depende de ningún estado del
// componente y sirve para saber a qué ref hacer scroll cuando "Continuar"
// falla en el Paso 0.
const CAMPOS_PASO0_ORDEN = [
  "voucher",
  "booking",
  "flightNumber",
  "fareType",
  "origenDestino",
  "date",
  "time",
  "arrivalTime",
  "returnDate",
  "returnTime",
  "returnArrivalTime",
  "nombres",
  "apellidoPaterno",
  "email",
  "telefono",
  "numeroDocumento",
] as const;
type CampoPaso0 = (typeof CAMPOS_PASO0_ORDEN)[number];

export const Route = createFileRoute("/publish")({
  head: () => ({
    meta: [
      { title: "Publicar mi pasaje — Buelazo" },
      {
        name: "description",
        content:
          "Publica tu pasaje aéreo en 2 minutos y recupera hasta el 80% de su valor. Pago retenido hasta confirmar el endoso.",
      },
    ],
  }),
  component: Publish,
});

function Publish() {
  // El Paso 1 (Vuelo) se puede llenar completo sin sesión — recién se pide
  // login/registro al intentar avanzar al Paso 2 (Precio), no antes. Por eso
  // esta ruta ya NO usa useRequireAuth(): esa página entera quedaba detrás
  // de un login inmediato, que es justo lo que este cambio reemplaza.
  const { user, profile } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  // Se activa cuando se pidió login desde el botón "Continuar" del Paso 1 —
  // en cuanto `user` pase a existir, se avanza solo al Paso 2 sin que el
  // usuario tenga que volver a tocar "Continuar".
  const pendingAdvanceRef = useRef(false);
  const [showCompleteDocument, setShowCompleteDocument] = useState(false);
  const [step, setStep] = useState(0);
  // El paso más lejano al que ya llegó — el stepper solo deja saltar a pasos
  // que ya se completaron, nunca adelante a uno que todavía no se validó.
  const [maxStepReached, setMaxStepReached] = useState(0);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const stepDirection = useRef(1);
  const isFirstRender = useRef(true);
  // Un elemento por cada campo validable del Paso 0 — permite hacer scroll
  // directo al primero que falte cuando "Continuar" lo rechaza, en vez de
  // solo pintarlo en amarillo y dejar que el usuario lo busque a ojo.
  const fieldRefs = useRef<Partial<Record<CampoPaso0, HTMLElement | null>>>({});

  // Anima la entrada del contenido del paso (fade + slide sutil, con dirección
  // según si se avanzó o retrocedió) y lleva el scroll al inicio del formulario
  // — sin esto, "Continuar" deja al usuario viendo la parte de abajo del paso
  // anterior en vez del inicio del nuevo.
  useGSAP(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      if (!formCardRef.current) return;
      gsap.fromTo(
        formCardRef.current,
        { opacity: 0, x: stepDirection.current * 16 },
        { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" },
      );
      if (titleRef.current) {
        const top =
          titleRef.current.getBoundingClientRect().top + window.scrollY - SITE_HEADER_HEIGHT - 16;
        window.scrollTo({ top, behavior: "smooth" });
      }
    },
    { scope: formCardRef, dependencies: [step] },
  );

  useEffect(() => {
    setMaxStepReached((prev) => Math.max(prev, step));
  }, [step]);

  // Se logueó/registró exitosamente en el modal que se abrió al intentar
  // avanzar del Paso 1 sin sesión — continúa solo al Paso 2, sin que el
  // usuario tenga que hacer clic en "Continuar" de nuevo.
  useEffect(() => {
    if (user && pendingAdvanceRef.current) {
      pendingAdvanceRef.current = false;
      stepDirection.current = 1;
      setStep(1);
      setShowValidation(false);
    }
  }, [user]);

  // Si la sesión se pierde estando ya en Precio (cerró sesión en otra
  // pestaña, expiró el token, etc.), no tiene sentido dejarlo interactuar con
  // ese paso — igual no podría publicar (handlePublicar ya lo bloquea), pero
  // se sentía como un estado roto en vez de volver a pedir sesión con
  // claridad. Los datos no se pierden: sigue siendo el mismo `data`, solo
  // vuelve al Paso 1 para retomar desde el gatillo de login normal.
  //
  // El Paso 3 ("Enviado a revisión") es distinto: el pasaje YA se publicó
  // con éxito, no hay nada que retomar — si cierra sesión ahí, `data` sigue
  // teniendo los mismos datos ya publicados, y volver al Paso 0 con eso
  // prellenado invita a publicarlo de nuevo por error. En ese caso se manda
  // a home en vez de al formulario.
  useEffect(() => {
    if (!user && step > 0) {
      if (step === 3) {
        navigate({ to: "/" });
        return;
      }
      setStep(0);
    }
  }, [user, step, navigate]);

  // Borrador del Paso 1: si al entrar a "Vender vuelos" (con o sin sesión)
  // existe uno guardado, se ofrece recuperarlo antes de mostrar el paso 0
  // vacío — nunca se aplica solo, siempre es una decisión explícita.
  const [draftFound, setDraftFound] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    setDraftFound(loadPublishDraft());
  }, []);

  const [scanning, setScanning] = useState(false);
  const voucherInputRef = useRef<HTMLInputElement | null>(null);
  // Archivo real del comprobante, para subirlo recién en handlePublicar si
  // se seleccionó sin sesión (ver handleVoucherUpload más abajo).
  const voucherFileRef = useRef<File | null>(null);
  const [voucherDragOver, setVoucherDragOver] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [precioTouched, setPrecioTouched] = useState(false);
  // "Continuar" del paso 1 nunca se deshabilita — en vez de bloquear, al
  // intentar avanzar sin completar todo se marcan en amarillo los campos que
  // faltan (sin texto adicional, la interacción es solo visual).
  const [showValidation, setShowValidation] = useState(false);
  const [data, setData] = useState({
    airline: "LATAM",
    flightNumber: "",
    from: "LIM",
    to: "CUZ",
    date: "",
    time: "",
    arrivalTime: "",
    hasReturn: false,
    returnFrom: "CUZ",
    returnTo: "LIM",
    returnDate: "",
    returnTime: "",
    returnArrivalTime: "",
    tramoAVender: "ida" as TramoAVender,
    // Sin prellenar: son montos reales de dinero, no algo que el vendedor
    // deba notar y corregir a mano — mejor forzar que los escriba él mismo
    // (los inputs ya muestran "" cuando el valor es 0).
    original: 0,
    price: 0,
    baggage: "solo cabina",
    fareType: "",
    asientoIdaTipo: "seleccionado" as Asiento["tipo"],
    asientoIdaCategoria: "ventana" as AsientoCategoria | null,
    asientoIdaNumero: "",
    asientoRegresoTipo: "seleccionado" as Asiento["tipo"],
    asientoRegresoCategoria: "ventana" as AsientoCategoria | null,
    asientoRegresoNumero: "",
    booking: "",
    voucherUrl: null as string | null,
    voucherName: "",
    pasajero: {
      nombres: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      email: "",
      telefonoPrefijo: "+51",
      telefono: "",
      tipoDocumento: "DNI" as TipoDocumento,
      numeroDocumento: "",
    },
    cargoEstimado: null as number | null,
    notaVendedor: "",
  });

  const precioMinimo = Math.max(1, Math.ceil(data.original * 0.1));
  const precioMaximo = Math.max(precioMinimo, data.original - 1);

  // Precio de otras publicaciones activas en la misma ruta (y aerolínea, si
  // ya hay suficientes) — dato real de Supabase, no un valor de ejemplo.
  //
  // Otros vendedores pueden tener un precio original distinto al de este
  // vuelo, así que su promedio de reventa puede caer fuera del rango válido
  // para ESTE vendedor (ej. mayor a su propio original). Forzarlo al límite
  // más cercano daba sugerencias absurdas (un descuento de S/1). En vez de
  // eso, si el promedio no es válido para este precio original, se descarta
  // por completo y se usa el punto de partida genérico (48% del original) —
  // igual que cuando no hay ninguna publicación comparable.
  const { data: similarPrices = [] } = useQuery({
    queryKey: ["similar-flight-prices", data.from, data.to, data.airline],
    queryFn: () => getSimilarActiveResalePrices(data.from, data.to, data.airline),
    enabled: !!data.from && !!data.to,
  });
  const marketAvgRaw =
    similarPrices.length > 0
      ? Math.round(similarPrices.reduce((sum, p) => sum + p, 0) / similarPrices.length)
      : null;
  const marketAvg =
    marketAvgRaw !== null && marketAvgRaw >= precioMinimo && marketAvgRaw <= precioMaximo
      ? marketAvgRaw
      : null;
  const suggested = marketAvg ?? Math.round(data.original * 0.48);
  const precioError =
    data.price >= data.original
      ? `El precio de reventa debe ser menor al original (${S(data.original)}). Este no es un marketplace de reventa a la par.`
      : data.price < precioMinimo
        ? `El precio mínimo permitido es ${S(precioMinimo)} (10% del original).`
        : null;

  const comision = Math.round(data.price * PLATFORM_COMMISSION_RATE);
  const cargoEstimadoAplicado = data.cargoEstimado ?? 0;
  const montoNetoEstimado = data.price - cargoEstimadoAplicado - comision;

  const vendeIda = !data.hasReturn || data.tramoAVender === "ida" || data.tramoAVender === "ambos";
  const vendeRegreso =
    data.hasReturn && (data.tramoAVender === "regreso" || data.tramoAVender === "ambos");

  const asientoIda: Asiento =
    data.asientoIdaTipo === "seleccionado"
      ? {
          tipo: "seleccionado",
          categoria: data.asientoIdaCategoria,
          numero: data.asientoIdaNumero || null,
        }
      : { tipo: "aleatorio", categoria: null, numero: null };

  const asientoRegreso: Asiento | null = !vendeRegreso
    ? null
    : data.asientoRegresoTipo === "seleccionado"
      ? {
          tipo: "seleccionado",
          categoria: data.asientoRegresoCategoria,
          numero: data.asientoRegresoNumero || null,
        }
      : { tipo: "aleatorio", categoria: null, numero: null };

  // Tramo cuya salida gobierna la vigencia de la oferta — mismo criterio que
  // `tramoVigente()` en flight-utils.ts: si se vende "regreso", ese tramo
  // manda; cualquier otro caso (incluido "ambos") lo gobierna la ida.
  const tramoVigenteIsoPaso0 =
    data.tramoAVender === "regreso" && data.hasReturn
      ? buildIso(data.returnDate, data.returnTime)
      : buildIso(data.date, data.time);
  // Mismo piso operativo que ya rige publicaciones activas (MIN_VIABLE_H): si
  // la salida del tramo vigente ya está a menos de esas horas de distancia (o
  // ya pasó), no hay margen real para tramitar el endoso con la aerolínea, sin
  // importar qué tan rápido aparezca un comprador — se bloquea directo en la
  // creación, en vez de dejar que la publicación nazca ya inviable y recién
  // se entere el vendedor cuando `computeStatus` la marque "expired".
  const faltaMargenEndoso =
    tramoVigenteIsoPaso0 !== null && hoursUntil(tramoVigenteIsoPaso0) < MIN_VIABLE_H;

  // Único mensaje "qué falta" del paso 0, en orden de prioridad — evita tener
  // que enumerar los ~12 requisitos en la UI a la vez (demasiado ruido) y
  // evita duplicar la lógica de step0Valido, que se deriva de esta función.
  function primerCampoFaltantePaso0(): string | null {
    if (!data.voucherName) return "Falta subir el comprobante de tu reserva.";
    if (data.booking.trim() === "") return "Falta el código de reserva (PNR).";
    if (data.flightNumber.trim() === "") return "Falta el número de vuelo.";
    if (data.fareType.trim() === "") return "Falta el tipo de tarifa.";
    if (data.from === data.to) return "El origen y el destino no pueden ser el mismo aeropuerto.";
    if (data.date === "") return "Falta la fecha del vuelo de ida.";
    if (data.time === "") return "Falta la hora de salida del vuelo de ida.";
    if (data.arrivalTime === "") return "Falta la hora de llegada del vuelo de ida.";
    if (data.hasReturn && data.returnDate === "") return "Falta la fecha del vuelo de regreso.";
    if (data.hasReturn && data.returnTime === "")
      return "Falta la hora de salida del vuelo de regreso.";
    if (data.hasReturn && data.returnArrivalTime === "")
      return "Falta la hora de llegada del vuelo de regreso.";
    if (faltaMargenEndoso)
      return `La salida del tramo que estás vendiendo es en menos de ${MIN_VIABLE_H} horas (o ya pasó) — no queda margen real para tramitar el endoso con la aerolínea.`;
    if (data.pasajero.nombres.trim() === "") return "Falta el nombre del pasajero.";
    if (data.pasajero.apellidoPaterno.trim() === "")
      return "Falta el apellido paterno del pasajero.";
    if (data.pasajero.email.trim() === "") return "Falta el email del pasajero.";
    if (data.pasajero.telefono.trim() === "") return "Falta el teléfono del pasajero.";
    if (data.pasajero.numeroDocumento.length !== DOCUMENTO_MAX_LEN[data.pasajero.tipoDocumento])
      return "Falta completar el número de documento del pasajero.";
    return null;
  }

  const step0Faltante = primerCampoFaltantePaso0();
  const step0Valido = step0Faltante === null;

  // Mismos requisitos que `primerCampoFaltantePaso0`, pero como flags por
  // campo — para poder marcar en amarillo cada input que falta a la vez, en
  // vez de solo el primero. Solo se consultan cuando `showValidation` es true.
  const faltante = {
    voucher: !data.voucherName,
    booking: data.booking.trim() === "",
    flightNumber: data.flightNumber.trim() === "",
    fareType: data.fareType.trim() === "",
    origenDestino: data.from === data.to,
    // El margen de endoso insuficiente se marca sobre la fecha/hora del tramo
    // que efectivamente gobierna la oferta (ver tramoVigenteIsoPaso0) — el
    // mismo aviso amarillo que ya usan estos campos cuando están vacíos.
    date: data.date === "" || (faltaMargenEndoso && data.tramoAVender !== "regreso"),
    time: data.time === "" || (faltaMargenEndoso && data.tramoAVender !== "regreso"),
    arrivalTime: data.arrivalTime === "",
    returnDate:
      (data.hasReturn && data.returnDate === "") ||
      (faltaMargenEndoso && data.tramoAVender === "regreso"),
    returnTime:
      (data.hasReturn && data.returnTime === "") ||
      (faltaMargenEndoso && data.tramoAVender === "regreso"),
    returnArrivalTime: data.hasReturn && data.returnArrivalTime === "",
    nombres: data.pasajero.nombres.trim() === "",
    apellidoPaterno: data.pasajero.apellidoPaterno.trim() === "",
    email: data.pasajero.email.trim() === "",
    telefono: data.pasajero.telefono.trim() === "",
    numeroDocumento:
      data.pasajero.numeroDocumento.length !== DOCUMENTO_MAX_LEN[data.pasajero.tipoDocumento],
  };

  // A qué campo hacer scroll cuando "Continuar" rechaza el Paso 0 — el mismo
  // orden de prioridad que `primerCampoFaltantePaso0()`.
  const primerCampoFaltanteKey: CampoPaso0 | null =
    CAMPOS_PASO0_ORDEN.find((campo) => faltante[campo]) ?? null;

  // El mismo archivo que se sube acá cumple dos funciones: dispara el
  // autocompletado simulado por IA y queda guardado como el comprobante real
  // que un revisor usa para aprobar la publicación — antes se pedía subirlo
  // dos veces (uno acá, otro en un paso "Reserva" aparte) sin necesidad.
  //
  // El Paso 1 se llena completo sin sesión (ver Cambio 3), así que esto ya NO
  // exige `user` — la extracción simulada corre igual. Si todavía no hay
  // sesión, el archivo real se guarda en `voucherFileRef` y se sube recién en
  // handlePublicar, donde la sesión ya está garantizada; `voucherName` (no
  // `voucherUrl`) es la señal de "ya se subió algo" para la validación del
  // paso y la UI del dropzone.
  function finishVoucherExtraction(file: File, voucherUrl: string | null) {
    setData((prev) => ({
      ...prev,
      voucherUrl,
      voucherName: file.name,
      airline: "LATAM",
      flightNumber: "LA 2091",
      booking: prev.booking || "XZK4P9",
      from: "LIM",
      to: "AQP",
      date: new Date(Date.now() + 12 * 86400_000).toISOString().slice(0, 10),
      time: "08:45",
      arrivalTime: "10:20",
      baggage: "23kg incluido",
      pasajero: {
        ...prev.pasajero,
        nombres: prev.pasajero.nombres || "Andrea",
        apellidoPaterno: prev.pasajero.apellidoPaterno || "Salazar",
        apellidoMaterno: prev.pasajero.apellidoMaterno || "Rojas",
      },
    }));
    setScanning(false);
    toast.success("Datos extraídos del voucher", {
      description:
        "Vuelo y pasajero completados. Revisa que todo esté correcto: el email y teléfono no vienen en el voucher, complétalos tú.",
    });
  }

  async function handleVoucherUpload(file: File | undefined) {
    if (!file) return;
    voucherFileRef.current = file;
    setScanning(true);

    if (!user) {
      window.setTimeout(() => finishVoucherExtraction(file, null), 1800);
      return;
    }

    try {
      const voucherUrl = await uploadFlightVoucher(user.id, file);
      window.setTimeout(() => finishVoucherExtraction(file, voucherUrl), 1800);
    } catch {
      setScanning(false);
      toast.error("No se pudo subir el comprobante. Intenta de nuevo.");
    }
  }

  function toggleHasReturn(hasReturn: boolean) {
    setData({
      ...data,
      hasReturn,
      tramoAVender: hasReturn ? "ambos" : "ida",
      returnFrom: hasReturn ? data.to : data.returnFrom,
      returnTo: hasReturn ? data.from : data.returnTo,
    });
  }

  // Valida y arma la fecha/hora de un tramo; null si falta algún dato, en vez de
  // dejar que `new Date(...).toISOString()` reviente con "Invalid time value".
  function buildIso(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null;
    const d = new Date(`${dateStr}T${timeStr}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function handlePublicar() {
    if (!user) {
      toast.error("Necesitas iniciar sesión para publicar.");
      return;
    }
    if (user.id.startsWith("sim-")) {
      toast.error(
        "Esta sesión es simulada. Publicar un pasaje real requiere iniciar sesión con una cuenta real de Supabase. Cierra sesión y vuelve a entrar con esa cuenta.",
      );
      return;
    }

    if (data.from === data.to) {
      toast.error("El origen y el destino no pueden ser el mismo aeropuerto.");
      setStep(0);
      return;
    }

    const departureIso = buildIso(data.date, data.time);
    if (!departureIso) {
      toast.error("Falta la fecha y hora de salida del vuelo de ida.");
      setStep(0);
      return;
    }
    const returnIso = data.hasReturn ? buildIso(data.returnDate, data.returnTime) : null;
    if (data.hasReturn && !returnIso) {
      toast.error("Falta la fecha y hora de salida del vuelo de vuelta.");
      setStep(0);
      return;
    }
    // Red de seguridad: el Paso 0 ya bloquea esto al momento de llenarlo, pero
    // el vendedor puede tardarse llenando Precio y Revisión — si el margen se
    // agotó mientras tanto, no se debe dejar publicar igual.
    const vigenteIso =
      data.tramoAVender === "regreso" && data.hasReturn ? (returnIso ?? departureIso) : departureIso;
    if (hoursUntil(vigenteIso) < MIN_VIABLE_H) {
      toast.error(
        `La salida del tramo que vendes ya está a menos de ${MIN_VIABLE_H} horas — no queda margen para gestionar el endoso. Actualiza la fecha/hora en el Paso 1.`,
      );
      setStep(0);
      return;
    }

    setPublicando(true);
    try {
      // Si el comprobante se seleccionó en el Paso 1 sin sesión, todavía no
      // se subió a Supabase (voucherUrl quedó en null) — se sube recién acá,
      // ya con sesión garantizada.
      let voucherUrl = data.voucherUrl;
      if (!voucherUrl && voucherFileRef.current) {
        voucherUrl = await uploadFlightVoucher(user.id, voucherFileRef.current);
      }

      await createFlight({
        ticket_type: data.hasReturn ? "ida_y_vuelta" : "solo_ida",
        origin_code: data.from,
        origin_city: airportsList.find((a) => a.code === data.from)?.city ?? data.from,
        destination_code: data.to,
        destination_city: airportsList.find((a) => a.code === data.to)?.city ?? data.to,
        departure_date: departureIso,
        return_date: returnIso,
        sell_segment: data.tramoAVender,
        airline: data.airline,
        booking_code: data.flightNumber,
        original_price: data.original,
        resale_price: data.price,
        seat_outbound: vendeIda ? asientoIda : null,
        seat_return: vendeRegreso ? asientoRegreso : null,
        baggage: data.baggage,
        fare_type: data.fareType,
        airline_fee_estimate: data.cargoEstimado,
        status: "pendiente_revision",
        seller_id: user.id,
        reservation_code: data.booking,
        voucher_url: voucherUrl,
        seller_note: data.notaVendedor.trim() || null,
      });
      clearPublishDraft();
      setStep(3);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : null;
      toast.error(message ? `No se pudo publicar: ${message}` : "No se pudo publicar el pasaje.");
    } finally {
      setPublicando(false);
    }
  }

  function rutaLabel() {
    if (!data.hasReturn || data.tramoAVender === "ida") return `${data.from} → ${data.to}`;
    if (data.tramoAVender === "regreso") return `${data.returnFrom} → ${data.returnTo}`;
    return `${data.from} → ${data.to} → ${data.returnFrom}`;
  }

  const steps = ["Vuelo", "Precio", "Listo"];

  if (step === 3) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-[2rem] border border-border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--color-secondary-token)] text-white">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-extrabold text-[var(--color-ink)]">
            Enviado a revisión
          </h1>
          <p className="mt-3 text-sm font-medium text-muted-foreground leading-relaxed">
            Un revisor confirmará tu boleto antes de que aparezca en el marketplace. Normalmente
            toma poco tiempo. Puedes seguir el estado desde "Mis operaciones" → Publicados.
          </p>
          <div className="mt-8 inline-flex items-baseline gap-2 rounded-2xl bg-surface-2 px-6 py-4">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Precio publicado
            </span>
            <span className="font-mono text-2xl font-bold text-[var(--color-primary-token)]">
              {S(data.price)}
            </span>
          </div>

          <PriceSuggestionCsat suggested={suggested} used={data.price === suggested} />

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              to="/dashboard"
              search={{ vista: "publicados" }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
            >
              Ir a mis operaciones <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-100 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Ver marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <PublishDraftRecoveryModal
        open={!!draftFound}
        onDiscard={() => {
          clearPublishDraft();
          setDraftFound(null);
        }}
        onRecover={() => {
          if (draftFound) setData((prev) => ({ ...prev, ...draftFound }));
          setDraftFound(null);
        }}
      />
      <CompleteDocumentModal
        open={showCompleteDocument}
        onDone={() => {
          setShowCompleteDocument(false);
          stepDirection.current = 1;
          setStep(1);
          setShowValidation(false);
        }}
      />
      <div
        ref={titleRef}
        className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-token)]"
      >
        Publicar pasaje
      </div>
      <h1 className="mt-2 font-display text-4xl md:text-5xl font-extrabold text-[var(--color-ink)]">
        Convierte tu vuelo en dinero de vuelta.
      </h1>
      <p className="mt-4 text-sm font-medium leading-snug text-muted-foreground">
        <LucIAName /> te acompaña: lee tu comprobante por ti y te sugiere un precio competitivo.
      </p>

      {/* Stepper */}
      <div className="mt-10 flex items-center gap-2">
        {steps.map((s, i) => {
          const alcanzable = i <= maxStepReached && i !== step;
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!alcanzable}
                onClick={() => {
                  stepDirection.current = i > step ? 1 : -1;
                  setStep(i);
                }}
                className={`flex shrink-0 items-center gap-2 transition-opacity ${
                  alcanzable ? "cursor-pointer hover:opacity-70" : "cursor-default"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                    i <= step
                      ? "bg-[var(--color-ink)] text-white"
                      : "border border-border bg-white text-gray-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`hidden text-xs font-bold uppercase tracking-wider sm:block ${
                    i === step ? "text-[var(--color-ink)]" : "text-gray-400"
                  }`}
                >
                  {s}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 rounded-full ${i < step ? "bg-[var(--color-ink)]" : "bg-white"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        ref={formCardRef}
        className="mt-10 rounded-[2rem] border border-border bg-white p-6 md:p-10 shadow-sm"
      >
        {step === 0 && (
          <div className="space-y-10">
            <div className="space-y-6">
              <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
                Información del vuelo
              </h2>

              <div
                ref={(el) => {
                  fieldRefs.current.voucher = el;
                }}
                className="flex flex-col gap-2"
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
                  Comprobante de reserva
                  <span className="ml-0.5 text-[var(--color-primary-token)]">*</span>
                </span>
                <p className="-mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                  No hace falta un PDF formal: sirve una foto o captura del correo de
                  confirmación de la aerolínea, o de la reserva vista en su web o app.
                </p>
                <div
                  onClick={() => {
                    if (!scanning) voucherInputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!scanning) setVoucherDragOver(true);
                  }}
                  onDragLeave={() => setVoucherDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setVoucherDragOver(false);
                    if (!scanning) handleVoucherUpload(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 transition-colors ${
                    scanning
                      ? "border-[var(--color-accent-token)]/40 bg-[var(--color-accent-token)]/5"
                      : data.voucherName
                        ? "border-[var(--color-secondary-token)] bg-[var(--color-secondary-token)]/5"
                        : voucherDragOver
                          ? "border-[var(--color-accent-token)] bg-[var(--color-accent-token)]/10"
                          : showValidation && faltante.voucher
                            ? "border-[var(--color-warning-token)] bg-[var(--color-warning-token)]/10"
                            : "border-border bg-surface-2 hover:border-[var(--color-accent-token)]/40"
                  }`}
                >
                  <input
                    ref={voucherInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={scanning}
                    onChange={(e) => {
                      handleVoucherUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                      data.voucherName && !scanning
                        ? "bg-[var(--color-secondary-token)]/10 text-[var(--color-secondary-token)]"
                        : "bg-[var(--color-accent-token)]/10 text-[var(--color-accent-token)]"
                    }`}
                  >
                    {scanning ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : data.voucherName ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {scanning ? (
                      <>
                        <div className="text-sm font-bold text-[var(--color-ink)]">
                          <LucIAName /> está leyendo tu comprobante…
                        </div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Extrayendo aerolínea, vuelo, ruta y horarios del voucher.
                        </p>
                      </>
                    ) : data.voucherName ? (
                      <>
                        <div className="text-sm font-bold text-[var(--color-ink)]">
                          {data.voucherName || "Comprobante subido"}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Un revisor lo confirma antes de publicar. Toca para reemplazarlo.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-medium leading-relaxed text-[var(--color-ink)]">
                        <Sparkles className="mr-1 inline h-3.5 w-3.5 text-[var(--color-accent-token)]" />
                        Arrastra una foto o captura aquí o{" "}
                        <span className="font-bold text-[var(--color-primary-token)] underline underline-offset-2">
                          selecciona un archivo
                        </span>
                        .{" "}
                        <span className="text-muted-foreground">
                          Completamos los datos del vuelo y del pasajero por ti, y queda como
                          respaldo para la revisión.
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Field
                label="Código de reserva (PNR)"
                required
                warning={showValidation && faltante.booking}
                fieldRef={(el) => {
                  fieldRefs.current.booking = el;
                }}
              >
                <input
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-mono font-bold uppercase tracking-widest focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                  placeholder="ABC123"
                  value={data.booking}
                  onChange={(e) => setData({ ...data, booking: e.target.value.toUpperCase() })}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Aerolínea">
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                      value={data.airline}
                      onChange={(e) => {
                        const airline = e.target.value as (typeof airlines)[number];
                        setData({
                          ...data,
                          airline,
                          // La tarifa y el equipaje son catálogos por aerolínea — al
                          // cambiar de aerolínea, el valor anterior puede no existir
                          // en el nuevo catálogo, así que se reinicia al primero.
                          fareType: "",
                          baggage: BAGGAGE_OPTIONS[airline][0].value,
                        });
                      }}
                    >
                      {airlines.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
                <Field
                  label="Número de vuelo"
                  warning={showValidation && faltante.flightNumber}
                  fieldRef={(el) => {
                    fieldRefs.current.flightNumber = el;
                  }}
                >
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    placeholder="LA 2043"
                    value={data.flightNumber}
                    onChange={(e) => setData({ ...data, flightNumber: e.target.value })}
                  />
                </Field>
                <Field
                  label="Tipo de tarifa"
                  warning={showValidation && faltante.fareType}
                  fieldRef={(el) => {
                    fieldRefs.current.fareType = el;
                  }}
                >
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                      value={data.fareType}
                      onChange={(e) => setData({ ...data, fareType: e.target.value })}
                    >
                      <option value="">Selecciona una tarifa</option>
                      {FARE_TYPES[data.airline as (typeof airlines)[number]].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
                <Field label="Equipaje">
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                      value={data.baggage}
                      onChange={(e) => setData({ ...data, baggage: e.target.value })}
                    >
                      {BAGGAGE_OPTIONS[data.airline as (typeof airlines)[number]].map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
              </div>

              <div className="rounded-2xl border border-border bg-gray-50 p-6 space-y-5">
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">
                  Tramo de ida
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Origen"
                    warning={showValidation && faltante.origenDestino}
                    fieldRef={(el) => {
                      fieldRefs.current.origenDestino = el;
                    }}
                  >
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                        value={data.from}
                        onChange={(e) =>
                          setData({
                            ...data,
                            from: e.target.value,
                            returnTo: data.hasReturn ? e.target.value : data.returnTo,
                          })
                        }
                      >
                        {airportsList.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.city} ({a.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </Field>
                  <Field label="Destino" warning={showValidation && faltante.origenDestino}>
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                        value={data.to}
                        onChange={(e) =>
                          setData({
                            ...data,
                            to: e.target.value,
                            returnFrom: data.hasReturn ? e.target.value : data.returnFrom,
                          })
                        }
                      >
                        {airportsList.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.city} ({a.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </Field>
                  <Field
                    label="Fecha"
                    warning={showValidation && faltante.date}
                    fieldRef={(el) => {
                      fieldRefs.current.date = el;
                    }}
                  >
                    <input
                      type="date"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                      value={data.date}
                      onChange={(e) => setData({ ...data, date: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-5">
                    <Field
                      label="Hora salida"
                      warning={showValidation && faltante.time}
                      fieldRef={(el) => {
                        fieldRefs.current.time = el;
                      }}
                    >
                      <input
                        type="time"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                        value={data.time}
                        onChange={(e) => setData({ ...data, time: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="Hora llegada"
                      warning={showValidation && faltante.arrivalTime}
                      fieldRef={(el) => {
                        fieldRefs.current.arrivalTime = el;
                      }}
                    >
                      <input
                        type="time"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                        value={data.arrivalTime}
                        onChange={(e) => setData({ ...data, arrivalTime: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <Field label="¿Boleto de regreso?">
                <div className="inline-flex self-start rounded-full border border-border bg-white p-1 shadow-sm">
                  <PillToggle
                    active={!data.hasReturn}
                    onClick={() => toggleHasReturn(false)}
                    label="No"
                  />
                  <PillToggle
                    active={data.hasReturn}
                    onClick={() => toggleHasReturn(true)}
                    label="Sí"
                  />
                </div>
              </Field>

              {data.hasReturn && (
                <div className="rounded-2xl border border-border bg-gray-50 p-6 space-y-5">
                  <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]">
                    Tramo de regreso
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-bold text-[var(--color-ink)]">
                      <PlaneLanding className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {airports[data.returnFrom]?.city ?? data.returnFrom} ({data.returnFrom}) →{" "}
                      {airports[data.returnTo]?.city ?? data.returnTo} ({data.returnTo})
                      <span className="ml-auto text-xs font-medium text-muted-foreground">
                        mismo origen y destino que la ida, invertidos
                      </span>
                    </div>
                    <Field
                      label="Fecha"
                      warning={showValidation && faltante.returnDate}
                      fieldRef={(el) => {
                        fieldRefs.current.returnDate = el;
                      }}
                    >
                      <input
                        type="date"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                        value={data.returnDate}
                        onChange={(e) => setData({ ...data, returnDate: e.target.value })}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-5">
                      <Field
                        label="Hora salida"
                        warning={showValidation && faltante.returnTime}
                        fieldRef={(el) => {
                          fieldRefs.current.returnTime = el;
                        }}
                      >
                        <input
                          type="time"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                          value={data.returnTime}
                          onChange={(e) => setData({ ...data, returnTime: e.target.value })}
                        />
                      </Field>
                      <Field
                        label="Hora llegada"
                        warning={showValidation && faltante.returnArrivalTime}
                        fieldRef={(el) => {
                          fieldRefs.current.returnArrivalTime = el;
                        }}
                      >
                        <input
                          type="time"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                          value={data.returnArrivalTime}
                          onChange={(e) => setData({ ...data, returnArrivalTime: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {data.hasReturn && (
              <div className="space-y-4 border-t border-dashed border-gray-200 pt-8">
                <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
                  Tu oferta de venta
                </h2>
                <Field label="¿Qué tramo(s) estás vendiendo en esta oferta?">
                  <p className="mb-2 text-xs font-medium text-muted-foreground leading-relaxed">
                    Una sola oferta, para un solo comprador. Afecta el precio y la vigencia del
                    endoso.
                  </p>
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
              </div>
            )}

            <div className="space-y-6 border-t border-dashed border-gray-200 pt-8">
              <div>
                <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
                  Información de asiento
                </h2>
                <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed">
                  Con asiento aleatorio, la aerolínea recién lo asigna en el boarding pass, el mismo
                  momento en que se cierra la ventana del endoso. Por eso se define ahora, sin
                  dejarlo pendiente.
                </p>
              </div>
              {vendeIda && (
                <AsientoFields
                  title={data.hasReturn ? "Asiento de ida" : undefined}
                  tipo={data.asientoIdaTipo}
                  categoria={data.asientoIdaCategoria}
                  numero={data.asientoIdaNumero}
                  onTipoChange={(t) => setData({ ...data, asientoIdaTipo: t })}
                  onCategoriaChange={(c) => setData({ ...data, asientoIdaCategoria: c })}
                  onNumeroChange={(v) => setData({ ...data, asientoIdaNumero: v })}
                />
              )}

              {vendeRegreso && (
                <div className={vendeIda ? "border-t border-dashed border-gray-200 pt-6" : ""}>
                  <AsientoFields
                    title="Asiento de vuelta"
                    tipo={data.asientoRegresoTipo}
                    categoria={data.asientoRegresoCategoria}
                    numero={data.asientoRegresoNumero}
                    onTipoChange={(t) => setData({ ...data, asientoRegresoTipo: t })}
                    onCategoriaChange={(c) => setData({ ...data, asientoRegresoCategoria: c })}
                    onNumeroChange={(v) => setData({ ...data, asientoRegresoNumero: v })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-6 border-t border-dashed border-gray-200 pt-8">
              <div>
                <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
                  Datos del pasajero
                </h2>
                <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed">
                  El titular actual del boleto (no el futuro comprador). Los necesitamos para el
                  trámite de endoso con la aerolínea más adelante.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Nombres"
                  required
                  warning={showValidation && faltante.nombres}
                  fieldRef={(el) => {
                    fieldRefs.current.nombres = el;
                  }}
                >
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    value={data.pasajero.nombres}
                    onChange={(e) =>
                      setData({ ...data, pasajero: { ...data.pasajero, nombres: e.target.value } })
                    }
                  />
                </Field>
                <Field
                  label="Apellido paterno"
                  required
                  warning={showValidation && faltante.apellidoPaterno}
                  fieldRef={(el) => {
                    fieldRefs.current.apellidoPaterno = el;
                  }}
                >
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    value={data.pasajero.apellidoPaterno}
                    onChange={(e) =>
                      setData({
                        ...data,
                        pasajero: { ...data.pasajero, apellidoPaterno: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Apellido materno">
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    value={data.pasajero.apellidoMaterno}
                    onChange={(e) =>
                      setData({
                        ...data,
                        pasajero: { ...data.pasajero, apellidoMaterno: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field
                  label="Email"
                  required
                  warning={showValidation && faltante.email}
                  fieldRef={(el) => {
                    fieldRefs.current.email = el;
                  }}
                >
                  <input
                    type="email"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    value={data.pasajero.email}
                    onChange={(e) =>
                      setData({ ...data, pasajero: { ...data.pasajero, email: e.target.value } })
                    }
                  />
                </Field>
                <Field
                  label="Teléfono"
                  required
                  warning={showValidation && faltante.telefono}
                  fieldRef={(el) => {
                    fieldRefs.current.telefono = el;
                  }}
                >
                  <PhoneInput
                    prefijo={data.pasajero.telefonoPrefijo}
                    numero={data.pasajero.telefono}
                    onChange={(telefonoPrefijo, telefono) =>
                      setData({
                        ...data,
                        pasajero: { ...data.pasajero, telefonoPrefijo, telefono },
                      })
                    }
                  />
                </Field>
                <Field label="Tipo de documento">
                  <div className="relative">
                    <select
                      value={data.pasajero.tipoDocumento}
                      onChange={(e) => {
                        const nuevoTipo = e.target.value as TipoDocumento;
                        setData({
                          ...data,
                          pasajero: {
                            ...data.pasajero,
                            tipoDocumento: nuevoTipo,
                            numeroDocumento: data.pasajero.numeroDocumento.slice(
                              0,
                              DOCUMENTO_MAX_LEN[nuevoTipo],
                            ),
                          },
                        });
                      }}
                      className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-4 pr-10 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    >
                      <option value="DNI">DNI</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Carné de Extranjería">Carné de Extranjería</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
                <Field
                  label="Número de documento"
                  required
                  warning={showValidation && faltante.numeroDocumento}
                  fieldRef={(el) => {
                    fieldRefs.current.numeroDocumento = el;
                  }}
                >
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-mono font-bold focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                    inputMode={data.pasajero.tipoDocumento === "Pasaporte" ? "text" : "numeric"}
                    maxLength={DOCUMENTO_MAX_LEN[data.pasajero.tipoDocumento]}
                    value={data.pasajero.numeroDocumento}
                    onChange={(e) =>
                      setData({
                        ...data,
                        pasajero: {
                          ...data.pasajero,
                          numeroDocumento: sanitizeNumeroDocumento(
                            data.pasajero.tipoDocumento,
                            e.target.value,
                          ),
                        },
                      })
                    }
                  />
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {data.pasajero.numeroDocumento.length}/
                    {DOCUMENTO_MAX_LEN[data.pasajero.tipoDocumento]} dígitos
                  </p>
                </Field>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
              Precio de reventa
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Precio original que pagaste">
                {/* Foco en azul, no coral: el coral se lee como estado de
                    error incluso sin que haya ninguno (mismo azul "neutro,
                    solo estás editando" que ya usa el resto del Paso 1 vía el
                    outline nativo del navegador). */}
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <span className="text-muted-foreground font-bold">S/</span>
                  <input
                    type="number"
                    className="w-full bg-transparent font-mono font-bold text-[var(--color-ink)] focus:outline-none"
                    value={data.original === 0 ? "" : data.original}
                    onChange={(e) =>
                      setData({
                        ...data,
                        original: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </Field>
              <Field label="Tu precio de reventa">
                <div
                  className={`flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-base sm:text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${
                    !precioTouched
                      ? "border-border"
                      : precioError
                        ? "border-[var(--destructive)] ring-1 ring-[var(--destructive)]"
                        : "border-[var(--color-secondary-token)] ring-1 ring-[var(--color-secondary-token)]"
                  }`}
                >
                  <span
                    className={`font-bold ${
                      !precioTouched
                        ? "text-muted-foreground"
                        : precioError
                          ? "text-[var(--destructive)]"
                          : "text-[var(--color-secondary-token)]"
                    }`}
                  >
                    S/
                  </span>
                  <input
                    type="number"
                    min={precioMinimo}
                    max={precioMaximo}
                    className="w-full bg-transparent font-mono font-bold text-[var(--color-ink)] focus:outline-none"
                    value={data.price === 0 ? "" : data.price}
                    onFocus={() => setPrecioTouched(true)}
                    onChange={(e) => {
                      setPrecioTouched(true);
                      setData({
                        ...data,
                        price: e.target.value === "" ? 0 : Number(e.target.value),
                      });
                    }}
                  />
                </div>
                {precioTouched && precioError && (
                  <p className="mt-1.5 text-xs font-bold text-[var(--destructive)]">
                    {precioError}
                  </p>
                )}
              </Field>
            </div>

            {/* Borde en degradé de marca (mismo truco que el input del chat:
                wrapper con el degradé de fondo + padding de 1.5px, relleno
                sólido adentro) — consistente con el resto de menciones de
                lucIA en vez de un borde plano de un solo color. */}
            <div className="rounded-2xl bg-gradient-to-r from-[var(--color-primary-token)] to-[var(--color-accent-token)] p-[1.5px]">
              <div className="rounded-2xl bg-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[var(--color-ink)]">
                      <LucIAName /> sugiere, para rotar rápido:{" "}
                      <span className="font-mono text-xl text-[var(--color-secondary-token)] ml-1">
                        {S(suggested)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-[var(--color-ink)]/70">
                      {marketAvg !== null
                        ? `Promedio de ${similarPrices.length} publicación${similarPrices.length === 1 ? "" : "es"} activa${similarPrices.length === 1 ? "" : "s"} en esta ruta.`
                        : "No hay suficientes publicaciones comparables a tu precio — punto de partida sugerido."}
                    </div>
                  </div>
                  <button
                    onClick={() => setData({ ...data, price: suggested })}
                    className="rounded-full bg-white border border-[var(--color-secondary-token)] px-4 py-1.5 text-xs font-bold text-[var(--color-secondary-token)] hover:bg-[var(--color-secondary-token)] hover:text-white transition-colors shadow-sm"
                  >
                    Usar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-bold text-[var(--color-ink)]">
                ¿Ya averiguaste cuánto te cobra {data.airline} por el endoso?
              </div>
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                Es opcional y privado. Solo lo usamos para calcular tu neto estimado, y el comprador
                nunca lo ve. No hace falta evidencia acá: una vez que tengas comprador y estés
                gestionando el endoso con la aerolínea, te pediremos subir el comprobante aquí mismo
                para confirmar tu neto real.
              </p>
              <Field label="Cargo estimado (opcional)">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm focus-within:border-[var(--color-primary-token)] focus-within:ring-1 focus-within:ring-[var(--color-primary-token)]">
                  <span className="text-muted-foreground font-bold">S/</span>
                  <input
                    type="number"
                    placeholder="No lo sé todavía"
                    className="w-full bg-transparent font-mono font-bold text-[var(--color-ink)] placeholder:font-sans placeholder:font-normal focus:outline-none"
                    value={data.cargoEstimado ?? ""}
                    onChange={(e) =>
                      setData({
                        ...data,
                        cargoEstimado: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </Field>
            </div>

            {/* Desglose tipo recibo — cada concepto en su propia línea, nunca un número final opaco */}
            <div className="tarjeta-boleto p-6 space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Desglose del neto estimado
              </div>
              <ReceiptRow
                label={`Precio de venta (${data.hasReturn ? tramoAVenderLabel(data.tramoAVender) : "solo ida"})`}
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
                  note="No ingresaste un estimado. Te recomendamos confirmarlo con la aerolínea antes de publicar, o tu neto real podría ser menor a este cálculo."
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

            <div className="grid grid-cols-2 gap-4">
              <MiniStat
                n={
                  data.original > 0
                    ? `${Math.max(0, Math.round((1 - data.price / data.original) * 100))}%`
                    : "—"
                }
                label="Descuento vs. original"
                isMono
              />
              <MiniStat n="~48h" label="Est. venta" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
              Confirmar publicación
            </h2>

            <Field label="Nota para compradores (opcional)">
              <textarea
                rows={3}
                maxLength={280}
                placeholder="Ej. Cambio de planes, endoso rápido, respondo en minutos…"
                value={data.notaVendedor}
                onChange={(e) => setData({ ...data, notaVendedor: e.target.value })}
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
              <p className="text-right text-[11px] font-medium text-muted-foreground">
                {data.notaVendedor.length}/280
              </p>
            </Field>

            <dl className="divide-y divide-gray-100 rounded-2xl border border-border bg-gray-50 text-sm overflow-hidden">
              <Info2 k="Vuelo" v={`${data.airline} ${data.flightNumber || "—"}`} />
              <Info2 k="Ruta" v={rutaLabel()} />
              {data.hasReturn && <Info2 k="Vendiendo" v={tramoAVenderLabel(data.tramoAVender)} />}
              <Info2 k="Fecha" v={`${data.date || "—"} ${data.time}`} />
              {vendeIda && (
                <Info2
                  k={data.hasReturn ? "Asiento (ida)" : "Asiento"}
                  v={asientoLabel(asientoIda)}
                />
              )}
              {vendeRegreso && asientoRegreso && (
                <Info2 k="Asiento (vuelta)" v={asientoLabel(asientoRegreso)} />
              )}
              <Info2 k="Tarifa" v={data.fareType} />
              <Info2 k="Equipaje" v={data.baggage} />
              <Info2
                k="Pasajero"
                v={
                  data.pasajero.nombres || data.pasajero.apellidoPaterno
                    ? `${data.pasajero.nombres} ${data.pasajero.apellidoPaterno}`.trim()
                    : "—"
                }
              />
              <Info2 k="Precio publicado" v={S(data.price)} isMono highlight />
              <Info2 k="Cargo estimado de aerolínea" v={S(cargoEstimadoAplicado)} isMono />
              <Info2 k="Comisión Buelazo (5%)" v={`− ${S(comision)}`} isMono />
              <Info2 k="Neto estimado a recibir" v={S(montoNetoEstimado)} isMono highlight />
            </dl>
            {data.cargoEstimado == null && (
              <p className="text-xs font-bold text-[var(--color-ink)] leading-relaxed bg-yellow-50 border border-[var(--color-warning-token)]/50 p-4 rounded-xl">
                No ingresaste un cargo estimado de aerolínea. Este neto podría bajar si la aerolínea
                te cobra algo durante el trámite real.
              </p>
            )}
            <p className="text-xs font-medium text-muted-foreground leading-relaxed bg-white p-4 rounded-xl border border-gray-100">
              Al publicar aceptas los términos del endoso. El pago del comprador queda retenido en
              garantía y solo se libera cuando la aerolínea confirma el traspaso.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-4">
        <button
          onClick={() => {
            stepDirection.current = -1;
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={step === 0}
          className="rounded-full bg-white border border-border px-8 py-3.5 text-sm font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
        >
          Atrás
        </button>
        <button
          onClick={() => {
            if (step === 0 && !step0Valido) {
              setShowValidation(true);
              // Autoscroll al primer campo que falta — recién se pintan de
              // amarillo en este mismo render, así que el ref todavía apunta
              // al DOM de la validación anterior; se espera un tick para que
              // React monte el estado nuevo antes de medir la posición.
              requestAnimationFrame(() => {
                const el = primerCampoFaltanteKey
                  ? fieldRefs.current[primerCampoFaltanteKey]
                  : null;
                if (!el) return;
                const top = el.getBoundingClientRect().top + window.scrollY - SITE_HEADER_HEIGHT - 16;
                window.scrollTo({ top, behavior: "smooth" });
              });
              return;
            }
            // El Paso 1 se llena completo sin sesión — el login/registro
            // recién se pide acá, al intentar pasar al Precio, no antes.
            if (step === 0 && !user) {
              savePublishDraft(data);
              pendingAdvanceRef.current = true;
              openAuthModal("login", {
                title: "¡Ya tenemos los datos de tu vuelo!",
                text: "Inicia sesión o crea tu cuenta para continuar con el precio y publicar tu pasaje. No perderás nada de lo que ya llenaste.",
              });
              return;
            }
            // Cuentas creadas con Google nunca pasan por el formulario que
            // pide documento de identidad — se completa acá, en el mismo
            // punto donde ya se pedía sesión, no apenas inicia sesión.
            if (step === 0 && user && !profile?.document_number) {
              setShowCompleteDocument(true);
              return;
            }
            if (step === 2) {
              handlePublicar();
              return;
            }
            stepDirection.current = 1;
            setStep((s) => s + 1);
            setShowValidation(false);
          }}
          disabled={(step === 1 && !!precioError) || (step === 2 && publicando)}
          className="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-10 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
        >
          {step === 2 ? (
            publicando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Publicando…
              </>
            ) : (
              <>
                Publicar pasaje <ArrowRight className="h-4 w-4" />
              </>
            )
          ) : (
            <>
              Continuar <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// CSAT puntual sobre el precio sugerido por lucIA — se pregunta justo después
// de publicar, mientras la experiencia está fresca (mayor tasa de respuesta
// que un banner posterior en "Mis operaciones"). No bloqueante: no responder
// no impide nada, y un like/dislike ya alcanza para medir si el cálculo tuvo
// valor o no, sin pedirle al vendedor que escriba nada.
function PriceSuggestionCsat({ suggested, used }: { suggested: number; used: boolean }) {
  const { user } = useAuth();
  const [sent, setSent] = useState<FeedbackScore | null>(null);
  const [sending, setSending] = useState(false);

  async function send(score: FeedbackScore) {
    if (!user || sending || sent) return;
    setSending(true);
    try {
      await submitFeatureFeedback(user.id, "price_suggestion", score, { suggested, used });
      setSent(score);
    } catch {
      toast.error("No se pudo enviar tu respuesta.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm font-medium text-muted-foreground">
      {sent ? (
        <span>¡Gracias por tu respuesta! 🙌</span>
      ) : (
        <>
          <span>
            ¿Te sirvió el precio que sugirió <LucIAName />?
          </span>
          <button
            type="button"
            onClick={() => send("positive")}
            disabled={sending}
            aria-label="Sí, me sirvió"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[var(--color-secondary-token)] hover:text-[var(--color-secondary-token)] disabled:opacity-50"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => send("negative")}
            disabled={sending}
            aria-label="No me sirvió"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)] disabled:opacity-50"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function MiniStat({ n, label, isMono }: { n: string; label: string; isMono?: boolean }) {
  return (
    <div className="rounded-[1rem] border border-border bg-white px-5 py-4 shadow-sm">
      <div
        className={`text-2xl ${isMono ? "font-mono font-bold text-[var(--color-primary-token)]" : "font-display font-extrabold text-[var(--color-ink)]"}`}
      >
        {n}
      </div>
      <div className="text-[11px] font-bold uppercase text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Info2({
  k,
  v,
  isMono,
  highlight,
}: {
  k: string;
  v: string;
  isMono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 bg-white">
      <span className="font-medium text-gray-500">{k}</span>
      <span
        className={`${isMono ? "font-mono font-bold" : "font-semibold"} ${highlight ? "text-[var(--color-primary-token)] text-lg" : "text-[var(--color-ink)]"}`}
      >
        {v}
      </span>
    </div>
  );
}
