import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAuthModal } from "./auth-modal-context";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null; // We will define a strict profile type later
  isLoading: boolean;
  // true entre que se pide un signOut() explícito y que termina de resolverse
  // — useRequireAuth() lo usa para no reabrir el modal de login cuando `user`
  // pasa a null por un logout intencional (ver ese hook, más abajo).
  isSigningOut: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error fetching profile", err);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    // Se resetea con un pequeño margen, no en el mismo tick en que `user` pasa
    // a null: si se reseteara de inmediato, useRequireAuth() vería user=null
    // e isSigningOut=false en la misma pasada y reabriría el modal justo
    // cuando SiteHeader ya está navegando a home tras el logout. Pasado este
    // margen ya no importa — la página protegida que lo necesitaba se
    // desmontó.
    window.setTimeout(() => setIsSigningOut(false), 300);
  };

  // Vuelve a leer el perfil real desde Supabase — usado tras editar un campo
  // (ej. teléfono) para que el resto de la app refleje el cambio sin recargar.
  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, isLoading, isSigningOut, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Guard de rutas protegidas, resuelto 100% en el cliente. La sesión de Supabase
// vive en localStorage, invisible durante el render en servidor de TanStack
// Start — un `beforeLoad` que la consulte ahí siempre falla en la primera
// carga o en un refresh. Este hook evita ese problema: abre el modal de login
// desde un efecto una vez que el cliente ya sabe si hay sesión o no, en vez
// de navegar a /login — la ruta protegida (publicar, mis operaciones, etc.)
// se queda montada detrás y aparece sola en cuanto `user` exista.
export function useRequireAuth() {
  const { user, isLoading, isSigningOut } = useAuth();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    // isSigningOut: un logout intencional desde una página protegida ya
    // redirige a home por su cuenta (ver SiteHeader.tsx) — sin este freno,
    // este mismo efecto reabre el modal de login un instante antes de que esa
    // navegación surta efecto, y queda flotando sobre el home.
    if (!isLoading && !user && !isSigningOut) {
      openAuthModal("login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, isSigningOut]);

  return { ready: !isLoading && !!user, isLoading };
}
