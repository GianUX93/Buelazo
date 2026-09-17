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
} from "lucide-react";
import { testimonials, airportsList } from "@/lib/mock-data";
import {
  activeFlights,
  lastCallFlights,
  tramoVigente,
  fmtDay,
  fmtTime,
  discountPct,
  totalAPagar,
  S,
} from "@/lib/flight-utils";
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

// Sin librería de fotos por ciudad todavía — un mapa curado a mano por código
// de aeropuerto es la forma más honesta de mostrar una foto real sin inventar
// una integración que no existe.
const DESTINO_FOTO: Record<string, string> = {
  CUZ: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800&q=80",
  AQP: "https://images.unsplash.com/photo-1531968455001-5c5272a41129?w=800&q=80",
  PIU: "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=800&q=80",
  IQT: "https://images.unsplash.com/photo-1516815231560-8f41ec531527?w=800&q=80",
  TRU: "https://images.unsplash.com/photo-1580889240911-ed861cbe6ee6?w=800&q=80",
  TPP: "https://images.unsplash.com/photo-1544928147-79a2dbc1f389?w=800&q=80",
  CIX: "https://images.unsplash.com/photo-1533050487297-09b450131914?w=800&q=80",
  LIM: "https://images.unsplash.com/photo-1531968455001-5c5272a41129?w=800&q=80",
};
const DESTINO_DEFAULT = "CUZ";

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
const TITULAR_ROTATIVO = [
  "a mitad de precio.",
  "con pago seguro.",
  "con endoso seguro.",
  "sin perder dinero.",
];
const TITULAR_ROTATIVO_MS = 3200;

