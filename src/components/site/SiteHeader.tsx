import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, X, ShoppingBag, User, LogOut, ChevronDown, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAlerts } from "@/lib/alerts-context";
import { useAuth } from "@/lib/auth-context";
import { useHeaderVisual } from "@/lib/header-visual-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function fmtRelativo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const horas = Math.round(diffMs / 3600_000);
  if (horas < 1) return "hace un momento";
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const { alertas, unreadCount, markRead, markAllRead } = useAlerts();
  const { user, profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isExplore = pathname === "/explore";
  const { heroVisible } = useHeaderVisual();
  const { openAuthModal, closeAuthModal } = useAuthModal();
  const [scrolled, setScrolled] = useState(false);

  // Sobre el hero con foto del modo Manual de Explorar, el header flota
  // transparente para no tapar la imagen; apenas el usuario scrollea más allá
  // del hero, cambia a la versión sólida y sticky. heroVisible (avisado por
  // explore.tsx) evita que quede transparente cuando no hay hero detrás (modo
  // Agéntico), donde se vería en blanco sobre blanco.
  useEffect(() => {
    if (!isExplore) {
      setScrolled(false);
      return;
    }
    function onScroll() {
      setScrolled(window.scrollY > 200);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isExplore]);

  const transparent = isExplore && heroVisible && !scrolled;

  // Rutas que exigen sesión (ver useRequireAuth) — cerrar sesión estando en
  // una de estas dejaba a la vista el modal de login abriéndose solo sobre la
  // página, y si se cerraba sin loguearse, la pantalla de "Necesitas iniciar
  // sesión" detrás. Ninguna de las dos debería verse: apenas se cierra sesión
  // ahí, se saca al usuario a un lugar que no le va a pedir login de nuevo.
  // /publish no está en esta lista a propósito: maneja la pérdida de sesión
  // con su propia lógica por paso (ver publish.tsx).
  function esRutaProtegida(path: string) {
    return (
      path === "/dashboard" ||
      path === "/profile" ||
      path === "/admin/revisiones" ||
      path.startsWith("/edit-flight/")
    );
  }

  async function handleSignOut() {
    setConfirmSignOutOpen(false);
    setOpen(false);
    const debeRedirigir = esRutaProtegida(pathname);
    await signOut();
    toast.success("Sesión cerrada correctamente");
    if (debeRedirigir) {
      // `user` pasando a null puede disparar el useRequireAuth() de la propia
      // página (dashboard/profile/etc.) y abrir el modal de login justo antes
      // de que este navigate surta efecto — closeAuthModal() es la red de
      // seguridad para que no quede abierto flotando sobre el home.
      closeAuthModal();
      navigate({ to: "/" });
    }
  }

  return (
    <header
      className={
        isExplore
          ? `fixed inset-x-0 top-0 z-40 transition-all duration-700 ease-out ${
              transparent
                ? "bg-transparent"
                : "border-b border-[var(--color-ink)]/12 bg-background shadow-[0_1px_0_0_rgba(26,30,43,0.04)]"
            }`
          : "sticky top-0 z-40 border-b border-[var(--color-ink)]/12 bg-background shadow-[0_1px_0_0_rgba(26,30,43,0.04)]"
      }
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src={transparent ? "/logo-buelazo-white.png" : "/logo-buelazo-dark.png"}
            alt="Buelazo"
            className="h-7 w-auto"
          />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavItem to="/" transparent={transparent}>
            Inicio
          </NavItem>
          <NavItem to="/explore" transparent={transparent}>
            Explorar vuelos
          </NavItem>
          <NavItem to="/publish" transparent={transparent}>
            Vender vuelos
          </NavItem>
          <NavItem to="/trust" transparent={transparent}>
            Cómo funciona
          </NavItem>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user && (
            <DropdownMenu onOpenChange={(o) => !o && markAllRead()}>
              <DropdownMenuTrigger asChild>
                <button
                  className={`relative grid h-9 w-9 place-items-center rounded-full border transition-colors after:absolute after:-inset-1 after:content-[''] ${
                    transparent
                      ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
                      : "border-[var(--color-ink)]/10 bg-surface-2 hover:bg-background"
                  }`}
                  aria-label="Notificaciones"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--color-primary-token)] text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Notificaciones
                </div>
                {alertas.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No tienes notificaciones.
                  </div>
                )}
                {alertas.slice(0, 5).map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    asChild
                    className="focus:bg-surface-2! focus:text-inherit!"
                  >
                    {/* `a.href` es un string dinámico (a veces con query, ej.
                        /dashboard?tx=...&chat=1) que no calza con las rutas tipadas
                        que espera <Link to>, así que se usa un <a> normal. */}
                    <a
                      href={a.href ?? "/alertas"}
                      onClick={() => markRead(a.id)}
                      className="flex flex-col items-start gap-0.5 whitespace-normal"
                    >
                      <div className="flex w-full items-center gap-2">
                        {!a.leida && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary-token)]" />
                        )}
                        <span className="text-sm font-bold text-[var(--color-ink)]">
                          {a.titulo}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{a.detalle}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                        {fmtRelativo(a.timestamp)}
                      </span>
                    </a>
                  </DropdownMenuItem>
                ))}
                {alertas.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="focus:bg-surface-2! focus:text-inherit!">
                      <Link
                        to="/alertas"
                        className="justify-center text-sm font-bold text-[var(--color-primary-token)]"
                      >
                        Ver todas las alertas
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 ring-1 ring-offset-2 transition-shadow hover:ring-[var(--color-primary-token)]/50 ${
                    transparent
                      ? "ring-white/40 ring-offset-transparent"
                      : "ring-[var(--color-ink)]/12 ring-offset-background"
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    {profile?.avatar_url && (
                      <AvatarImage src={profile.avatar_url} alt={profile.first_name || "U"} />
                    )}
                    <AvatarFallback className="bg-surface-2 text-xs font-medium">
                      {(profile?.first_name?.[0] || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown
                    className={`h-3.5 w-3.5 ${transparent ? "text-white/80" : "text-muted-foreground"}`}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <div className="truncate text-sm font-bold text-[var(--color-ink)]">
                    {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="focus:bg-surface-2! focus:text-inherit!">
                  <Link to="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Mi perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="focus:bg-surface-2! focus:text-inherit!">
                  <Link to="/dashboard" className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Mis operaciones
                  </Link>
                </DropdownMenuItem>
                {profile?.is_admin && (
                  <DropdownMenuItem asChild className="focus:bg-surface-2! focus:text-inherit!">
                    <Link to="/admin/revisiones" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Revisiones
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmSignOutOpen(true)}
                  className="flex items-center gap-2 text-[var(--color-primary-token)] focus:bg-surface-2! focus:text-[var(--color-primary-token)]!"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="rounded-full bg-[var(--color-primary-token)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-token)]/90"
            >
              Ingresar
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full border md:hidden after:absolute after:-inset-1 after:content-[''] ${
            transparent
              ? "border-white/30 bg-white/10 text-white"
              : "border-[var(--color-ink)]/10 bg-surface-2"
          }`}
          aria-label="Menú"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-[var(--color-ink)]/12 bg-surface-2 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            <MobileItem to="/" onClick={() => setOpen(false)}>
              Inicio
            </MobileItem>
            <MobileItem to="/explore" onClick={() => setOpen(false)}>
              Explorar vuelos
            </MobileItem>
            <MobileItem to="/publish" onClick={() => setOpen(false)}>
              Vender vuelos
            </MobileItem>
            <MobileItem to="/trust" onClick={() => setOpen(false)}>
              Cómo funciona
            </MobileItem>

            <div className="my-2 border-t border-[var(--color-ink)]/10" />

            {user ? (
              <>
                <MobileItem to="/profile" onClick={() => setOpen(false)}>
                  Mi perfil
                </MobileItem>
                <MobileItem to="/dashboard" onClick={() => setOpen(false)}>
                  Mis operaciones
                  {unreadCount > 0 && (
                    <span className="ml-2 rounded-full bg-[var(--color-primary-token)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </MobileItem>
                <button
                  onClick={() => setConfirmSignOutOpen(true)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--color-primary-token)] transition-colors hover:bg-background"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openAuthModal("login");
                }}
                className="rounded-full bg-[var(--color-primary-token)] px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-token)]/90"
              >
                Ingresar
              </button>
            )}
          </div>
        </div>
      )}

      <Dialog open={confirmSignOutOpen} onOpenChange={setConfirmSignOutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold text-[var(--color-ink)]">
              ¿Cerrar sesión?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Seguro que quieres salir de tu cuenta?</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmSignOutOpen(false)}
              className="flex-1 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Cerrar sesión
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function NavItem({
  to,
  children,
  transparent,
}: {
  to: string;
  children: React.ReactNode;
  transparent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        transparent
          ? "text-white/80 hover:text-white"
          : "text-muted-foreground hover:text-foreground"
      }`}
      activeProps={{
        className: transparent
          ? "text-white! font-bold"
          : "text-[var(--color-primary-token)]! font-bold",
      }}
    >
      {children}
    </Link>
  );
}

function MobileItem({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      activeProps={{
        className: "bg-[var(--color-ink)] text-white hover:bg-[var(--color-ink)] hover:text-white",
      }}
    >
      {children}
    </Link>
  );
}
