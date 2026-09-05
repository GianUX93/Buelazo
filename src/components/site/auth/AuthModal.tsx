import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuthModal } from "@/lib/auth-modal-context";
import { AuthForm } from "./AuthForm";

// Montado una sola vez en __root.tsx. Reemplaza la navegación a /login desde
// cualquier punto de la app (header, comprar/guardar sin sesión, rutas
// protegidas, Paso 1 de Vender vuelos) — se abre encima de la vista actual y
// se cierra solo en cuanto el login/signup tiene éxito, sin recargar ni
// navegar, así el usuario nunca pierde el scroll ni el contexto de la página
// en la que estaba.
export function AuthModal() {
  const { isOpen, context, closeAuthModal } = useAuthModal();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="max-w-md p-8 md:p-10">
        <AuthForm onAuthenticated={closeAuthModal} context={context ?? undefined} />
      </DialogContent>
    </Dialog>
  );
}
