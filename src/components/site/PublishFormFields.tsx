import type { ReactNode } from "react";
import type { Asiento, AsientoCategoria } from "@/lib/mock-data";
import { ASIENTO_ALEATORIO_MENSAJE, ASIENTO_CATEGORIA_LABEL } from "@/lib/flight-utils";

export function Field({
  label,
  required,
  warning,
  fieldRef,
  children,
}: {
  label: string;
  required?: boolean;
  // Marca el input en amarillo cuando, al intentar continuar, este campo
  // resultó faltante — sin texto adicional, solo la interacción visual.
  warning?: boolean;
  // Referencia al `<label>` completo, usada solo para hacer scroll hasta acá
  // cuando este es el primer campo faltante del Paso 0 — no afecta el layout.
  fieldRef?: (el: HTMLLabelElement | null) => void;
  children: ReactNode;
}) {
  return (
    <label ref={fieldRef} className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--color-primary-token)]">*</span>}
      </span>
      <div
        className={
          warning
            ? // El ring va directo sobre cada input/select (no sobre el wrapper
              // completo) — así no se estira para cubrir también el texto de
              // ayuda u otros elementos que compartan el mismo Field.
              "[&_input]:rounded-xl [&_input]:border-transparent [&_input]:ring-2 [&_input]:ring-[var(--color-warning-token)] [&_select]:rounded-xl [&_select]:border-transparent [&_select]:ring-2 [&_select]:ring-[var(--color-warning-token)]"
            : ""
        }
      >
        {children}
      </div>
    </label>
  );
}

export function PillToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-[var(--color-ink)] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

export function ReceiptRow({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <div className="font-medium text-gray-600">{label}</div>
        {note && (
          <div
            className={`mt-0.5 text-xs font-medium leading-relaxed ${warn ? "text-warning-ink" : "text-muted-foreground"}`}
          >
            {note}
          </div>
        )}
      </div>
      <span className="shrink-0 font-mono font-bold text-[var(--color-ink)]">{value}</span>
    </div>
  );
}

export function AsientoFields({
  title,
  tipo,
  categoria,
  numero,
  onTipoChange,
  onCategoriaChange,
  onNumeroChange,
}: {
  title?: string;
  tipo: Asiento["tipo"];
  categoria: AsientoCategoria | null;
  numero: string;
  onTipoChange: (t: Asiento["tipo"]) => void;
  onCategoriaChange: (c: AsientoCategoria) => void;
  onNumeroChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {title && <div className="text-sm font-bold text-[var(--color-ink)]">{title}</div>}
      <Field label="¿Tu tarifa incluye selección de asiento?">
        <div className="inline-flex self-start rounded-full border border-border bg-white p-1 shadow-sm">
          <PillToggle
            active={tipo === "aleatorio"}
            onClick={() => onTipoChange("aleatorio")}
            label="No"
          />
          <PillToggle
            active={tipo === "seleccionado"}
            onClick={() => onTipoChange("seleccionado")}
            label="Sí"
          />
        </div>
      </Field>

      {tipo === "seleccionado" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Categoría">
            <div className="inline-flex flex-wrap self-start rounded-full border border-border bg-white p-1 shadow-sm">
              {(["ventana", "medio", "pasillo"] as AsientoCategoria[]).map((c) => (
                <PillToggle
                  key={c}
                  active={categoria === c}
                  onClick={() => onCategoriaChange(c)}
                  label={ASIENTO_CATEGORIA_LABEL[c]}
                />
              ))}
            </div>
          </Field>
          <Field label="Número de asiento (opcional)">
            <input
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              placeholder="12A"
              value={numero}
              onChange={(e) => onNumeroChange(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs font-medium text-muted-foreground leading-relaxed">
          {ASIENTO_ALEATORIO_MENSAJE}
        </div>
      )}
    </div>
  );
}
