import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Clock3,
  Tag,
  ClipboardCheck,
  MessageCircle,
  Bell,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { testimonials, airports } from "@/lib/mock-data";
import { activeFlights, lastCallFlights, tramoVigente } from "@/lib/flight-utils";
import { getActiveFlights } from "@/lib/services/flights";
import { FlightCard } from "@/components/site/FlightCard";
import { ChatAgentAvatar } from "@/components/site/agent-chat/ChatAgentAvatar";
import { DestinosTopSlider, type DestinoTopItem } from "@/components/site/DestinosTopSlider";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Sin librería de fotos por ciudad todavía — un mapa curado a mano por código
// de aeropuerto es la forma más honesta de mostrar una foto real sin inventar
// una integración que no existe. El destino en sí (qué ciudad se muestra) sí
// es real: se calcula abajo según qué ruta tiene más publicaciones activas.
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
  const { data: fetchedFlights = [], isLoading } = useQuery({
    queryKey: ["flights", "active"],
    queryFn: getActiveFlights,
  });
  const highlighted = activeFlights(fetchedFlights).slice(0, 4);
  const lastCallCount = lastCallFlights(fetchedFlights).length;

  // Top 3 destinos reales: los códigos de destino con más publicaciones activas
  // ahora mismo, no un dato inventado ni fijo.
  const destinosTop: DestinoTopItem[] = useMemo(() => {
    const conteo: Record<string, number> = {};
    for (const f of fetchedFlights) {
      const code = tramoVigente(f).destination.code;
      conteo[code] = (conteo[code] ?? 0) + 1;
    }
    const top3 = Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (top3.length === 0) {
      const a = airports[DESTINO_DEFAULT];
      return [
        { code: DESTINO_DEFAULT, city: a.city, foto: DESTINO_FOTO[DESTINO_DEFAULT], count: 0 },
      ];
    }
    return top3.map(([code, count]) => ({
      code,
      city: airports[code]?.city ?? code,
      foto: DESTINO_FOTO[code] ?? DESTINO_FOTO[DESTINO_DEFAULT],
      count,
    }));
  }, [fetchedFlights]);

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
      gsap.from(".bento-card", {
        scale: 0.95,
        opacity: 0,
        duration: 0.5,
        stagger: 0.05,
        ease: "back.out(1.2)",
        delay: 0.2,
      });
    },
    { scope: heroRef },
  );

  // Igual que en Explorar: se dispara una sola vez, cuando la carga termina —
  // nunca al mount con la lista todavía vacía, ni de nuevo después.
  useGSAP(
    () => {
      if (isLoading) return;
      // set() + to() en vez de from(): ver explore.tsx para el motivo (el
      // primer elemento de un stagger con from() puede quedar sin animar).
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

  // Entrada al hacer scroll para "Así funciona" y "Por qué confiar": cada
  // .scroll-elem arranca invisible/desplazado y se anima al entrar al
  // viewport — batch() para que las 4 cards de confianza entren juntas con
  // stagger en vez de una por una. once:true, no se repite al volver a subir.
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
      {/* Hero Bento Grid */}
      <section className="mx-auto max-w-7xl px-4 pt-8 md:pt-12 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[180px] md:auto-rows-[240px]">
          {/* Main Value Prop */}
          <div className="bento-card md:col-span-8 md:row-span-2 rounded-[2rem] bg-[var(--color-ink)] p-8 md:p-12 text-white flex flex-col justify-center relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md mb-6">
                <span className="h-2 w-2 rounded-full bg-[var(--color-secondary-token)]" />
                El marketplace peruano de pasajes
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-tight">
                Vuelos que otros no pueden usar,
                <br />
                <span className="text-[var(--color-primary-token)]">a mitad de precio.</span>
              </h1>
              <p className="mt-4 max-w-md text-gray-300 font-medium">
                Compra boletos endosados con pago retenido en garantía o publica el tuyo en minutos.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/explore"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
                >
                  Explorar ofertas <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/publish"
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/20 transition-colors"
                >
                  Vender mi pasaje
                </Link>
              </div>
            </div>
            {/* Background Image subtle overlay */}
            <img
              src="https://images.unsplash.com/photo-1522814701227-6f8e77a16e5f?w=800&q=80"
              alt="People traveling"
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
            />
          </div>

          {/* Top 3 destinos: se calculan solos, según qué rutas tienen más
              publicaciones activas — slider con autoplay y navegación manual. */}
          <DestinosTopSlider destinos={destinosTop} />

          {/* Trust Banner */}
          <div className="bento-card md:col-span-2 md:row-span-1 rounded-[2rem] bg-[var(--color-secondary-token)] p-6 text-white flex flex-col justify-center">
            <ShieldCheck className="h-8 w-8 mb-3" />
            <h3 className="font-display font-bold leading-tight">Endoso seguro y validado</h3>
          </div>

          {/* Promoción */}
          <div className="bento-card md:col-span-2 md:row-span-1 rounded-[2rem] bg-white border border-border p-6 flex flex-col justify-center shadow-sm">
            <Tag className="h-7 w-7 text-[var(--color-primary-token)] mb-3" />
            <h3 className="font-display font-bold text-[var(--color-ink)] leading-tight text-lg">
              Ahorra hasta 80%
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              En vuelos última llamada
            </p>
          </div>
        </div>
      </section>

      {/* lucIA: la ventaja competitiva de tener un agente conversacional real
          (no un formulario de filtros como la competencia) — estética propia
          de producto de IA (gradiente coral/acento, avatar con Sparkles),
          distinta del bloque oscuro de "Así funciona" más abajo. */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="scroll-elem relative overflow-hidden rounded-[2rem] bg-[var(--color-ink)] p-8 md:p-14">
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

      {/* Así funciona: el mismo timeline de protección escrow que ya usa el
          detalle del vuelo, condensado como teaser para quien todavía no entra
          a una compra o venta. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 pb-8 md:pt-28">
        <div className="scroll-elem relative overflow-hidden rounded-[2rem] bg-[var(--color-ink)] p-8 md:p-12">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-60 blur-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary-token), var(--color-accent-token))",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-[var(--color-secondary-token)] opacity-30 blur-2xl"
            aria-hidden
          />

          <h2 className="relative font-display text-3xl font-extrabold text-white md:text-4xl">
            Así funciona
          </h2>

          <div className="relative mt-8 grid gap-6 md:grid-cols-3 md:gap-10">
            {[
              {
                Icon: ClipboardCheck,
                title: "Publica o encuentra tu vuelo",
                desc: "Cada publicación pasa por una revisión antes de salir al público, así que lo que ves ya fue verificado.",
              },
              {
                Icon: Lock,
                title: "El pago queda retenido",
                desc: "Buelazo guarda el dinero en garantía. No se libera al vendedor hasta que el comprador confirma que todo salió bien.",
              },
              {
                Icon: CheckCircle2,
                title: "Se confirma el traspaso",
                desc: "Verificamos que el boleto quedó a nombre del comprador y ahí recién se libera el pago al vendedor.",
              },
            ].map(({ Icon, title, desc }) => (
              <div key={title}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-secondary-token)]">
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <div className="mt-3 text-sm font-bold text-white">{title}</div>
                <p className="mt-1 text-xs font-medium leading-relaxed text-white/70">{desc}</p>
              </div>
            ))}
          </div>

          <Link
            to="/trust"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] transition-transform hover:scale-105 active:scale-95"
          >
            Ver cómo funciona <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Por qué confiar: diferenciadores reales de Buelazo, no genéricos —
          los mismos que ya sostienen el resto del producto (escrow, revisión
          manual, chat interno, alertas de ruta). */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-20 md:pt-20 md:pb-24">
        <h2 className="mb-10 text-center font-display text-3xl font-extrabold text-[var(--color-ink)]">
          ¿Por qué confiar en Buelazo?
        </h2>
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
              className="scroll-elem rounded-[2rem] border border-border bg-white p-6 shadow-sm"
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
          desplaza sola a velocidad sutil; se detiene con el mouse encima para
          poder leer con calma. */}
      <section className="pb-16 pt-4 hero-elem">
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)] mb-8 text-center px-4">
          Viajeros que ya la pasaron Buelazo
        </h2>
        <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="flex w-max animate-marquee gap-6 px-4 [@media(hover:hover)_and_(pointer:fine)]:group-hover:[animation-play-state:paused]">
            {[...testimonials, ...testimonials].map((t, i) => (
              <figure
                key={`${t.name}-${i}`}
                className="flex w-80 shrink-0 flex-col justify-between rounded-[2rem] bg-white border border-border p-8 shadow-sm"
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
    </div>
  );
}
