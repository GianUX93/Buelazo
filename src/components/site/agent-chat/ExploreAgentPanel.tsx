import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Send, Sparkles, BellRing, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createRouteAlert } from "@/lib/services/route-alerts";
import { askAgent } from "@/lib/chat-agent/webhook-client";
import { useChatSession } from "@/lib/chat-agent/chat-session-context";
import { nearestAirportCity } from "@/lib/chat-agent/geo";
import { airportsList } from "@/lib/mock-data";
import type { ChatMessage } from "@/lib/chat-agent/types";
import { ChatMessageBubble, ChatThinkingBubble } from "./ChatMessageBubble";
import { AlertConfirmCard } from "./AlertConfirmCard";
import { LocationPromptCard } from "./LocationPromptCard";

// Una vez que el usuario comparte o rechaza la ubicación, no se le vuelve a
// preguntar en ese navegador — ni un "sí" repetido tiene sentido (ya se sabe
// su ciudad) ni un "ahora no" debe convertirse en una pregunta insistente.
const LOCATION_PROMPT_KEY = "buelazo-lucia-location-prompt";

let msgCounter = 0;
function nextId(): string {
  msgCounter += 1;
  return `chat-msg-${msgCounter}`;
}

function agentMessage(partial: Omit<ChatMessage, "id" | "role" | "timestamp">): ChatMessage {
  return { id: nextId(), role: "agent", timestamp: new Date().toISOString(), ...partial };
}

// Curadas para Buelazo — no genéricas ("pregúntame algo") — para que reducir
// la fricción de escribir desde cero se sienta parte del producto.
const SUGGESTIONS = [
  "Vuelos a Cusco este fin de semana",
  "Lo más barato a Arequipa",
  "Con equipaje incluido",
  "🔔 Avísame de una ruta nueva",
];

// Frases de ejemplo que "se escriben solas" en el input vacío antes de hacer
// foco (inspirado en el buscador de Despegar/SOFIA) — le muestran al usuario
// qué tipo de conversación puede tener con lucIA sin que tenga que adivinar.
const TYPEWRITER_PHRASES = [
  "Busco un vuelo a Cusco para el próximo fin de semana",
  "¿Cuál es la opción más barata a Arequipa?",
  "Necesito un pasaje con equipaje incluido",
  "Avísame cuando aparezca un vuelo a Trujillo",
];

const TYPE_MS = 45;
const DELETE_MS = 25;
const HOLD_MS = 1600;
const PAUSE_MS = 400;

// Efecto máquina de escribir en loop: escribe una frase, la sostiene, la
// borra y pasa a la siguiente — se apaga por completo mientras `enabled` es
// false (foco en el input, o ya hay una conversación en curso).
function useTypewriterPlaceholder(phrases: string[], enabled: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!enabled) {
      setText("");
      return;
    }
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const phrase = phrases[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setText(phrase.slice(0, charIndex));
        timeoutId = setTimeout(tick, charIndex === phrase.length ? HOLD_MS : TYPE_MS);
        if (charIndex === phrase.length) deleting = true;
      } else {
        charIndex -= 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timeoutId = setTimeout(tick, PAUSE_MS);
        } else {
          timeoutId = setTimeout(tick, DELETE_MS);
        }
      }
    }

    timeoutId = setTimeout(tick, TYPE_MS);
    return () => clearTimeout(timeoutId);
  }, [enabled, phrases]);

  return text;
}

