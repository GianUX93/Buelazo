import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import type { ChatMessage } from "./types";

// Vive por encima del router (montado en __root.tsx) para que la conversación
// con lucIA sobreviva la navegación a /flight/$id y de vuelta — si viviera
// dentro de ExploreAgentPanel se perdería al desmontar la ruta /explore.
interface ChatSessionContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  pendingAlert: { from: string; to: string } | null;
  setPendingAlert: (v: { from: string; to: string } | null) => void;
  sessionId: string;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAlert, setPendingAlert] = useState<{ from: string; to: string } | null>(null);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  // La conversación no está atada a ningún usuario, pero SÍ puede contener
  // datos suyos (ubicación compartida, rutas preguntadas, alertas armadas) —
  // si otra persona inicia sesión en el mismo navegador después, no debe
  // heredar ni ver nada de eso. Cualquier cambio de identidad (logout,
  // login como otra cuenta, o incluso el mismo usuario volviendo a entrar)
  // reinicia el chat de cero, con un sessionId nuevo para que la memoria del
  // lado de n8n tampoco arrastre contexto de la sesión anterior.
  const { user } = useAuth();
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (lastUserId.current === undefined) {
      lastUserId.current = currentId;
      return;
    }
    if (lastUserId.current !== currentId) {
      lastUserId.current = currentId;
      setMessages([]);
      setPendingAlert(null);
      setSessionId(crypto.randomUUID());
    }
  }, [user]);

  return (
    <ChatSessionContext.Provider
      value={{ messages, setMessages, pendingAlert, setPendingAlert, sessionId }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error("useChatSession must be used within ChatSessionProvider");
  return ctx;
}
