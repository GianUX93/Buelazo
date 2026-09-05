import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Lock, FileCheck2, Scale, PhoneCall } from "lucide-react";

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

function Trust() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        Confianza y seguridad
      </div>
      <h1 className="mt-2 font-display text-5xl md:text-6xl">
        Tu dinero no se mueve hasta que la aerolínea confirma.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Buelazo opera como un escrow: retenemos el pago del comprador y solo lo liberamos al
        vendedor cuando el boleto ya está a nombre del nuevo pasajero en el sistema de la aerolínea.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Pillar
          icon={<Lock className="h-5 w-5" />}
          title="Pago retenido en escrow"
          desc="Al pagar, tu dinero queda en una cuenta protegida. El vendedor no recibe nada hasta la confirmación del endoso."
        />
        <Pillar
          icon={<FileCheck2 className="h-5 w-5" />}
          title="Verificación con la aerolínea"
          desc="Cruzamos el código de reserva contra el sistema de LATAM, Sky o JetSmart para confirmar que el nombre cambió."
        />
        <Pillar
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Identidad verificada"
          desc="Vendedores y compradores validan DNI y teléfono peruano antes de operar."
        />
        <Pillar
          icon={<Scale className="h-5 w-5" />}
          title="Respaldo legal"
          desc="El endoso de pasajes aéreos nacionales es gratuito en Perú y está respaldado por Indecopi. Nosotros solo facilitamos el trámite."
        />
      </div>

      <div className="mt-16 rounded-3xl border border-hairline bg-surface p-8 md:p-10">
        <h2 className="font-display text-3xl">Preguntas frecuentes</h2>
        <div className="mt-6 divide-y divide-hairline">
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

      <div className="mt-10 flex items-center justify-between rounded-3xl border border-hairline bg-surface p-6">
        <div>
          <div className="font-display text-2xl">¿Algo salió distinto?</div>
          <p className="text-sm text-muted-foreground">
            Nuestro equipo en Lima está disponible de 6am a 11pm, todos los días.
          </p>
        </div>
        <a
          href="#"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <PhoneCall className="h-4 w-4" /> Contactar soporte
        </a>
      </div>
    </div>
  );
}

function Pillar({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface p-6">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-signal/15 text-signal">
        {icon}
      </div>
      <div className="mt-4 font-display text-xl">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm">
        <span className="font-medium">{q}</span>
        <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
