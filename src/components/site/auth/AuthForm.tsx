import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { TipoDocumento } from "@/lib/mock-data";
import { DOCUMENTO_MAX_LEN, sanitizeNumeroDocumento } from "@/lib/flight-utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12.01 12.01 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

// Formulario compartido por la página /login (mantenida para links directos)
// y por el modal de login/signup — un solo lugar con la lógica real de auth.
// `onAuthenticated` se dispara una sola vez cuando `user` pasa de nulo a
// existir mientras este formulario está montado: el modal lo usa para
// cerrarse solo, la página /login para navegar. Ya no se depende de un
// window.location.href tras el submit — el propio AuthProvider ya escucha
// onAuthStateChange y actualiza `user` de forma reactiva, así que loguearse
// no obliga a recargar toda la página (necesario para que el modal no
// pierda el scroll/contexto de la vista sobre la que se abrió).
export function AuthForm({
  onAuthenticated,
  context,
}: {
  onAuthenticated?: () => void;
  // Título/descripción que reemplaza al genérico "Inicia sesión / Bienvenido
  // de vuelta" cuando el modal se abre con contexto de una acción en curso
  // (ej. desde el Paso 1 de Vender vuelos) — se mantiene igual sin importar
  // si el usuario está en login o cambia a "Crea tu cuenta", porque el
  // contexto ("ya tenemos tus datos") no depende de esa elección.
  context?: { title: string; text: string };
}) {
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<TipoDocumento>("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const wasLoggedOut = useRef(!user);

  useEffect(() => {
    if (wasLoggedOut.current && user) onAuthenticated?.();
    wasLoggedOut.current = !user;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    // Google sale de la app por naturaleza (redirect externo) — hay que
    // decirle explícitamente que vuelva a la página exacta donde se abrió
    // el modal (ej. /publish a mitad del formulario), no al origin/home:
    // ahí es donde vive el borrador guardado (ver publish-draft.ts) que
    // permite retomar el flujo justo donde se quedó.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // "Nombre completo" en un solo input (en vez de nombres + 2 apellidos +
    // teléfono): se parte en la primera palabra como nombres y el resto como
    // apellido para no perder el dato, aunque no sea una separación perfecta.
    // Apellido materno y teléfono ya no se piden acá — se completan en el
    // Paso 1 de Publicar pasaje, donde de todas formas hacen falta de nuevo.
    const trimmedName = fullName.trim();
    const [firstWord, ...rest] = trimmedName.split(/\s+/);

    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstWord ?? "",
              last_name: rest.join(" "),
              // Faltan para cuentas creadas con Google (nunca pasan por este
              // formulario) — ese caso se resuelve aparte, gateado justo
              // antes del Paso 2 de Publicar (ver publish.tsx).
              document_type: documentType,
              document_number: documentNumber,
              marketing_opt_in: acceptedMarketing,
            },
          },
        });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isLogin ? "¡Bienvenido de vuelta!" : "Cuenta creada exitosamente");
    // El cierre/navegación real lo dispara el useEffect de arriba cuando
    // `user` pase a existir (AuthProvider lo detecta solo).
  };

  return (
    <div className="w-full">
      <div>
        <h2 className="font-display text-3xl font-extrabold text-[var(--color-ink)] text-center">
          {context ? context.title : isLogin ? "Inicia sesión" : "Crea tu cuenta"}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {context
            ? context.text
            : isLogin
              ? "Bienvenido de vuelta a Buelazo"
              : "Únete para comprar y vender pasajes"}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-white px-4 py-3 text-sm font-bold text-[var(--color-ink)] shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <GoogleIcon className="h-4 w-4" /> Continuar con Google
            </>
          )}
        </button>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            o
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {!isLogin && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Nombre completo
            </label>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base sm:text-sm focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
            />
          </div>
        )}
        {!isLogin && (
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
        )}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base sm:text-sm focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Contraseña
          </label>
          <input
            type="password"
            name="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base sm:text-sm focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
          />
        </div>

        {!isLogin && (
          <div className="space-y-2.5 pt-1">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
              <span className="text-xs font-medium leading-snug text-muted-foreground">
                He leído y estoy de acuerdo con los{" "}
                {/* Sin página de términos y condiciones real todavía — enlaza a
                    "Cómo funciona" (/trust) como el contenido legal/operativo
                    más cercano que existe hoy. Reemplazar por una página
                    dedicada apenas exista el texto legal real. */}
                <Link
                  to="/trust"
                  className="font-bold text-[var(--color-accent-token)] hover:underline"
                >
                  términos y condiciones
                </Link>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={acceptedMarketing}
                onChange={(e) => setAcceptedMarketing(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]"
              />
              <span className="text-xs font-medium leading-snug text-muted-foreground">
                Acepto recibir información comercial sobre Buelazo
              </span>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!isLogin && !acceptedTerms)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary-token)] px-4 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLogin ? (
            "Iniciar sesión"
          ) : (
            "Crear cuenta"
          )}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm font-bold text-[var(--color-primary-token)] hover:underline"
        >
          {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}