// Modo Agéntico de Explorar: sin card/contenedor propio — mensajes e input
// flotan directo sobre el fondo de la página, como un producto de IA real
// (Claude/Gemini), no un widget de soporte embebido. Estado inicial tipo
// "pantalla de bienvenida" con saludo e input centrados; tras el primer
// mensaje el input baja al fondo y la conversación ocupa el espacio de arriba.
export function ExploreAgentPanel() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  // Vive en un context por encima del router (no como useState local) para
  // que la conversación sobreviva al ir a ver el detalle de un vuelo y volver.
  const { messages, setMessages, pendingAlert, setPendingAlert, sessionId } = useChatSession();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const started = messages.length > 0;
  const typewriterText = useTypewriterPlaceholder(TYPEWRITER_PHRASES, !started && !inputFocused);

  // Transición entre la pantalla de bienvenida y la conversación: en vez de
  // un salto brusco (un árbol de JSX reemplaza al otro de golpe), la
  // bienvenida se desvanece con una transición CSS y recién ahí se desmonta.
  // Deliberadamente CSS puro (clases + transition), no una librería de
  // animación con callbacks: si algo interrumpe la transición, el peor caso
  // es que no se vea el efecto — nunca que el contenido quede invisible para
  // siempre (fue justo lo que pasó con un intento anterior basado en GSAP).
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeExiting, setWelcomeExiting] = useState(false);

  // Depende solo de `started` a propósito: si `showWelcome`/`welcomeExiting`
  // estuvieran en las dependencias, el propio `setWelcomeExiting(true)` de
  // acá abajo dispararía este efecto de nuevo antes de que el setTimeout
  // llegue a correr, y su cleanup (clearTimeout) cancelaría el temporizador
  // — showWelcome nunca pasaba a false y la pantalla quedaba en opacidad 0
  // para siempre. Ese fue el bug real de la versión anterior.
  useEffect(() => {
    if (started) {
      setWelcomeExiting(true);
      const timeoutId = setTimeout(() => {
        setShowWelcome(false);
        setWelcomeExiting(false);
      }, 250);
      return () => clearTimeout(timeoutId);
    }
    // La conversación se vació de golpe (ej. cambio de usuario, que reinicia
    // el chat sin pasar por "enviar un mensaje") — vuelve a la bienvenida
    // directo, sin animación de salida que ya no aplica.
    setShowWelcome(true);
    setWelcomeExiting(false);
  }, [started]);

  // Heurística simple (no un NLU nuevo): si el usuario ya escribió el nombre
  // de alguna de las 8 ciudades que cubre el marketplace, se asume que el
  // origen ya quedó dicho en la propia conversación — no hace falta pedir
  // ubicación para algo que lucIA ya puede haber entendido del texto.
  const originMentioned = useMemo(() => {
    const text = messages
      .filter((m) => m.role === "user")
      .map((m) => m.text ?? "")
      .join(" ")
      .toLowerCase();
    return airportsList.some((a) => text.includes(a.city.toLowerCase()));
  }, [messages]);

  // Se pregunta una sola vez por navegador — nunca al mount con un valor
  // adivinado, así el botón no aparece ni desaparece de golpe tras la carga.
  const [locationPromptDone, setLocationPromptDone] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  useEffect(() => {
    try {
      setLocationPromptDone(localStorage.getItem(LOCATION_PROMPT_KEY) === "1");
    } catch {
      setLocationPromptDone(true);
    }
  }, []);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function handleMessagesScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 120);
  }

  function markLocationPromptDone() {
    setLocationPromptDone(true);
    try {
      localStorage.setItem(LOCATION_PROMPT_KEY, "1");
    } catch {
      // Sin storage disponible (privado/bloqueado): no insiste en este
      // render, pero puede volver a preguntar en la próxima visita — mejor
      // eso que romper el flujo por un error de escritura.
    }
  }

  function dismissLocationPrompt() {
    markLocationPromptDone();
  }

  function shareLocation() {
    if (!navigator.geolocation) {
      markLocationPromptDone();
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLoading(false);
        markLocationPromptDone();
        const city = nearestAirportCity(pos.coords.latitude, pos.coords.longitude);
        if (city) sendText(`Estoy viajando desde ${city}`);
      },
      () => {
        // Denegado o falló: se respeta como un "ahora no" — no se vuelve a
        // insistir en este navegador.
        setLocationLoading(false);
        markLocationPromptDone();
      },
      { timeout: 8000 },
    );
  }

  // El input se deshabilita mientras "thinking" está activo (evita que se
  // sigan mandando mensajes mientras se espera respuesta) — al deshabilitarse
  // pierde el foco y el navegador no lo restaura solo. Se lo devolvemos apenas
  // vuelve a estar habilitado, para no obligar a hacer click de nuevo.
  useEffect(() => {
    if (!thinking) inputRef.current?.focus();
  }, [thinking]);

  function pushAgentText(text: string) {
    setMessages((prev) => [...prev, agentMessage({ text })]);
  }

  async function confirmAlert() {
    if (!pendingAlert || !user) return;
    const { from, to } = pendingAlert;
    try {
      await createRouteAlert(user.id, from, to);
      setPendingAlert(null);
      pushAgentText("Listo, te voy a avisar apenas aparezca algo.");
      // Mismo feedback que la alerta creada desde la búsqueda manual: no solo
      // texto en el chat, también el toast persistente con acceso directo a
      // "Ver alertas" — una alerta creada es el mismo evento, sea cual sea la
      // ruta desde la que se disparó.
      toast.custom((toastId) => (
        <div className="flex w-full gap-3 rounded-lg border border-border bg-white p-4 shadow-lg">
          <BellRing className="h-5 w-5 shrink-0 text-[var(--color-secondary-token)]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--color-ink)]">Alerta creada</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Te avisaremos cuando aparezca un pasaje para {from} → {to}.
            </p>
            <button
              type="button"
              onClick={() => {
                navigate({ to: "/profile", search: { tab: "preferencias" } });
                toast.dismiss(toastId);
              }}
              className="mt-1.5 text-sm font-bold text-[var(--color-primary-token)] hover:underline"
            >
              Ver alertas
            </button>
          </div>
        </div>
      ));
    } catch {
      toast.error("No se pudo crear la alerta.");
    }
  }

  function cancelAlert() {
    setPendingAlert(null);
    pushAgentText("Ok, no la creo.");
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setDraft("");
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: trimmed, timestamp: new Date().toISOString() },
    ]);
    setThinking(true);

    try {
      const response = await askAgent({
        message: trimmed,
        sessionId,
        currentUserId: user?.id ?? null,
      });

      // Ofrecer una alerta de ruta solo tiene sentido cuando NO hay vuelos que
      // mostrar — si n8n manda ambos por error (pasó: encontró resultados y
      // aun así incluyó alertConfirm), se prioriza mostrar los vuelos reales
      // y se ignora la oferta de alerta, en vez de ocultar los resultados
      // detrás de la tarjeta de confirmación.
      const hasFlights = !!response.flights?.length;
      const alertConfirm = hasFlights ? undefined : response.alertConfirm;
      if (alertConfirm) setPendingAlert(alertConfirm);

      // Degradación: si no llegó ni texto ni vuelos válidos, no se deja una
      // burbuja vacía — se muestra un mensaje genérico en vez de romper la vista.
      setMessages((prev) => [
        ...prev,
        agentMessage({
          text:
            response.reply ||
            (hasFlights ? undefined : "No pude entender esa respuesta, ¿lo intentamos de nuevo?"),
          flights: response.flights,
          explanations: response.explanations,
          alertConfirm,
        }),
      ]);
    } catch {
      pushAgentText("No pude conectarme en este momento. Intenta de nuevo en unos segundos.");
    } finally {
      setThinking(false);
    }
  }

  // Borde con degradé de marca (teal → morado → coral) en vez de un borde
  // gris plano — inspirado en el buscador de SOFIA (Despegar), le da al
  // input del chat una identidad de producto de IA más que de campo genérico.
  const inputBar = (
    <div
      className={`rounded-full bg-gradient-to-r from-[var(--color-secondary-token)] via-[var(--color-accent-token)] to-[var(--color-primary-token)] p-[1.5px] ${
        started ? "" : "shadow-md"
      }`}
    >
      <div className="flex items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2">
        <div className="relative min-w-0 flex-1">
          {!started && !inputFocused && !draft && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-nowrap text-base text-muted-foreground"
            >
              {typewriterText}
              <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-muted-foreground" />
            </span>
          )}
          <input
            ref={inputRef}
            className="w-full bg-transparent text-base text-[var(--color-ink)] placeholder:text-muted-foreground focus:outline-none"
            placeholder={
              started ? "Pregúntale a lucIA..." : inputFocused ? "Escribe tu consulta..." : ""
            }
            value={draft}
            disabled={thinking}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText(draft)}
          />
        </div>
        <button
          type="button"
          onClick={() => sendText(draft)}
          disabled={!draft.trim() || thinking}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary-token)] text-white shadow-sm transition-all hover:scale-105 active:scale-95 disabled:scale-100 disabled:bg-muted-foreground/25 disabled:text-muted-foreground disabled:shadow-none"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (showWelcome) {
    return (
      <div
        className={`flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center transition-all duration-300 ease-in ${
          welcomeExiting ? "-translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[var(--color-primary-token)] to-[var(--color-accent-token)]">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-[var(--color-ink)] md:text-4xl">
            Hola{profile?.first_name ? `, ${profile.first_name}` : ""}, ¿a dónde quieres viajar?
          </h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Cuéntame lo que buscas o pídeme que te avise de una ruta nueva.
          </p>
        </div>

        <div className="w-full max-w-xl">{inputBar}</div>

        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendText(s.replace("🔔 ", ""))}
              className="relative overflow-hidden rounded-full border border-border bg-white px-4 py-2 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent-token)]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    // flex-1 en vez de un alto calculado a mano: el padre (gridRef en
    // explore.tsx) ya es flex-col con min-h real del viewport, así este panel
    // reparte exactamente el espacio sobrante sin dejar hueco ni recortarse,
    // sea cual sea la altura real de la fila del botón de arriba.
    <div className="animate-panel-in relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto py-4"
      >
        {messages.map((m, i) => (
          <div
            key={m.id}
            className="animate-msg-in"
            style={{ animationDelay: `${Math.min(i, 4) * 90}ms` }}
          >
            {m.alertConfirm ? (
              <AlertConfirmCard
                text={m.text ?? ""}
                onConfirm={confirmAlert}
                onCancel={cancelAlert}
                resolved={pendingAlert ? undefined : "confirmed"}
              />
            ) : (
              <ChatMessageBubble message={m} />
            )}
          </div>
        ))}
        {thinking && <ChatThinkingBubble />}
        {/* Aparece durante la conversación, no antes de que el usuario escriba
            nada — solo si ya hubo al menos una respuesta y en ningún momento
            mencionó su ciudad de origen. Si acepta, lucIA ya lo sabe y no
            tiene que volver a preguntarlo. */}
        {!thinking &&
          !locationPromptDone &&
          !originMentioned &&
          messages.some((m) => m.role === "agent") && (
            <LocationPromptCard
              onShare={shareLocation}
              onDismiss={dismissLocationPrompt}
              loading={locationLoading}
            />
          )}
        <div ref={messagesEndRef} />
      </div>

      {/* Solo aparece si el usuario subió a leer mensajes viejos — en chats
          largos, volver al final a mano requiere scrollear a ciegas. */}
      {showScrollToBottom && (
        <button
          type="button"
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Ir al final de la conversación"
          className="absolute bottom-24 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full bg-[var(--color-ink)]/85 text-white shadow-md backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}

      <div className="mt-4">
        {inputBar}
        <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground">
          lucIA puede contener datos imprecisos
        </p>
      </div>
    </div>
  );
}
