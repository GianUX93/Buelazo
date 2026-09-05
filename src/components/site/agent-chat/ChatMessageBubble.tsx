import { useEffect, useState } from "react";
import { User } from "lucide-react";
import type { ChatMessage } from "@/lib/chat-agent/types";
import { computeStatus } from "@/lib/flight-utils";
import { FlightCard } from "@/components/site/FlightCard";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatAgentAvatar } from "./ChatAgentAvatar";

// Usuario = burbuja gris sutil + su propio avatar (foto real si tiene, si no
// un ícono genérico) — nunca el coral sólido de antes, que competía demasiado
// con el resto de acciones primarias de la app. lucIA = texto plano sin caja,
// como una respuesta real de un asistente, no un mensaje de chat genérico.
export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const { profile } = useAuth();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-2.5">
        {message.text && (
          <div className="max-w-[75%] rounded-2xl rounded-br-md border border-border bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] shadow-sm">
            {message.text}
          </div>
        )}
        <Avatar className="h-7 w-7 shrink-0 border border-border">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
          <AvatarFallback className="bg-surface-2 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {message.text && (
        <div className="flex items-end gap-2.5">
          <ChatAgentAvatar size="sm" />
          <p className="max-w-[75%] text-sm font-medium leading-snug text-[var(--color-ink)]">
            {message.text}
          </p>
        </div>
      )}
      {message.flights && message.flights.length > 0 && (
        // Mismo ancho y separación que la grilla de resultados de la búsqueda
        // manual (gap-5, sin indentar bajo el avatar) — no una versión más
        // angosta solo por estar dentro del chat.
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {message.flights.map((f) => (
            // "grid" en vez de "flex flex-col": dentro de un flex column,
            // `self-start` de FlightCard cae en el eje cruzado (ancho) y lo
            // encoge a su contenido — como grid item sí estira a todo el
            // ancho de la columna, igual que en la grilla de búsqueda manual.
            <div key={f.id} className="grid gap-1.5">
              <FlightCard
                flight={f}
                variant={computeStatus(f) === "last_call" ? "last_call" : "active"}
                linkFrom="agente"
              />
              {message.explanations?.[f.id] && (
                <p className="px-1 text-xs leading-snug text-muted-foreground">
                  {message.explanations[f.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Frases relacionadas al contexto real de Buelazo — nunca un genérico
// "cargando..." — para que se sienta que lucIA está haciendo algo concreto.
const THINKING_PHRASES = [
  "Buscando entre las publicaciones activas...",
  "Comparando precios y descuentos...",
  "Revisando fechas y rutas disponibles...",
  "Cruzando asientos y equipaje...",
  "Casi listo...",
];

const PHRASE_MS = 2200;
const FADE_MS = 300;

export function ChatThinkingBubble() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % THINKING_PHRASES.length);
        setVisible(true);
      }, FADE_MS);
    }, PHRASE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-end gap-2.5">
      <ChatAgentAvatar size="sm" />
      <span
        className={`inline-block bg-clip-text text-sm font-medium text-transparent transition-opacity animate-text-shimmer ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transitionDuration: `${FADE_MS}ms`,
          backgroundImage:
            "linear-gradient(90deg, var(--muted-foreground) 40%, var(--color-primary-token) 50%, var(--muted-foreground) 60%)",
          backgroundSize: "200% 100%",
        }}
      >
        {THINKING_PHRASES[index]}
      </span>
    </div>
  );
}
