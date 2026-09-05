import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useAuthModal } from "@/lib/auth-modal-context";

// Se muestra en vez de un blanco vacío cuando useRequireAuth() abrió el modal
// de login y el usuario lo cerró sin loguearse — antes esto dejaba la página
// completamente en blanco, sin ninguna forma de volver a intentarlo salvo la
// navegación del header.
export function AuthRequiredPlaceholder() {
  const { openAuthModal } = useAuthModal();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        <Lock className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
        Necesitas iniciar sesión
      </h1>
      <p className="text-sm font-medium text-muted-foreground">
        Inicia sesión o crea una cuenta para continuar acá.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => openAuthModal("login")}
          className="rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
        >
          Iniciar sesión
        </button>
        <Link
          to="/"
          className="rounded-full border border-border bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] transition-colors hover:bg-gray-50"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
