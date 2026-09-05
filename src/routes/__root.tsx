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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE">
      <head>
        <HeadContent />
      </head>
      <body>
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
