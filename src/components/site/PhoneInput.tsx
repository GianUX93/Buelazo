import { ChevronDown } from "lucide-react";
import { PREFIJOS_TELEFONO } from "@/lib/phone-prefixes";

export function PhoneInput({
  prefijo,
  numero,
  onChange,
}: {
  prefijo: string;
  numero: string;
  onChange: (prefijo: string, numero: string) => void;
}) {
  const maxLen = PREFIJOS_TELEFONO.find((p) => p.code === prefijo)?.maxLen ?? 9;

  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        <select
          value={prefijo}
          onChange={(e) => onChange(e.target.value, numero.slice(0, maxLen))}
          aria-label="Prefijo telefónico del país"
          className="h-full w-[96px] appearance-none rounded-xl border border-border bg-background py-3 pl-3 pr-6 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
        >
          {PREFIJOS_TELEFONO.map((p) => (
            <option key={p.code} value={p.code} aria-label={`${p.country} ${p.code}`}>
              {p.flag} {p.code}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="999 999 999"
        maxLength={maxLen}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base sm:text-sm font-medium focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
        value={numero}
        onChange={(e) => onChange(prefijo, e.target.value.replace(/\D/g, "").slice(0, maxLen))}
      />
    </div>
  );
}
