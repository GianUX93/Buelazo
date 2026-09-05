import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { updateDocumentInfo } from "@/lib/services/profile";
import { DOCUMENTO_MAX_LEN, sanitizeNumeroDocumento } from "@/lib/flight-utils";
import type { TipoDocumento } from "@/lib/mock-data";

// Gate específico para cuentas creadas con Google: el formulario de registro
// (AuthForm) ya pide tipo/número de documento, pero OAuth nunca pasa por ese
// formulario — este modal completa el dato faltante en el único momento en
// que de verdad hace falta (justo antes de publicar), no apenas inicia
// sesión por primera vez, siguiendo el mismo criterio que ya se usa para
// pedir login recién al pasar del Paso 1 al Paso 2 de Publicar.
export function CompleteDocumentModal({ open, onDone }: { open: boolean; onDone: () => void }) {
  const { user, refreshProfile } = useAuth();
  const [documentType, setDocumentType] = useState<TipoDocumento>("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateDocumentInfo(user.id, documentType, documentNumber);
      await refreshProfile();
      onDone();
    } catch {
      toast.error("No se pudo guardar tu documento. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md p-8 [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <h2 className="font-display text-2xl font-extrabold text-[var(--color-ink)] text-center">
          Un dato más antes de continuar
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Tu cuenta se creó con Google, así que todavía nos falta tu documento de identidad.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Tipo de documento
              </label>
              <div className="relative mt-1">
                <select
                  required
                  value={documentType}
                  onChange={(e) => {
                    const next = e.target.value as TipoDocumento;
                    setDocumentType(next);
                    setDocumentNumber((prev) => prev.slice(0, DOCUMENTO_MAX_LEN[next]));
                  }}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-base sm:text-sm focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
                >
                  <option value="DNI">DNI</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="Carné de Extranjería">Carné de Extranjería</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                N.° de documento
              </label>
              <input
                type="text"
                required
                inputMode={documentType === "Pasaporte" ? "text" : "numeric"}
                maxLength={DOCUMENTO_MAX_LEN[documentType]}
                value={documentNumber}
                onChange={(e) =>
                  setDocumentNumber(sanitizeNumeroDocumento(documentType, e.target.value))
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base sm:text-sm font-mono focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || documentNumber.length !== DOCUMENTO_MAX_LEN[documentType]}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-token)] px-4 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
