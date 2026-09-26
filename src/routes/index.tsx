import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Clock3,
  ClipboardCheck,
  MessageCircle,
  Bell,
  CheckCircle2,
  Sparkles,
  Search,
  MapPin,
  CalendarRange,
  ArrowLeftRight,
} from "lucide-react";
import { testimonials, airportsList } from "@/lib/mock-data";
import { activeFlights, lastCallFlights } from "@/lib/flight-utils";
import { getActiveFlights } from "@/lib/services/flights";
import { FlightCard } from "@/components/site/FlightCard";
import { ChatAgentAvatar } from "@/components/site/agent-chat/ChatAgentAvatar";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// lucIA se oculta para este primer MVP (decisión de producto, no técnica):
// el modo de búsqueda conversacional sigue implementado y funcional, solo
// no se expone en el home ni se linkea desde acá hasta que vuelva a
// habilitarse. Cambiar esta constante reactiva el link del hero y la
// sección completa de la landing.
const LUCIA_HABILITADO = false;

// Mismos presets de rango que ya usa /explore (RangoPreset) — el home no
// hace búsqueda por fecha exacta, así que se reusa el mismo vocabulario en
// vez de inventar un control de fecha aparte.
const RANGO_OPCIONES = [
  { value: "semana", label: "Próxima semana" },
  { value: "quince", label: "Próximos 15 días" },
  { value: "mes", label: "Próximo mes" },
] as const;