// Autoplay de la card destacada del hero — mismo intervalo que ya usaba el
// slider de destinos que reemplaza.
const DESTACADO_AUTOPLAY_MS = 4500;

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

  // Carrusel de la oferta destacada del hero: rota entre vuelos activos
  // reales (mismo criterio que "Disponibles ahora"), nunca datos de muestra.
  const [destacadoIndex, setDestacadoIndex] = useState(0);
  const [destacadoAutoplay, setDestacadoAutoplay] = useState(true);
  useEffect(() => {
    if (!destacadoAutoplay || highlighted.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setDestacadoIndex((i) => (i + 1) % highlighted.length);
    }, DESTACADO_AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [destacadoAutoplay, highlighted.length]);

  const destacado = highlighted[destacadoIndex % (highlighted.length || 1)];
  const destacadoTramo = destacado ? tramoVigente(destacado) : null;

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
          HERO — cálido y directo: buscador manual real + oferta
          destacada, look inspirado en marketplaces de confianza masivos
          (inDrive/Airbnb), no en un panel "técnico".
          ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 md:pt-16">
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-8">
          <div className="hero-elem md:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)]/10 px-3.5 py-1.5 text-xs font-bold text-[var(--color-secondary-token)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Endoso verificado y pago protegido
            </div>

            {/* 3 líneas fijas siempre, con <br> explícitos en vez de dejar
                que el wrap natural decida — así ninguna frase rotativa
                cambia el alto del título ni empuja el resto del hero. */}
            <div className="relative">
              <img
                src="/assets/3d/avion-hero.webp"
                alt=""
                className="pointer-events-none absolute right-4 top-8 z-10 hidden w-28 select-none object-contain sm:block sm:right-6 sm:top-10 sm:w-36 md:right-10 md:top-12 md:w-44"
              />
              <h1 className="mt-5 font-display text-[1.75rem] font-extrabold leading-[1.2] tracking-tight text-[var(--color-ink)] sm:text-5xl sm:leading-[1.1] md:text-[3.25rem]">
                Vuelos que otros no
                <br />
                pueden usar,
                <br />
                <span
                  key={tituloIndex}
                  className={`inline-block bg-clip-text text-transparent ${
                    tituloSaliendo ? "animate-fade-out-smooth" : "animate-fade-in-smooth"
                  }`}
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, var(--color-primary-token), var(--color-accent-token))",
                  }}
                >
                  {TITULAR_ROTATIVO[tituloIndex]}
                </span>
              </h1>
            </div>
            <p className="mt-4 max-w-lg text-base font-medium text-muted-foreground">
              Compra boletos endosados con{" "}
              <span className="font-bold text-[var(--color-ink)]">pago retenido en garantía</span> o
              publica el tuyo en minutos.
            </p>

            {/* Buscador manual — mismo mecanismo real que /explore */}
            <form
              onSubmit={buscar}
              className="mt-7 flex flex-col gap-2 rounded-[1.75rem] border border-border bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:rounded-full"
            >
              <label className="flex flex-1 items-center gap-2.5 px-4 py-2.5 sm:border-r sm:border-border">
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
              <label className="flex flex-1 items-center gap-2.5 px-4 py-2.5 sm:border-r sm:border-border">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Destino</span>
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[var(--color-ink)] focus:outline-none"
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
                  className="w-full bg-transparent text-sm font-semibold text-[var(--color-ink)] focus:outline-none"
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
            <Link
              to="/explore"
              search={{ agente: "1" }}
              className="mt-3 inline-flex items-center gap-1.5 pl-1 text-sm font-bold text-[var(--color-accent-token)] hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              ¿Prefieres solo decirle a lucIA a dónde quieres ir?
            </Link>

            {/* "Explorar todas las ofertas" se quitó: el buscador de arriba
                ya lleva a /explore, tenerlo aparte era el mismo destino dos
                veces. "Vender mi pasaje" se queda solo, pero ahora con
                contexto propio (a qué escenario responde) en vez de un botón
                suelto sin explicación. */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-white/70 px-5 py-4">
              <div>
                <div className="text-sm font-bold text-[var(--color-ink)]">
                  ¿Tienes un pasaje que ya no puedes usar?
                </div>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  Publícalo en minutos y recupera parte de tu dinero.
                </p>
              </div>
              <Link
                to="/publish"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] transition-colors hover:bg-muted"
              >
                Vender mi pasaje
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-secondary-token)]" />
                Pago retenido en garantía
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-secondary-token)]" />
                Revisión antes de publicar
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-secondary-token)]" />
                Validado con la aerolínea
              </span>
            </div>
          </div>

          {/* Oferta destacada: rota entre vuelos activos reales — nunca una
              tarjeta de muestra fija. La caja de la card nunca se remonta:
              las fotos se apilan y hacen crossfade entre sí (como el slider
              de destinos que reemplazó), y solo el texto se desvanece — así
              no hay parpadeo ni microsalto al cambiar de oferta. */}
          {destacado && destacadoTramo && (
            <div className="hero-elem md:col-span-5">
              <Link
                to="/flight/$id"
                params={{ id: destacado.id }}
                className="group block overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-md transition-transform hover:-translate-y-1"
              >
                <div className="relative h-44">
                  {highlighted.map((f, i) => {
                    const t = tramoVigente(f);
                    const foto = DESTINO_FOTO[t.destination.code] ?? DESTINO_FOTO[DESTINO_DEFAULT];
                    const activo = i === destacadoIndex % highlighted.length;
                    return (
                      <div
                        key={f.id}
                        aria-hidden={!activo}
                        className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                          activo ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <img
                          src={foto}
                          alt={t.destination.city}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                          Destino {t.destination.city}
                        </span>
                        <span className="absolute right-4 top-4 rounded-full bg-[var(--color-secondary-token)] px-3 py-1 text-[11px] font-bold text-white">
                          −{discountPct(f)}% dcto
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div key={destacado.id} className="animate-fade-in p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-xl font-bold text-[var(--color-ink)]">
                      {destacadoTramo.origin.code} → {destacadoTramo.destination.code}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground line-through">
                        {S(destacado.originalPrice)}
                      </div>
                      <div className="font-display text-xl font-extrabold text-[var(--color-primary-token)]">
                        {S(totalAPagar(destacado))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">
                    Salida {fmtDay(destacadoTramo.departureAt)} · {fmtTime(destacadoTramo.departureAt)}{" "}
                    · {destacado.airline}
                  </div>
                  <div className="mt-4 flex items-center gap-2.5 border-t border-dashed border-border pt-4">
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarImage
                        src={destacado.seller.avatarUrl}
                        alt={destacado.seller.name}
                      />
                      <AvatarFallback className="text-xs font-bold text-gray-500">
                        {destacado.seller.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-muted-foreground">
                      Vendido por {destacado.seller.name}
                    </span>
                    {destacado.seller.verifiedId && (
                      <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[var(--color-secondary-token)]">
                        <ShieldCheck className="h-3.5 w-3.5" /> Verificado
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              {highlighted.length > 1 && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {highlighted.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setDestacadoAutoplay(false);
                        setDestacadoIndex(i);
                      }}
                      aria-label={`Ver oferta destacada ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === destacadoIndex % highlighted.length
                          ? "w-5 bg-[var(--color-primary-token)]"
                          : "w-1.5 bg-border hover:bg-muted-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* lucIA: el agente conversacional real, no un formulario de filtros. */}
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

      {/* Featured feed */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
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

        {lastCallCount > 0 && (
          <div className="mt-8 hero-elem">
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

      {/* Cómo funciona el traspaso seguro: 3 pasos claros + una barra oscura
          que invita a la página completa de confianza/legal. */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-8 sm:px-6 md:pt-12">
        <div className="scroll-elem text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)]/10 px-3.5 py-1.5 text-xs font-bold text-[var(--color-secondary-token)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Transferencia segura garantizada
          </div>
          <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-extrabold text-[var(--color-ink)] md:text-4xl">
            ¿Cómo funciona el traspaso seguro?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-muted-foreground">
            Tu dinero nunca toca la cuenta del vendedor hasta que el pasaje quede confirmado a tu
            nombre.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              n: "01",
              color: "var(--color-primary-token)",
              img: "/assets/3d/paso-1-buscar.webp",
              title: "Publica o encuentra tu vuelo",
              desc: "Cada publicación pasa por una revisión manual antes de salir al público, así que lo que ves ya fue verificado.",
            },
            {
              n: "02",
              color: "var(--color-accent-token)",
              img: "/assets/3d/paso-2-pago.webp",
              title: "El pago queda retenido",
              desc: "Buelazo guarda el dinero en garantía. No se libera al vendedor hasta que el comprador confirma que todo salió bien.",
            },
            {
              n: "03",
              color: "var(--color-secondary-token)",
              img: "/assets/3d/paso-3-traspaso.webp",
              title: "Se confirma el traspaso",
              desc: "Verificamos que el boleto quedó a nombre del comprador y ahí recién se libera el pago al vendedor.",
            },
          ].map(({ n, color, img, title, desc }) => (
            <div
              key={title}
              className="scroll-elem flex flex-col rounded-[1.75rem] border border-border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">
                  {title}
                </h3>
                <span
                  className="shrink-0 font-display text-2xl font-extrabold"
                  style={{ color }}
                >
                  {n}
                </span>
              </div>
              <p className="mt-2 max-w-[85%] text-sm font-medium leading-relaxed text-muted-foreground">
                {desc}
              </p>
              <img
                src={img}
                alt=""
                className="mt-3 h-28 w-28 self-end object-contain sm:h-32 sm:w-32"
              />
            </div>
          ))}
        </div>

        <Link
          to="/trust"
          className="scroll-elem mt-6 flex items-center justify-between gap-4 rounded-[1.75rem] bg-[var(--color-ink)] px-6 py-5 transition-transform hover:scale-[1.01]"
        >
          <div>
            <div className="text-sm font-bold text-white">
              Transferencia de pasajes 100% legal en Perú
            </div>
            <div className="mt-0.5 text-xs font-medium text-white/60">
              El endoso ante la aerolínea es un trámite oficial — mira el detalle completo.
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--color-ink)]">
            Ver cómo funciona <ArrowRight className="h-3.5 w-3.5" />
          </span>
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
          de la página para quien llegó hasta acá sin decidirse todavía. */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="scroll-elem relative overflow-hidden rounded-[1.75rem] bg-[var(--color-ink)] px-6 py-12 text-center sm:px-12">
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
      </section>
    </div>
  );
}
