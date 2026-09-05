import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useAlerts } from "@/lib/alerts-context";

export const Route = createFileRoute("/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas — Buelazo" },
      {
        name: "description",
        content: "Notificaciones sobre tus búsquedas y el estado de tus endosos.",
      },
    ],
  }),
  component: Alertas,
});

function Alertas() {
  const { alertas, markRead, markAllRead } = useAlerts();
  const unread = alertas.some((a) => !a.leida);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-token)]">
            Notificaciones
          </div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-extrabold text-[var(--color-ink)]">
            Alertas
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Avisos de búsquedas que activaste y cambios de estado en tus endosos.
          </p>
        </div>
        {unread && (
          <button
            onClick={markAllRead}
            className="text-sm font-bold text-[var(--color-primary-token)] hover:underline"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {alertas.length === 0 && (
          <div className="rounded-[2rem] border border-border bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
            No tienes alertas todavía. Actívalas desde "Explorar vuelos" cuando una búsqueda no
            tenga resultados, o aparecerán aquí solas cuando cambie el estado de un endoso.
          </div>
        )}
        {alertas.map((a) => (
          <a
            key={a.id}
            // Mismo fallback que el dropdown de notificaciones del header — si
            // la notificación no trae `href` (ej. el trigger de Supabase no lo
            // generó para ese tipo de evento), un <a> sin `href` no navega a
            // ningún lado al hacer click, dejando la impresión de que el click
            // "no hizo nada".
            href={a.href ?? "/alertas"}
            onClick={() => markRead(a.id)}
            className="flex w-full items-start gap-4 rounded-[1.5rem] border border-border bg-white p-5 text-left shadow-sm transition-colors hover:bg-surface-2"
          >
            <div
              className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                a.leida ? "bg-surface-2" : "bg-[var(--color-primary-token)]/10"
              }`}
            >
              <Bell
                className={`h-4 w-4 ${a.leida ? "text-muted-foreground" : "text-[var(--color-primary-token)]"}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--color-ink)]">{a.titulo}</span>
                {!a.leida && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-token)]" />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.detalle}</p>
              <span className="mt-1 block text-[11px] uppercase tracking-widest text-muted-foreground/70">
                {new Date(a.timestamp).toLocaleString("es-PE", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
