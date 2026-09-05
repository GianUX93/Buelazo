// El nombre "lucIA" en degradé de marca (coral → acento) cada vez que se
// menciona sobre fondo blanco / contraste positivo — nunca el resto del
// texto alrededor, solo la palabra en sí, como un pequeño logotipo inline.
export function LucIAName() {
  return (
    <span className="bg-gradient-to-r from-[var(--color-primary-token)] to-[var(--color-accent-token)] bg-clip-text font-bold text-transparent">
      lucIA
    </span>
  );
}