// Copy rotativo del titular: solo remezcla frases que ya son ciertas y ya
// aparecen en el resto de la página (nada nuevo, ningún claim inventado).
// Cada frase debe cerrar gramaticalmente "Vuelos que otros no pueden usar,
// ___" — "y en minutos." se sacó por eso (pertenecía a "publica el tuyo en
// minutos", un sujeto distinto, y sonaba desordenado acá).
// "con endoso seguro." va primero a propósito (useState(0) abajo arranca en
// este índice) — es la única variante que menciona "endoso" explícitamente y
// no debe quedar librada al azar de la rotación.
const TITULAR_ROTATIVO = [
  "con endoso seguro.",
  "con descuento real.",
  "a precio de otro pasajero.",
  "verificados antes de publicarse.",
];
const TITULAR_ROTATIVO_MS = 3200;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Buelazo — Viaja por el Perú a mitad de precio" },
      {
        name: "description",
        content: "Marketplace peruano para comprar pasajes aéreos endosados.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: fetchedFlights = [], isLoading } = useQuery({
    queryKey: ["flights", "active"],
    queryFn: getActiveFlights,
  });
  const highlighted = activeFlights(fetchedFlights).slice(0, 4);
  const lastCallCount = lastCallFlights(fetchedFlights).length;

  // Buscador manual del hero: mismos parámetros reales que ya acepta
  // /explore (from/to/rango) — nada simulado, un submit real. Sin fecha
  // exacta: el home solo ofrece los mismos rangos flexibles de /explore.
  const [origen, setOrigen] = useState("LIM");
  const [destino, setDestino] = useState("");
  const [rango, setRango] = useState<(typeof RANGO_OPCIONES)[number]["value"]>("mes");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    navigate({
      to: "/explore",
      search: {
        from: origen || undefined,
        to: destino || undefined,
        rango,
      } as never,
    });
  }

  // Titular rotativo: cicla solo la frase después de la coma, en loop, sin
  // depender de interacción — pausa si el usuario prefiere menos movimiento.
  // Crossfade real (no solo un fade-in): primero se desvanece la frase
  // vigente, recién entonces entra la siguiente — un corte seco de por medio
  // se sentía "rápido" sin importar cuán suave fuera la entrada sola.
  const [tituloIndex, setTituloIndex] = useState(0);
  const [tituloSaliendo, setTituloSaliendo] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let salidaTimeout: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setTituloSaliendo(true);
      salidaTimeout = setTimeout(() => {
        setTituloIndex((i) => (i + 1) % TITULAR_ROTATIVO.length);
        setTituloSaliendo(false);
      }, 450);
    }, TITULAR_ROTATIVO_MS);
    return () => {
      clearInterval(id);
      clearTimeout(salidaTimeout);
    };
  }, []);

  const heroRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".hero-elem", {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
      });
    },
    { scope: heroRef },
  );

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.set(".flight-anim", { y: 40, opacity: 0 });
      gsap.to(".flight-anim", {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.1,
        delay: 0.1,
        ease: "power2.out",
        clearProps: "all",
      });
    },
    { scope: heroRef, dependencies: [isLoading] },
  );

  useGSAP(
    () => {
      const elems = gsap.utils.toArray<HTMLElement>(".scroll-elem");
      gsap.set(elems, { y: 40, opacity: 0 });
      ScrollTrigger.batch(".scroll-elem", {
        start: "top 85%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.12,
            ease: "power2.out",
            clearProps: "all",
          }),
      });
    },
    { scope: heroRef },
  );

  return (
    <div ref={heroRef} className="pb-20">
      {/* ============================================================
          HERO — versión Buelito: centrado, limpio, sin carrusel de
          destinos ni referencias a lucIA (oculta para este MVP, no
          eliminada — ver LUCIA_HABILITADO más abajo). Los renders 3D de
          Buelito enmarcan el bloque central, igual que en la referencia.
          ============================================================ */}
      <section className="relative overflow-hidden px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 md:pb-12 md:pt-16 lg:pb-14">
        <img
          src="/assets/buelito/buelito-saludo.png"
          alt=""
          className="pointer-events-none absolute -left-44 -top-40 z-0 hidden w-72 select-none object-contain opacity-90 sm:block md:-left-48 md:-top-44 md:w-[22rem] lg:-left-52 lg:-top-48 lg:w-[26rem]"
        />
        {/* Offset inferior mínimo a propósito: el corte real del overflow-
            hidden de la sección debe caer dentro del hueco/sombra del
            render (zona sin contenido visual), nunca sobre el avión o el
            personaje, para que el recorte no se note aunque exista. */}
        <img
          src="/assets/buelito/buelito-avion.png"
          alt=""
          className="pointer-events-none absolute -right-28 bottom-2 z-0 hidden w-52 select-none object-contain sm:-right-36 sm:block sm:w-[18rem] md:-right-44 md:bottom-4 md:w-[22rem] lg:-right-52 lg:bottom-6 lg:w-[26rem]"
        />

        <div className="hero-elem relative z-10 mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)]/15 px-3.5 py-1.5 text-xs font-bold text-[#8a6a2c]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Endoso verificado, precios reales
          </div>

          {/* 2 líneas fijas siempre, con un <br> explícito antes de la frase
              rotativa en vez de dejar que el wrap natural decida — así
              ninguna frase rotativa cambia el alto del título ni empuja el
              resto del hero. */}
          <h1 className="mx-auto mt-5 font-display text-[1.75rem] font-extrabold leading-[1.2] tracking-tight text-[var(--color-ink)] sm:text-4xl sm:leading-[1.15] md:text-5xl lg:text-[3.25rem]">
            Vuelos que otros no pueden usar,
            <br />
            <span
              key={tituloIndex}
              className={`inline-block bg-clip-text text-transparent ${
                tituloSaliendo ? "animate-fade-out-smooth" : "animate-fade-in-smooth"
              }`}
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--color-accent-token), var(--color-secondary-token))",
              }}
            >
              {TITULAR_ROTATIVO[tituloIndex]}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-muted-foreground sm:whitespace-nowrap">
            Tu pago queda{" "}
            <span className="font-bold text-[var(--color-ink)]">retenido en garantía</span> hasta
            que confirmes que todo salió bien.
          </p>

          {/* Buscador manual — mismo mecanismo real que /explore */}
          <form
            onSubmit={buscar}
            className="mx-auto mt-7 flex max-w-2xl flex-col gap-2 rounded-[1.75rem] border border-border bg-white p-2.5 text-left shadow-sm sm:flex-row sm:items-center sm:rounded-full"
          >
            <label className="flex flex-1 items-center gap-2.5 px-4 py-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">Origen</span>
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-[var(--color-ink)] focus:outline-none"
              >
                {airportsList.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.city} ({a.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex shrink-0 items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  if (!destino) return;
                  setOrigen(destino);
                  setDestino(origen);
                }}
                disabled={!destino}
                aria-label="Intercambiar origen y destino"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition-colors hover:border-[var(--color-primary-token)] hover:text-[var(--color-primary-token)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="flex flex-1 items-center gap-2.5 px-4 py-2.5 sm:flex-[1.3] sm:border-r sm:border-border">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">Destino</span>
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="w-full truncate bg-transparent text-sm font-semibold text-[var(--color-ink)] focus:outline-none"
              >
                <option value="">Cualquier destino</option>
                {airportsList
                  .filter((a) => a.code !== origen)
                  .map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.city} ({a.code})
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-1 items-center gap-2.5 px-4 py-2.5">
              <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">Rango de fechas</span>
              <select
                value={rango}
                onChange={(e) => setRango(e.target.value as typeof rango)}
                className="w-full truncate bg-transparent text-sm font-semibold text-[var(--color-ink)] focus:outline-none"
              >
                {RANGO_OPCIONES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              aria-label="Buscar vuelos"
              className="grid h-12 w-12 shrink-0 place-items-center self-end rounded-full bg-[var(--color-primary-token)] text-white transition-transform hover:scale-105 active:scale-95 sm:self-auto"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
          </form>

          {LUCIA_HABILITADO && (
            <Link
              to="/explore"
              search={{ agente: "1" }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-accent-token)] hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              ¿Prefieres solo decirle a lucIA a dónde quieres ir?
            </Link>
          )}

        </div>
      </section>

      {/* Conector "o": en vez de un CTA suelto ("Quiero conocer más"), el
          buscador y la card de "publicar pasaje" de abajo se leen ahora como
          las dos ramas de una misma decisión — comprar o vender. Texto suelto
          con una línea a cada lado (no un botón/píldora) para que se lea como
          separador, no como algo clickeable. */}
      <div className="hero-elem relative z-10 -mt-2 flex items-center justify-center gap-4 px-4">
        <span className="h-px w-10 shrink-0 bg-border sm:w-20" />
        <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
          o publica el tuyo
        </span>
        <span className="h-px w-10 shrink-0 bg-border sm:w-20" />
      </div>

      {/* Publicar pasaje: Buelito vive por fuera del card (sobre el fondo de
          la página), solo su borde derecho invade el card por encima —
          nunca queda contenido dentro de la caja blanca. Título en una sola
          línea, en coral, todo alineado a la izquierda como en la
          referencia. */}
      <section className="relative z-10 mx-auto mt-8 max-w-5xl pl-16 pr-4 sm:mt-10 sm:pl-24 sm:pr-6 md:pl-28">
        <div className="scroll-elem relative rounded-[1.75rem] bg-white py-7 pl-24 pr-6 shadow-sm sm:py-9 sm:pl-36 sm:pr-8 md:py-10 md:pl-44 md:pr-10">
          <img
            src="/assets/buelito/buelito-laptop.png"
            alt=""
            className="pointer-events-none absolute left-[-4.5rem] top-1/2 w-36 -translate-y-1/2 select-none object-contain sm:left-[-6.5rem] sm:w-52 md:left-[-7.5rem] md:w-60"
          />
          <h3 className="font-display text-lg font-extrabold text-[var(--color-primary-token)] sm:whitespace-nowrap sm:text-2xl md:text-[1.75rem]">
            ¿Tienes un pasaje que ya no puedes usar?
          </h3>
          <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
            Sube tu comprobante, pon tu precio y nosotros nos encargamos del resto.
          </p>
          <Link
            to="/publish"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] transition-colors hover:bg-muted"
          >
            Vender mi pasaje
          </Link>
        </div>
      </section>

      {/* lucIA: el agente conversacional real, no un formulario de filtros.
          Oculto para este MVP por decisión de producto (LUCIA_HABILITADO),
          no eliminado — se reactiva cambiando esa constante. */}
      {LUCIA_HABILITADO && (
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-20">
        <div className="scroll-elem relative overflow-hidden rounded-[1.75rem] bg-[var(--color-ink)] p-8 md:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--color-primary-token)]/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-[var(--color-accent-token)]/25 blur-3xl"
          />
          <div className="relative grid gap-10 md:grid-cols-2 md:items-center md:gap-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary-token)]" />
                Agente de IA, no un formulario
              </div>
              <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight text-white md:text-4xl">
                Mientras otros te hacen llenar filtros,
                <br />
                tú solo le hablas a <span className="text-[var(--color-primary-token)]">lucIA</span>
                .
              </h2>
              <p className="mt-4 max-w-md font-medium text-gray-300">
                Dile a dónde quieres ir, en qué fechas y qué buscas — lucIA entiende el lenguaje
                natural, busca en tiempo real entre las publicaciones activas y te muestra las cards
                reales, sin que toques un solo selector.
              </p>
              <ul className="mt-6 space-y-3 text-sm font-medium text-gray-300">
                <li className="flex items-center gap-2.5">
                  <MessageCircle className="h-4 w-4 shrink-0 text-[var(--color-secondary-token)]" />
                  Busca en lenguaje natural, sin formularios
                </li>
                <li className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4 shrink-0 text-[var(--color-secondary-token)]" />
                  Crea alertas de ruta con solo pedirlo
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-secondary-token)]" />
                  Recuerda el hilo de la conversación, no repites nada dos veces
                </li>
              </ul>
              <Link
                to="/explore"
                search={{ agente: "1" }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
              >
                Habla con lucIA <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mini demo: loop pasivo de 9s (usuario → lucIA piensa → lucIA
                responde) hecho con CSS, no una interacción real. `inert` +
                aria-hidden bloquean cualquier foco/click/teclado dentro,
                incluido el link real de la FlightCard que se reutiliza. */}
            <div
              // @ts-expect-error -- `inert` es un atributo HTML válido en React 19,
              // los tipos de @types/react todavía no lo tienen declarado.
              inert=""
              aria-hidden="true"
              className="pointer-events-none rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md md:p-6"
            >
              <div className="flex justify-end">
                <div className="animate-demo-user max-w-[80%] rounded-2xl rounded-br-md bg-[var(--color-primary-token)] px-4 py-2.5 text-sm font-medium text-white">
                  Quiero viajar a Cusco el próximo finde
                </div>
              </div>

              <div className="animate-demo-thinking mt-3 flex items-center gap-2.5">
                <ChatAgentAvatar size="sm" />
                <span
                  className="animate-text-shimmer inline-block bg-clip-text text-sm font-medium text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(255,255,255,0.4) 40%, var(--color-primary-token) 50%, rgba(255,255,255,0.4) 60%)",
                    backgroundSize: "200% 100%",
                  }}
                >
                  Buscando opciones para Cusco…
                </span>
              </div>

              <div className="animate-demo-agent mt-3">
                <div className="flex items-start gap-2.5">
                  <ChatAgentAvatar size="sm" />
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium leading-snug text-white">
                    ¡Encontré esta opción con buen descuento! 👇
                  </div>
                </div>
                {highlighted[0] && (
                  <div className="mt-4 pl-9">
                    <FlightCard flight={highlighted[0]} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Featured feed: sin vuelos activos ni de última llamada, la sección
          entera se oculta — no tiene sentido mostrar el titular y "Ver
          todos" sobre una grilla vacía. Si solo hay última llamada (sin
          destacados) se muestra igual, sola. */}
      {(highlighted.length > 0 || lastCallCount > 0) && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          {highlighted.length > 0 && (
            <>
              <div className="flex items-end justify-between gap-4 hero-elem">
                <div>
                  <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)]">
                    Disponibles ahora
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground font-medium">
                    Vuelos confirmados listos para endoso seguro.
                  </p>
                </div>
                <Link
                  to="/explore"
                  className="hidden items-center gap-1 text-sm font-bold text-[var(--color-primary-token)] hover:underline md:inline-flex"
                >
                  Ver todos <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {highlighted.map((f) => (
                  <div key={f.id} className="flight-anim h-full">
                    <FlightCard flight={f} isOwnListing={user?.id === f.seller.id} />
                  </div>
                ))}
              </div>
            </>
          )}

          {lastCallCount > 0 && (
            <div className={highlighted.length > 0 ? "mt-8 hero-elem" : "hero-elem"}>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--color-warning-token)] bg-yellow-50 px-6 py-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-[var(--color-warning-token)] p-3 rounded-full">
                    <Clock3 className="h-6 w-6 text-[var(--color-ink)]" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--color-ink)]">
                      {lastCallCount} pasajes en{" "}
                      <span className="uppercase tracking-widest text-xs ml-1">Última Llamada</span>
                    </div>
                    <div className="text-sm font-medium text-[var(--color-ink)]/70 mt-0.5">
                      Salen en menos de 24h. Ofertas más agresivas con trámite inmediato.
                    </div>
                  </div>
                </div>
                <Link
                  to="/explore"
                  search={{ mode: "flexible", lane: "last_call" } as never}
                  className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-bold text-white hover:bg-black transition-colors"
                >
                  Ver urgentes
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Cómo funciona el traspaso seguro: 3 columnas simples (sin sticky ni
          scroll-jacking — la versión con animación de scroll no se sentía
          bien y se reemplazó por este layout estático) + una card ancha
          debajo con el personaje de transferencia. */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-8 sm:px-6 md:pt-12">
        <div className="scroll-elem mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)] md:text-4xl">
            ¿Cómo funciona el traspaso seguro?
          </h2>
          <p className="mt-3 text-sm font-medium text-muted-foreground md:text-base">
            Tu dinero nunca toca la cuenta del vendedor hasta que el pasaje quede confirmado a tu
            nombre.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              img: "/assets/buelito/card-2.png",
              title: "El pago queda retenido",
              desc: "Buelazo guarda el dinero en garantía. No se libera al vendedor hasta que el comprador confirma que todo salió bien.",
            },
            {
              img: "/assets/buelito/card-1.png",
              title: "Publica o encuentra tu vuelo",
              desc: "Cada publicación pasa por una revisión manual antes de salir al público, así que lo que ves ya fue verificado.",
            },
            {
              img: "/assets/buelito/card-3.png",
              title: "Se confirma el traspaso",
              desc: "Verificamos que el boleto quedó a nombre del comprador y ahí recién se libera el pago al vendedor.",
            },
          ].map(({ img, title, desc }) => (
            <div
              key={title}
              className="scroll-elem flex flex-col items-center rounded-[1.75rem] bg-white p-8 text-center shadow-sm"
            >
              <h3 className="font-display text-xl font-extrabold text-[var(--color-primary-token)]">
                {title}
              </h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
                {desc}
              </p>
              <div className="mt-6 h-40 w-40 overflow-hidden rounded-full bg-[var(--color-cream)]">
                <img src={img} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/trust"
          className="scroll-elem group relative mt-6 block overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-white from-60% to-[#F6DFAE] p-8 transition-transform hover:scale-[1.01] sm:p-10"
        >
          <div className="max-w-md">
            <div className="font-display text-lg font-extrabold text-[var(--color-primary-token)] sm:whitespace-nowrap sm:text-2xl">
              Transferencia de pasajes 100% legal en Perú
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground sm:mt-3 sm:whitespace-nowrap sm:text-base">
              El endoso ante la aerolínea es un trámite oficial, mira el detalle completo.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white transition-transform group-hover:scale-105 sm:mt-6">
              Ver como funciona
            </span>
          </div>
          {/* Encajado dentro del contenedor, no parado encima: la imagen es
              más alta que la card y se centra un poco por debajo del medio
              (top-[58%] en vez de 50%) para dejar aire arriba — el
              overflow-hidden del Link recorta cabeza y piernas, solo se ve
              de la mitad para arriba, nunca los pies. */}
          <img
            src="/assets/buelito/transferencia-pasaje.png"
            alt=""
            className="pointer-events-none absolute right-6 top-[68%] hidden h-48 w-auto -translate-y-1/2 select-none object-contain sm:block sm:right-10 sm:h-56 md:right-14 md:h-64"
          />
        </Link>
      </section>

      {/* Por qué confiar: diferenciadores reales de Buelazo. */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 md:pt-20 md:pb-24">
        <h2 className="mb-2 text-center font-display text-3xl font-extrabold text-[var(--color-ink)]">
          ¿Por qué confían los peruanos en Buelazo?
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-center text-sm font-medium text-muted-foreground">
          Diseñado para eliminar la desconfianza de comprar en Facebook Marketplace o grupos de
          WhatsApp.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              Icon: ShieldCheck,
              title: "Pago retenido en garantía",
              desc: "Tu dinero se libera al vendedor solo cuando confirmas que el traspaso salió bien.",
            },
            {
              Icon: ClipboardCheck,
              title: "Revisión antes de publicar",
              desc: "Ninguna oferta sale al público sin pasar antes por una revisión manual.",
            },
            {
              Icon: MessageCircle,
              title: "Chat interno, no WhatsApp",
              desc: "Coordinas con el vendedor sin exponer tu número real en ningún momento.",
            },
            {
              Icon: Bell,
              title: "Alertas de ruta",
              desc: "Si no hay nada para tu destino todavía, te avisamos apenas alguien lo publique.",
            },
          ].map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="scroll-elem rounded-[1.75rem] border border-border bg-white p-6 shadow-sm"
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-secondary-token)]/10 text-[var(--color-secondary-token)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials — roll banner: la pista duplica la lista una vez y se
          desplaza sola a velocidad sutil; se detiene con el mouse encima. */}
      <section className="pb-16 pt-4 hero-elem">
        <div className="mb-8 px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
            Experiencias reales
          </div>
          <h2 className="mt-1 font-display text-3xl font-extrabold text-[var(--color-ink)]">
            Viajeros que ya la pasaron Buelazo
          </h2>
        </div>
        <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="flex w-max animate-marquee gap-6 px-4 [@media(hover:hover)_and_(pointer:fine)]:group-hover:[animation-play-state:paused]">
            {[...testimonials, ...testimonials].map((t, i) => (
              <figure
                key={`${t.name}-${i}`}
                className="flex w-80 shrink-0 flex-col justify-between rounded-[1.75rem] bg-white border border-border p-8 shadow-sm"
              >
                <blockquote className="font-sans text-lg font-medium leading-snug text-[var(--color-ink)]">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-6 text-sm flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={t.avatarUrl} alt={t.name} />
                    <AvatarFallback className="font-bold text-gray-500">{t.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-[var(--color-ink)] font-bold">{t.name}</div>
                    <div className="text-muted-foreground font-medium text-xs">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA de cierre: mismas dos acciones de siempre, resumidas al final
          de la página para quien llegó hasta acá sin decidirse todavía.
          Dos capas en vez de un solo bodegón: "amigos" queda estático
          detrás del card (nunca se anima, sus piernas quedan tapadas por
          el fondo opaco) y "buelito-sosteniendo" vive DENTRO del mismo
          wrapper .scroll-elem que el card, para que ambos se muevan juntos
          como una sola unidad al entrar — antes el mascote era una imagen
          suelta que no acompañaba el slide-up del card y se veía
          desfasado. */}
      <section className="relative mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <img
          src="/assets/buelito/amigos-cierre.png"
          alt=""
          className="pointer-events-none absolute left-1/2 top-2 z-0 w-64 -translate-x-1/2 select-none object-contain sm:top-4 sm:w-80 md:top-6 md:w-[22rem]"
        />
        <div className="scroll-elem relative z-10 pt-28 sm:pt-36 md:pt-40">
          <img
            src="/assets/buelito/buelito-sosteniendo.png"
            alt=""
            className="pointer-events-none absolute left-1/2 top-0 z-10 w-28 -translate-x-1/2 select-none object-contain sm:w-36 md:w-40"
          />
          <div className="relative overflow-hidden rounded-[1.75rem] bg-[var(--color-ink)] px-6 pb-12 pt-6 text-center sm:px-12 sm:pt-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[var(--color-accent-token)]/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-[var(--color-primary-token)]/20 blur-3xl"
            />
            <div className="relative mx-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white">
              <ShieldCheck className="h-3.5 w-3.5" />
              Garantía Buelazo
            </div>
            <h2 className="relative mx-auto mt-4 max-w-xl font-display text-2xl font-extrabold text-white sm:text-3xl">
              ¿Tienes un pasaje que no vas a usar o quieres volar por mucho menos?
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm font-medium text-white/60">
              Publicar toma solo unos minutos y buscar vuelos es completamente gratis.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
              >
                Explorar vuelos disponibles <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/publish"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Publicar mi pasaje
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
