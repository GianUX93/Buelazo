import { LocateFixed } from "lucide-react";

export function LocationPromptCard({
  onShare,
  onDismiss,
  loading,
}: {
  onShare: () => void;
  onDismiss: () => void;
  loading: boolean;
}) {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-border bg-white p-5 text-left shadow-sm">
      <h3 className="font-display text-base font-bold text-[var(--color-ink)]">
        ¿Compartes tu ubicación?
      </h3>
      <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">
        Usamos tu posición para saber desde qué ciudad viajas y no tener que preguntártelo.
      </p>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={onShare}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-token)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" />
          {loading ? "Ubicando..." : "Compartir ubicación"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={loading}
          className="text-sm font-bold text-[var(--color-accent-token)] hover:underline disabled:opacity-60"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
