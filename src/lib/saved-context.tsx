import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "./auth-context";
import { useAuthModal } from "./auth-modal-context";
import { getMySavedFlightIds, saveFlight, unsaveFlight } from "./services/saved-flights";
import { incrementFlightCounter } from "./services/flights";

type SavedContextValue = {
  savedIds: string[];
  isSaved: (flightId: string) => boolean;
  toggleSaved: (flightId: string) => void;
  removeSaved: (flightId: string) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isRealUser = !!user && !user.id.startsWith("sim-");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  // Intención pendiente cuando se pide login desde el corazón de guardar —
  // el modal abre en el lugar (sin navegar), así que apenas detecta sesión
  // real acá abajo simplemente se reintenta el mismo guardado, en memoria,
  // sin pasar por localStorage (eso solo hacía falta cuando login era una
  // página aparte a la que había que volver).
  const pendingToggleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isRealUser) {
      setSavedIds([]);
      return;
    }
    getMySavedFlightIds(user!.id)
      .then(setSavedIds)
      .catch(() => {});
    if (pendingToggleRef.current) {
      const flightId = pendingToggleRef.current;
      pendingToggleRef.current = null;
      performToggle(flightId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealUser, user]);

  function isSaved(flightId: string) {
    return savedIds.includes(flightId);
  }

  function toggleSaved(flightId: string) {
    // Sin sesión no hay nada real que guardar (no persiste en ningún lado) —
    // antes esto igual mostraba el toast de éxito, dando a entender que sí se
    // guardó. Ahora abre el modal de login en el lugar (sin navegar) en vez
    // de fingir que funcionó o mandar a una página aparte.
    if (!isRealUser) {
      pendingToggleRef.current = flightId;
      openAuthModal("login");
      return;
    }
    performToggle(flightId);
  }

  function performToggle(flightId: string) {
    const yaGuardado = savedIds.includes(flightId);
    setSavedIds((prev) =>
      yaGuardado ? prev.filter((id) => id !== flightId) : [...prev, flightId],
    );

    const op = yaGuardado ? unsaveFlight(user!.id, flightId) : saveFlight(user!.id, flightId);
    op.then(() => {
      incrementFlightCounter(flightId, "saved_count", yaGuardado ? -1 : 1);
    }).catch(() => {
      // Revierte el optimistic update si falló en el servidor.
      setSavedIds((prev) =>
        yaGuardado ? [...prev, flightId] : prev.filter((id) => id !== flightId),
      );
      toast.error("No se pudo actualizar tus guardados.");
    });

    if (yaGuardado) {
      toast("Quitado de guardados");
    } else {
      toast.custom((id) => (
        <div className="flex w-full gap-3 rounded-lg bg-white p-4 shadow-lg border border-border">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-secondary-token)]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--color-ink)]">
              Guardado en tus favoritos
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Lo encuentras en tu perfil, en Viajes guardados.
            </p>
            <button
              type="button"
              onClick={() => {
                navigate({ to: "/profile", search: { tab: "guardados" } });
                toast.dismiss(id);
              }}
              className="mt-1.5 text-sm font-bold text-[var(--color-primary-token)] hover:underline"
            >
              Ver guardados
            </button>
          </div>
        </div>
      ));
    }
  }

  function removeSaved(flightId: string) {
    setSavedIds((prev) => prev.filter((id) => id !== flightId));
    if (isRealUser) {
      unsaveFlight(user!.id, flightId)
        .then(() => {
          incrementFlightCounter(flightId, "saved_count", -1);
        })
        .catch(() => {
          toast.error("No se pudo quitar de guardados.");
        });
    }
  }

  return (
    <SavedContext.Provider value={{ savedIds, isSaved, toggleSaved, removeSaved }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved debe usarse dentro de SavedProvider");
  return ctx;
}
