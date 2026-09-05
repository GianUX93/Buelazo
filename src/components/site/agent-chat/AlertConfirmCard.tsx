import { BellRing } from "lucide-react";
import { ChatAgentAvatar } from "./ChatAgentAvatar";

export function AlertConfirmCard({
  text,
  onConfirm,
  onCancel,
  resolved,
}: {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  resolved?: "confirmed" | "cancelled";
}) {
  return (
    <div className="flex items-end gap-2">
      <ChatAgentAvatar size="sm" />
      <div className="flex max-w-[75%] flex-col gap-2 rounded-2xl rounded-bl-md border border-[color-mix(in_srgb,var(--color-accent-token)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-token)_6%,#FFFFFF)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)]">
        <div className="flex items-center gap-1.5 text-[var(--color-accent-token)]">
          <BellRing className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Alerta de ruta</span>
        </div>
        <p>{text}</p>
        {!resolved && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-full bg-[var(--color-primary-token)] px-3 py-1 text-[11px] font-bold text-white transition-transform active:scale-95"
            >
              Sí, avísame
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-3 py-1 text-[11px] font-bold text-[var(--color-ink)] transition-transform active:scale-95"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
