import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, FileCheck2, Scale, HelpCircle, ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/WhatsAppIcon";
import { SOPORTE_WHATSAPP_URL } from "@/lib/support";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Cómo funciona el traspaso — Buelazo" },
      {
        name: "description",
        content:
          "Cómo verificamos el endoso de tu pasaje, protegemos tu dinero con escrow y respaldamos el trámite legalmente en Perú.",
      },
      { property: "og:title", content: "Cómo protegemos tu traspaso — Buelazo" },
      {
        property: "og:description",
        content:
          "Escrow, verificación con la aerolínea y respaldo legal del endoso gratuito en Perú.",
      },
    ],
  }),
  component: Trust,
});

// Mismo lenguaje visual cálido del home: paneles rounded-[1.75rem], un color
// distinto por pilar (coral/morado/teal/ámbar) en vez de un solo tono repetido,
// y el botón de soporte real por WhatsApp en vez de un teléfono de muestra.
const PILARES = [
  {
    Icon: Lock,
    color: "var(--color-primary-token)",
    title: "Pago retenido en escrow",
    desc: "Al pagar, tu dinero queda en una cuenta protegida. El vendedor no recibe nada hasta la confirmación del endoso.",
  },
  {
    Icon: FileCheck2,
    color: "var(--color-accent-token)",
    title: "Verificación con la aerolínea",
    desc: "Cruzamos el código de reserva contra el sistema de LATAM, Sky o JetSmart para confirmar que el nombre cambió.",
  },
  {
    Icon: ShieldCheck,
    color: "var(--color-secondary-token)",
    title: "Identidad verificada",
    desc: "Vendedores y compradores validan DNI y teléfono peruano antes de operar.",
  },
  {
    Icon: Scale,
    color: "var(--color-ink)",
    title: "Respaldo legal",
    desc: "El endoso de pasajes aéreos nacionales es gratuito en Perú y está respaldado por Indecopi. Nosotros solo facilitamos el trámite.",
  },
];

function Trust() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-secondary-token)]/10 px-3.5 py-1.5 text-xs font-bold text-[var(--color-secondary-token)]">
        <ShieldCheck className="h-3.5 w-3.5" />
        Confianza y seguridad
      </div>
      <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-[var(--color-ink)] sm:text-5xl md:text-[3.25rem]">
        Tu dinero no se mueve hasta que la aerolínea confirma.
      </h1>
      <p className="mt-4 max-w-2xl text-base font-medium text-muted-foreground">
        Buelazo opera como un escrow: retenemos el pago del comprador y solo lo liberamos al
        vendedor cuando el boleto ya está a nombre del nuevo pasajero en el sistema de la
        aerolínea.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PILARES.map(({ Icon, color, title, desc }) => (
          <div
            key={title}
            className="rounded-[1.75rem] border border-border bg-white p-6 shadow-sm"
          >
            <span
              className="grid h-11 w-11 place-items-center rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, white)` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-[var(--color-ink)]">
              {title}
            </h3>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">
              {desc}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-[1.75rem] border border-border bg-white p-6 shadow-sm md:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-token)]/10 px-3.5 py-1.5 text-xs font-bold text-[var(--color-accent-token)]">
          <HelpCircle className="h-3.5 w-3.5" />
          Preguntas frecuentes
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-[var(--color-ink)] md:text-3xl">
          Lo que más nos preguntan
        </h2>
        <div className="mt-6 divide-y divide-dashed divide-border">
          <Faq
            q="¿Qué pasa si la aerolínea rechaza el endoso?"
            a="Se te reembolsa el 100% del pago. El vendedor no recibe nada. Buelazo asume el costo de gestión."
          />
          <Faq
            q="¿Es legal transferir un pasaje en Perú?"
            a="Sí. Las aerolíneas nacionales están obligadas a permitir el endoso sin costo adicional para vuelos domésticos, siempre que el pasajero original lo solicite antes del vuelo."
          />
          <Faq
            q="¿Cuánto demora el trámite?"
            a="Entre 1 y 3 horas en promedio. Por eso los vuelos que salen en menos de 24h viven en la sección 'Última llamada' con advertencia explícita. No los mezclamos con las ofertas estándar."
          />
          <Faq
            q="¿Qué pasa si un vuelo ya no se puede endosar a tiempo?"
            a="Lo ocultamos automáticamente del marketplace. Nunca mostramos inventario que no puedas comprar y transferir de forma realista."
          />
          <Faq
            q="¿Cómo se calcula la comisión?"
            a="Cobramos 5% al vendedor sobre el precio final. Para el comprador no hay costo adicional al precio publicado."
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-5 rounded-[1.75rem] bg-[var(--color-ink)] p-6 sm:flex-row sm:items-center md:p-8">
        <div>
          <div className="font-display text-xl font-extrabold text-white">
            ¿Algo salió distinto?
          </div>
          <p className="mt-1 text-sm font-medium text-white/60">
            Nuestro equipo en Lima está disponible de 6am a 11pm, todos los días.
          </p>
        </div>
        <a
          href={SOPORTE_WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Escribir a soporte por WhatsApp
        </a>
      </div>

      <Link
        to="/explore"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary-token)] hover:underline"
      >
        Volver a explorar vuelos <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm">
        <span className="font-bold text-[var(--color-ink)]">{q}</span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{a}</p>
    </details>
  );
}
