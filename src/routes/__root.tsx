import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/site/SiteHeader";
import { SiteFooter } from "../components/site/SiteFooter";
import { AlertsProvider } from "../lib/alerts-context";
import { SavedProvider } from "../lib/saved-context";
import { AuthProvider } from "../lib/auth-context";
import { AuthModalProvider } from "../lib/auth-modal-context";
import { AuthModal } from "../components/site/auth/AuthModal";
import { PaymentProvider } from "../lib/payment-context";
import { HeaderVisualProvider, useHeaderVisual } from "../lib/header-visual-context";
import { ChatSessionProvider } from "../lib/chat-agent/chat-session-context";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esa ruta no está en la pizarra de vuelos.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">Algo se movió en la cabina</h1>
        <p className="mt-2 text-sm text-muted-foreground">Refresca o vuelve al inicio.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#161514" },
      { title: "Buelazo — Vuelos que otros no pueden usar" },
      {
        name: "description",
        content:
          "Marketplace P2P peruano de endoso de pasajes aéreos. Recupera el valor de tu boleto o vuela con descuentos de último minuto, con pago retenido hasta confirmar el traspaso.",
      },
      { property: "og:title", content: "Buelazo — Vuelos endosados con pago retenido" },
      {
        property: "og:description",
        content:
          "Compra o vende pasajes aéreos nacionales entre personas. Verificamos el endoso y retenemos el pago hasta que la aerolínea confirme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Sora:wght@400;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const HOME_DIRECTION_CONTRACT = `
THESIS: El home dejó de vender vuelos con tarjetas flotantes de gradiente — ahora ES el panel de información de un aeropuerto, reconocible al instante.
OWN-WORLD: Paneles backlit oscuros (--color-ink) con vidrio de instrumento; Sora en mayúsculas para letreros, IBM Plex Mono tabular para rutas/horas/precios; coral (--color-primary-token) como flecha direccional, teal (--color-secondary-token) como sello verificado, morado (--color-accent-token) como voz de lucIA, amarillo (--color-warning-token) reservado a la cuña diagonal de urgencia.
STORY: El visitante entiende que esto verifica y transfiere boletos reales, cree que puede hablarle a lucIA en vez de llenar filtros, y actúa escribiendo su búsqueda o mirando el tablero en vivo hacia "Explorar".
FIRST VIEWPORT: Panel oscuro a sangre completa — letrero-titular con flecha, buscador de lucIA como línea de consulta del tablero, filas split-flap con vuelos reales, CTA secundario "Vender mi pasaje" como señal menor.
FORM: Señalética Aeroportuaria, dirección asignada 1/7 de la lista propia; seed key fa4cb234.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* eslint-disable-next-line react/no-danger -- comentario HTML real
            (no un comentario JSX, que el compilador elimina), requerido para
            que el contrato de dirección del rediseño del home sobreviva al
            build de producción y sea auditable con grep. Puramente inerte. */}
        <div dangerouslySetInnerHTML={{ __html: `<!--${HOME_DIRECTION_CONTRACT}-->` }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Vive dentro de HeaderVisualProvider (no en RootComponent, por encima del
// provider) para poder leer footerVisible y ocultar el footer en el modo
// Agéntico de /explore, sin que ninguna otra ruta se vea afectada.
function AppShell() {
  const { footerVisible } = useHeaderVisual();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      {footerVisible && <SiteFooter />}
      <AuthModal />
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthModalProvider>
          <AlertsProvider>
            <SavedProvider>
              <PaymentProvider>
                <HeaderVisualProvider>
                  <ChatSessionProvider>
                    <AppShell />
                    <Toaster theme="light" position="top-center" />
                  </ChatSessionProvider>
                </HeaderVisualProvider>
              </PaymentProvider>
            </SavedProvider>
          </AlertsProvider>
        </AuthModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
