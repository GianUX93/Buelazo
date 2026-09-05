import { Dialog, DialogContent } from "@/components/ui/dialog";

// Distinto del modal de login a propósito (mismo criterio del prompt): este
// resuelve un momento distinto — el usuario ya volvió, con sesión o sin ella,
// y encontró un borrador viejo. No reutiliza el copy ni el componente del
// login para no mezclar dos decisiones distintas del usuario en una sola UI.
export function PublishDraftRecoveryModal({
  open,
  onDiscard,
  onRecover,
}: {
  open: boolean;
  onDiscard: () => void;
  onRecover: () => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md p-8 text-center [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="text-4xl">🛫</div>
        <h2 className="mt-3 font-display text-2xl font-extrabold text-[var(--color-ink)]">
          ¡Vemos que tienes un borrador guardado!
        </h2>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          ¿Quieres recuperar los datos que habías ingresado o empezar de nuevo?
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onRecover}
            className="flex-1 rounded-full bg-[var(--color-primary-token)] px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
          >
            Recuperar datos
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex-1 rounded-full border border-border bg-white px-6 py-3 text-sm font-bold text-[var(--color-ink)] transition-colors hover:bg-gray-50"
          >
            Empezar de nuevo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
