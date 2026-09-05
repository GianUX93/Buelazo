import { createContext, useContext, useState, type ReactNode } from "react";

// Título/descripción alternativos para AuthForm, solo cuando el modal se
// abre con contexto de una acción en curso (ej. "ya tenemos los datos de tu
// vuelo") — reemplazan el copy genérico ("Inicia sesión / Bienvenido de
// vuelta") que se usa para el botón "Ingresar" del header o cualquier otro
// gatillo sin contexto puntual.
export interface AuthModalContext {
  title: string;
  text: string;
}

// Estado global del modal de login/signup — montado una sola vez en
// __root.tsx (AuthModal), disparado desde cualquier punto de la app
// (header, useRequireAuth, comprar/guardar sin sesión, Paso 1 de Vender
// vuelos) sin navegar a ninguna página nueva, para que el usuario nunca
// pierda dónde estaba.
interface AuthModalContextValue {
  isOpen: boolean;
  mode: "login" | "signup";
  context: AuthModalContext | null;
  openAuthModal: (mode?: "login" | "signup", context?: AuthModalContext) => void;
  closeAuthModal: () => void;
}

const AuthModalCtx = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [context, setContext] = useState<AuthModalContext | null>(null);

  return (
    <AuthModalCtx.Provider
      value={{
        isOpen,
        mode,
        context,
        openAuthModal: (m = "login", ctx) => {
          setMode(m);
          setContext(ctx ?? null);
          setIsOpen(true);
        },
        closeAuthModal: () => {
          setIsOpen(false);
          setContext(null);
        },
      }}
    >
      {children}
    </AuthModalCtx.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalCtx);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
