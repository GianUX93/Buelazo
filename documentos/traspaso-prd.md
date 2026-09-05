# Buelazo — PRD (Product Requirements Document)

**Estado:** Prototipo funcional con **backend real en Supabase** (Postgres + Auth + Storage + Realtime) y **agente conversacional real en n8n** (webhook + AI Agent + memoria + tool de Supabase)
**Última actualización:** septiembre 2026
**Propósito de este documento:** que cualquier persona o agente de IA (Claude Code, Antigravity, etc.) pueda retomar el proyecto sin perder contexto, aunque haya pasado tiempo sin tocarlo.
**Nota de marca:** el producto se llamó "Traspaso"; el nombre comercial real es **Buelazo** (logo, título de página, textos de marca). La palabra minúscula "traspaso" sigue usándose como sustantivo genérico de la acción de endosar un pasaje — no confundir ambos usos.

---

## 1. Resumen ejecutivo

Buelazo es un marketplace P2P peruano donde usuarios que no van a usar su pasaje aéreo nacional lo endosan y venden con descuento a otros usuarios. La plataforma verifica el traspaso, retiene el pago en garantía (escrow) hasta confirmarlo, y cobra una comisión variable al vendedor. Alcance: solo vuelos nacionales, en LATAM, Sky Airline y JetSmart.

El prototipo cubre hoy el recorrido completo de punta a punta (registro/login real vía modal, explorar manual o conversacional, publicar con revisión manual, comprar, gestionar el trámite de endoso con chat y notificaciones reales, liberar el pago) sobre un **backend real de Supabase** (autenticación, base de datos con RLS, Storage, Realtime) y un **agente conversacional real sobre n8n** que consulta ese mismo inventario. Lo que sigue siendo simulado es la pasarela de pago (no se procesa dinero real) y el autocompletado por visión al publicar (ver sección 9, Limitaciones conocidas).

Proyecto con doble propósito: negocio real a validar, y pieza de portafolio de producto/diseño.

## 2. Stack técnico y entorno de desarrollo

- **Frontend:** React + Vite + TanStack Router + TanStack Query + Tailwind CSS (v4, dado el uso de sufijo `!` para overrides — ver sección 6)
- **Backend de datos:** Supabase — Postgres (con Row Level Security en todas las tablas), Supabase Auth (email/password + Google OAuth), Supabase Storage (buckets públicos para adjuntos), Supabase Realtime (chat y notificaciones vía suscripción a cambios en tablas)
- **Agente conversacional:** n8n (`gianca93.app.n8n.cloud`) — un workflow con Webhook de entrada → AI Agent (memoria de sesión + modelo DeepSeek + tool "Get many rows in Supabase" vía HTTP Request a la REST API de Supabase) → Respond to Webhook. Ver sección 7 para el contrato completo.
- **Animación:** GSAP (`gsap` + `@gsap/react`, hook `useGSAP`) para scroll-reveals, parallax y transiciones de layout entre pasos — **evitado deliberadamente** para transiciones de visibilidad de contenido críticas (ver el bug catalogado en 6.10: una animación GSAP interrumpida puede dejar contenido en `opacity: 0` para siempre; para eso se usa CSS puro con `animation-fill-mode: both`).
- **Entorno de desarrollo:** Claude Code / Google Antigravity operando directo sobre el repo; cambios de esquema/RLS de Supabase se entregan como SQL para que el fundador los ejecute manualmente en el SQL Editor (el agente no tiene acceso directo a la base de datos); cambios al workflow de n8n se coordinan vía una sesión de Claude.ai con conexión MCP a n8n, que el fundador opera directamente.
- **Origen del prototipo:** primera versión visual generada con un prompt para Lovable (UI con datos mock); desarrollo posterior en Antigravity (rediseño visual + evolución funcional sobre mocks); migración a backend real y construcción del agente conversacional hechas en sesiones posteriores con Claude Code.
- **Componentes base:** Radix/shadcn (`Dialog`, `DropdownMenu`, `Popover`, `Slider`, etc.), en `src/components/ui/`.

### Estructura de archivos

| Área | Archivo |
|---|---|
| Cliente de Supabase | `src/lib/supabase.ts` |
| Autenticación / sesión / perfil | `src/lib/auth-context.tsx` |
| Estado global del modal de login/signup | `src/lib/auth-modal-context.tsx` |
| Modelo de datos y tipos compartidos (ya no contiene transacciones/vuelos mock activos) | `src/lib/mock-data.ts` |
| Lógica de negocio pura (helpers de precio, fecha, tramo, asiento) | `src/lib/flight-utils.ts` |
| Estado global de alertas de ruta + notificaciones reales | `src/lib/alerts-context.tsx` |
| Estado global de guardados (favoritos) | `src/lib/saved-context.tsx` |
| Estado global de método de pago/cobro guardado | `src/lib/payment-context.tsx` |
| Estado del header (transparencia sobre hero / visibilidad del footer) | `src/lib/header-visual-context.tsx` |
| Estado global de la conversación con lucIA (mensajes, sessionId) | `src/lib/chat-agent/chat-session-context.tsx` |
| Cliente del webhook de n8n + adaptador de datos | `src/lib/chat-agent/webhook-client.ts` |
| Tipos del chat agent (mensajes, shape crudo del webhook) | `src/lib/chat-agent/types.ts` |
| Geolocalización → aeropuerto más cercano (para el chat) | `src/lib/chat-agent/geo.ts` |
| Borrador local de "Vender vuelos" (localStorage) | `src/lib/publish-draft.ts` |
| Prefijos de teléfono por país (`splitPhone`/`joinPhone`) | `src/lib/phone-prefixes.ts` |
| Servicios Supabase — vuelos, publicación, revisión, aprobar/rechazar, precios de mercado | `src/lib/services/flights.ts` |
| Servicios Supabase — transacciones, escrow, disputas, cargo de aerolínea, confirmación del comprador | `src/lib/services/transactions.ts` |
| Servicios Supabase — chat interno por transacción + realtime | `src/lib/services/chat.ts` |
| Servicios Supabase — notificaciones + realtime | `src/lib/services/notifications.ts` |
| Servicios Supabase — vuelos/alertas de ruta guardados | `src/lib/services/route-alerts.ts` |
| Servicios Supabase — favoritos | `src/lib/services/saved-flights.ts` |
| Servicios Supabase — métodos de pago/cobro guardados | `src/lib/services/payment-methods.ts` |
| Servicios Supabase — edición de perfil (teléfono, etc.) | `src/lib/services/profile.ts` |
| Servicio de CSAT / feedback de features (tabla `feature_feedback`) | `src/lib/services/feedback.ts` |
| Login / registro (ruta directa, reutiliza `AuthForm`) | `src/routes/login.tsx` |
| Formulario compartido de login/signup | `src/components/site/auth/AuthForm.tsx` |
| Modal de login/signup montado en la raíz | `src/components/site/auth/AuthModal.tsx` |
| Placeholder "Necesitas iniciar sesión" para rutas protegidas | `src/components/site/auth/AuthRequiredPlaceholder.tsx` |
| Explorar vuelos (modo Manual + modo Agéntico) | `src/routes/explore.tsx` |
| Panel del chat conversacional (modo Agéntico) | `src/components/site/agent-chat/ExploreAgentPanel.tsx` |
| Burbujas de mensaje + indicador "pensando" | `src/components/site/agent-chat/ChatMessageBubble.tsx` |
| Card de confirmación de alerta dentro del chat | `src/components/site/agent-chat/AlertConfirmCard.tsx` |
| Card de solicitud de ubicación dentro del chat | `src/components/site/agent-chat/LocationPromptCard.tsx` |
| Avatar del agente (gradiente + sparkle) | `src/components/site/agent-chat/ChatAgentAvatar.tsx` |
| Nombre "lucIA" en degradé de marca (componente reutilizable) | `src/components/site/agent-chat/LucIAName.tsx` |
| Detalle de vuelo | `src/routes/flight.$id.tsx` |
| Publicar pasaje (con revisión manual, login diferido, borrador) | `src/routes/publish.tsx` |
| Modal de recuperación de borrador de "Vender vuelos" | `src/components/site/publish/PublishDraftRecoveryModal.tsx` |
| Editar publicación existente | `src/routes/edit-flight.$id.tsx` |
| Mis operaciones (dashboard comprador/vendedor) | `src/routes/dashboard.tsx` |
| Perfil | `src/routes/profile.tsx` |
| Alertas (página) | `src/routes/alertas.tsx` |
| Panel de administración — revisión de publicaciones y cargos de aerolínea | `src/routes/admin.revisiones.tsx` |
| Header / nav | `src/components/site/SiteHeader.tsx` |
| Tarjeta de vuelo (reutilizada también dentro del chat) | `src/components/site/FlightCard.tsx` |
| Input de teléfono con selector de país | `src/components/site/PhoneInput.tsx` |
| Campos compartidos del formulario de publicar/editar vuelo (con soporte de estado "warning") | `src/components/site/PublishFormFields.tsx` |
| Tokens de diseño + animaciones CSS | `src/styles.css` |
| Componentes base (Dialog, Dropdown, Popover, Slider) | `src/components/ui/` |

## 3. Problema y contexto de mercado

Ver Documento Maestro para la versión comercial. Puntos técnicos relevantes:

- **Competencia directa identificada:** Rename Travel (Perú), modelo similar, comisión plana del 15%. Vacíos detectados: no descuenta el cargo de aerolínea en su cálculo de neto (solo lo advierte en texto), permite fechas/inventario potencialmente vencido, buscador rígido tipo Google Flights (mal ajuste para inventario finito de terceros), sin agente conversacional.
- **Marco legal:**
  - Ley 29571 (Código de Protección y Defensa del Consumidor) — base histórica del derecho de endoso.
  - Ley N° 32325 (mayo 2025) — refuerza el endoso gratuito de pasajes nacionales, solicitado con ≥24h de anticipación, sin cambio de condiciones del vuelo.
  - **Ambigüedad legal sin resolver:** fuentes serias discrepan sobre si la gratuidad de la Ley 32325 cubre los "gastos administrativos" del trámite. Un estudio de abogados corporativo (Olaechea) sostiene que estos gastos siguen siendo cobrables bajo el Código de Protección al Consumidor; otra fuente sostiene que no se puede cobrar nada, ni siquiera la emisión del nuevo boleto. En la práctica, Rename Travel opera asumiendo que sí existe un cargo real.
  - Precedente Indecopi vs. Avianca (confirmado en Corte Suprema): reconoce el derecho a endosar los tramos **no usados** de un pasaje ida y vuelta, no solo el boleto completo.
  - Cargos de aerolínea documentados (pueden estar desactualizados respecto a la Ley 32325, no verificados en la práctica actual): Sky Airline ~USD 15 por segmento en endosos DOMPE; JetSmart cargo variable no publicado; LATAM sin cargo identificado.

## 4. Usuarios objetivo

Ver Documento Maestro. **Autenticación real vía Supabase Auth** (email/password + Google) — "Cerrar sesión" es una sesión real que se cierra de verdad (ver sección 6).

## 5. El agente conversacional (lucIA)

### 5.1 Objetivo y ubicación

Alternativa a la búsqueda manual de "Explorar vuelos": el comprador conversa en lenguaje natural ("vuelos a Cusco este fin de semana, lo más barato") y recibe cards reales de inventario, explicaciones, y puede pedir alertas de ruta sin salir del chat. Vive en `/explore`, alternado con la búsqueda manual mediante un botón único que cambia de modo (no un selector de dos pestañas) — la posición y el look del botón dependen del modo activo: en Manual, "Buscar con lucIA" con borde en degradé de marca sobre la foto del hero; en Agéntico, "Filtros manuales" con estilo plano.

### 5.2 Arquitectura

```
Frontend (askAgent en webhook-client.ts)
  → POST https://gianca93.app.n8n.cloud/webhook/Gianca
    body: { message: string, sessionId: string, currentUserId: string | null }
  → n8n: Webhook → AI Agent (memoria de sesión + DeepSeek + tool Supabase) → Respond to Webhook
  → respuesta: { output: { reply: string, flights?: [...], alertConfirm?: {...} } }
```

- **`sessionId`**: generado una sola vez con `crypto.randomUUID()` al montar el `ChatSessionProvider` (contexto por encima del router, en `__root.tsx`) — nunca se regenera en cada mensaje, para que el nodo de memoria de n8n mantenga contexto entre turnos de una misma conversación.
- **`currentUserId`**: el mismo `user.id` de Supabase Auth que usa la búsqueda manual para excluir publicaciones propias. Se manda siempre (`null` si no hay sesión), tanto para que n8n pueda filtrar del lado del servidor como para el filtro de seguridad del lado del cliente (ver 5.4).
- El Tool "Get many rows in Supabase" ejecuta dentro del loop de razonamiento del AI Agent (no es un paso secuencial aparte) — sus resultados solo llegan al resto del workflow a través de lo que el propio modelo decide incluir en su salida final.
- El contrato real anida todo bajo la clave `output` (lo envuelve el Structured Output Parser de n8n) — `webhook-client.ts` lo desenvuelve, y degrada con gracia (texto vacío, sin vuelos) si esa clave no viene o `flights` no es un arreglo.

### 5.3 Contrato de datos por vuelo y el adaptador

Cada elemento de `flights[]` llega en un shape plano (no el `Flight` completo que usa el resto de la app):

```json
{
  "id": "uuid real de la fila de flights",
  "airline": "LATAM",
  "origin_city": "Lima",
  "destination_city": "Cusco",
  "departure_date": "2026-09-06T13:45:00+00:00",
  "return_date": null,
  "ticket_type": "solo_ida",
  "sell_segment": "ida",
  "seat_outbound": { "tipo": "seleccionado", "estado": "ventana" },
  "seat_return": null,
  "original_price": 380,
  "resale_price": 191,
  "status": "active",
  "seller": { "id": "uuid", "name": "...", "avatarUrl": "...", "rating": 5, "verifiedId": true }
}
```

`adaptFlight()` en `webhook-client.ts` mapea esto al `Flight` completo que espera `FlightCard`, resolviendo el código de aeropuerto a partir del nombre de ciudad (contra `airportsList`). **Nunca copia campos desconocidos tal cual** — solo lee, campo por campo, lo que el contrato documenta y lo que `FlightCard` efectivamente muestra (regla de negocio: el comprador nunca debe ver `airline_fee_estimate` ni otro campo interno, aunque se filtrara por error desde n8n).

Si `id`/`seller` no vienen (contrato incompleto), se usa un `id` sintético estable (para la key de React) y un vendedor placeholder ("Vendedor verificado", sin foto ni rating) — nunca se inventa una reputación falsa. El link de detalle de una card con `id` sintético no resuelve hasta que n8n incluya el `id` real (ya corregido del lado de n8n en esta etapa).

### 5.4 Reglas de negocio del chat

- **Nunca se muestra la publicación propia del usuario logueado.** Doble capa: (1) se le pide a n8n que filtre por `currentUserId` del lado del servidor, y (2) `webhook-client.ts` aplica el mismo filtro del lado del cliente sobre `flight.seller.id`, como red de seguridad — nunca hay que confiar solo en que el LLM respete la regla de forma consistente.
- **La conversación se reinicia ante cualquier cambio de identidad** (logout, login con otra cuenta, o el mismo usuario volviendo a entrar) — `ChatSessionProvider` detecta el cambio de `user?.id` y limpia mensajes, alerta pendiente, y genera un `sessionId` nuevo. Antes de este fix, la conversación (que puede contener ubicación compartida, rutas preguntadas, alertas armadas) sobrevivía a un cambio de cuenta en el mismo navegador — una fuga real de datos entre usuarios distintos.
- **Alertas de ruta se confirman con un botón, nunca con texto libre.** Crear una alerta es una escritura en base de datos — el frontend nunca confía en que el modelo interprete correctamente un "sí" en texto libre (podría confundirse con una corrección, o el usuario podría estar respondiendo a otra cosa). n8n solo debe emitir `alertConfirm: { from, to }` (códigos IATA) para ofrecer la alerta; el clic real en "Sí, avísame" (`AlertConfirmCard`) es lo único que dispara `createRouteAlert()` — sin volver a pasar por el webhook. Al confirmar, se dispara el mismo toast "Alerta creada" que usa la búsqueda manual.
- **`alertConfirm` y `flights` son mutuamente excluyentes en una misma respuesta.** Si n8n manda ambos por error, el frontend prioriza mostrar los vuelos reales e ignora la oferta de alerta — no tiene sentido ofrecer avisar de algo que ya se encontró.
- **La card de ubicación** (`LocationPromptCard`) aparece durante la conversación (no antes del primer mensaje) solo si ya hubo una respuesta y el usuario nunca mencionó el nombre de una de las 8 ciudades del marketplace (heurística simple por texto, no un NLU nuevo). Al aceptar, se calcula el aeropuerto más cercano por Haversine (`geo.ts`) y se manda como si el usuario lo hubiera escrito ("Estoy viajando desde Lima") — no se agregó un campo nuevo al contrato del webhook. Se pregunta una sola vez por navegador (`localStorage`).
- **Transición bienvenida → conversación con CSS puro, no GSAP.** Ver el bug catalogado en 6.10 — una animación con callbacks (GSAP `onComplete`) que se interrumpe puede dejar el panel entero invisible para siempre; la transición usa clases + `setTimeout` fijo (no un callback de animación) para el des-montaje, y `@keyframes` con `animation-fill-mode: forwards` (CSS puro, sin JS controlando la visibilidad) para la entrada de la conversación y el stagger de los mensajes.

### 5.5 Página de inicio — demo pasivo

La home incluye una sección dedicada mostrando la ventaja de lucIA frente a un buscador de filtros, con un mini-demo **no funcional** (loop CSS de 9s: usuario escribe → lucIA piensa → lucIA responde con una card real de inventario) — bloqueado con `inert` + `aria-hidden` para que nada dentro sea clickeable ni foco-eable por accidente, incluida la `FlightCard` real que reutiliza.

## 6. Sistema de diseño

### 6.1 Tokens de color (`src/styles.css`)

| Token | Valor | Uso |
|---|---|---|
| `--color-primary-token` | `#FF5B49` (naranja/coral) | Acción principal, precios, marca |
| `--color-secondary-token` | `#00C2A8` (teal) | Éxito, confirmaciones, estados positivos, badges de descuento |
| `--color-warning-token` | `#FFC93C` (amarillo) | Última llamada, advertencias — **solo como fondo/badge**, nunca como color de texto/ícono (usar `--warning-ink` para texto sobre ese fondo) |
| `--color-accent-token` | `#7C5CFC` (morado) | Acento secundario, marca de lucIA (avatar, degradé) — evitado como color de hover/focus por defecto en menús (ver 6.3) |
| `--destructive` | `#DC2626` (rojo) | Errores de validación reales (ej. precio fuera de rango) |
| `--surface-2` | `#F7F7F9` (gris muy suave) | Fondo global del sitio (`body`), inputs, hover suave — no el mismo token que `--color-background` |

**Degradé de marca:** `from-[var(--color-primary-token)] to-[var(--color-accent-token)]` (coral → morado) es el degradé reutilizado en: el avatar de lucIA, el nombre "lucIA" en texto (`LucIAName.tsx`, `bg-clip-text` + `text-transparent`), el borde del input del chat y el botón "Buscar con lucIA" (técnica de wrapper con el degradé de fondo + `p-[1.5px]` + relleno **sólido** por dentro — ver el bug de 6.9 sobre por qué el relleno no puede ser semitransparente).

**Decisión clave:** el fondo del `body` usa `--surface-2` (gris suave) mientras que tarjetas y buscador usan blanco puro, para contraste real entre contenido y fondo.

**Nota de diseño explícita:** el texto en degradé (`LucIAName`) fue una decisión pedida deliberadamente por el fundador — es un patrón que, sin ese pedido explícito, se evita por defecto (puede leerse como decoración sin sentido, un "tell" común de interfaces generadas por IA).

### 6.2 Corner radius — convención homologada

- **Contenedores** (`DropdownMenuContent`, `PopoverContent`, `DialogContent`): `rounded-2xl` (o `rounded-[2rem]` en Dialog, modal de página completa)
- **Items internos** (`DropdownMenuItem`, `DropdownMenuRadioItem`, etc.): `rounded-xl`

### 6.3 Bug de contraste en hover — patrón recurrente y su fix

**Causa raíz:** componentes base de Radix/shadcn usan `focus:bg-accent` por defecto, mapeado a `--color-accent-token` (morado). Generaba hovers morados que rompían la consistencia de marca.

**Fix estándar:**
```
className="focus:bg-surface-2! focus:text-inherit!"
```
Necesario usar `!important` (sufijo `!` de Tailwind v4) porque Tailwind resuelve conflictos por orden de aparición en la hoja compilada, no por orden en el string de `className`.

### 6.4 Bug de centrado de Dialog por conflicto de `tailwind-merge`

**Causa raíz:** `DialogContent` base usa `fixed` para centrarse en viewport. Al agregar `relative` como clase adicional, `cn()`/`tailwind-merge` trató `relative` y `fixed` como el mismo grupo de conflicto de `position` y dejó ganar a `relative`, rompiendo el centrado.

**Fix:** no agregar `relative` al `DialogContent` — el ancestro `fixed` que ya trae la clase base es suficiente contenedor para posicionar hijos `absolute` dentro.

### 6.5 Input numérico controlado — bug del cero fantasma y su fix estándar

**Causa raíz:** un `<input type="number" value={x}>` muestra literalmente `"0"` en el DOM cuando `x === 0`, generando confusión al escribir el primer dígito.

**Fix estándar** (aplicado en: precio de reventa y precio original al publicar/editar — ahora sin prellenar, ver 7.3 —, monto del cargo confirmado, número de documento):
```tsx
value={x === 0 ? "" : x}
onChange={(e) => setX(e.target.value === "" ? 0 : Number(e.target.value))}
```

### 6.6 Bug de altura desigual en grids de cards (`FlightCard`)

**Causa raíz:** un `<Link>` de `FlightCard` es hijo directo de un `grid`. Por defecto, `align-items: stretch` estira todos los items de una fila a la altura del más alto.

**Fix:** `self-start` en el `<Link>` raíz de `FlightCard`.

**Bug relacionado — dentro del chat de lucIA:** al reutilizar `FlightCard` dentro de un contenedor `flex flex-col` (no un `grid`) para las cards del chat, ese mismo `self-start` cae en el eje **cruzado** de un flex-column (el ancho, no el alto), encogiendo la card a su contenido en vez de estirarla a la columna — el síntoma fue un espacio muerto grande y desparejo entre cards. **Fix:** usar `grid` (no `flex flex-col`) como wrapper de cada card individual dentro del chat, igual que ya hace la grilla de la búsqueda manual, para que `self-start` vuelva a caer solo en el eje del alto.

### 6.7 Bug del avatar propio parpadeando al iniciar sesión

**Causa raíz:** `user` se resuelve antes que `profile` (con el `avatar_url` real). El fallback a `pravatar.com` mostraba una cara genérica que luego cambiaba a la real.

**Fix:** sin fallback externo — mientras `profile` no cargó, se muestra solo el `AvatarFallback` (inicial del nombre).

### 6.8 Foco de inputs — coral vs. azul, y por qué algunos campos "ya se veían bien"

**Causa raíz real (no evidente a primera vista):** varios inputs del formulario de Publicar usan `focus:border-[var(--color-primary-token)] focus:ring-[var(--color-primary-token)]` (coral) pero **nunca desactivan el outline nativo del navegador** (`focus:outline-none`) — el contorno azul por defecto del navegador queda superpuesto y es lo que realmente se percibe como "foco azul", no una decisión de diseño intencional. Los dos campos de precio (Paso 2), en cambio, sí desactivan ese outline nativo, dejando expuesto solo el coral — que se lee como un estado de error incluso sin que lo haya.

**Fix aplicado (acotado a los dos campos de precio, no a todo el sitio):** foco explícito en azul (`border-blue-500`/`ring-blue-500`) en vez de depender del comportamiento accidental del navegador. **Pendiente de decisión:** si se quiere homologar el resto de inputs del sitio a un color de foco explícito en vez de depender del outline nativo — no se hizo por ser un cambio de alcance mucho mayor, no solicitado.

### 6.9 Bug de "borde en degradé" que termina pintando toda la caja

**Causa raíz:** la técnica de borde en degradé (wrapper con el degradé de fondo + `padding` pequeño + relleno interno) requiere que el relleno interno sea **opaco**. Usar un color con opacidad (ej. `bg-[var(--color-secondary-token)]/5`) deja ver el degradé del wrapper *a través* del relleno, pintando toda la caja en vez de solo un borde fino.

**Fix:** relleno interno siempre con un color sólido (`bg-white`, o `color-mix(in srgb, X 5%, white)` si se necesita un tinte — nunca con sufijo de opacidad tipo `/5`).

### 6.10 Bug de animación con GSAP que deja contenido invisible para siempre

**Contexto:** al construir la transición entre la pantalla de bienvenida del chat y la conversación activa, una primera versión usó GSAP: `gsap.to(elemento, { opacity: 0, ..., onComplete: () => setEstado(false) })` para la salida, y `gsap.from(contenedor, { opacity: 0, ... })` para la entrada.

**Causa raíz #1 (animación con callback interrumpida):** si el componente se re-renderiza varias veces seguidas (ej. llega la respuesta del agente casi al mismo tiempo que termina la animación), el tween puede interrumpirse antes de que `onComplete` se dispare — el elemento queda con `opacity: 0` aplicado por el propio GSAP, pero el estado de React nunca avanza para desmontarlo o revelarlo. Resultado: pantalla en blanco permanente.

**Causa raíz #2, encontrada al "arreglar" la primera (efecto que se cancela a sí mismo):** el reemplazo inicial usó un `useEffect` con `setTimeout` (en vez de `onComplete`) pero incluyó la propia variable de estado que ese mismo efecto actualiza (`welcomeExiting`) en su arreglo de dependencias. El `setWelcomeExiting(true)` disparaba el efecto de nuevo antes de que el `setTimeout` corriera, y la función de limpieza de esa segunda ejecución (`clearTimeout`) cancelaba el temporizador de la primera — el estado nunca avanzaba, mismo síntoma (blanco permanente), causa distinta.

**Fix definitivo (dos partes):**
1. El `useEffect` que dispara la transición depende **solo** de la variable que de verdad debe iniciarla (`started`), nunca de las variables de estado que el propio efecto actualiza — evita el ciclo de auto-cancelación.
2. La transición en sí se resolvió con **CSS puro** (`@keyframes` + `animation-fill-mode: forwards`, clases de Tailwind con `transition-all`), no con una librería de animación con callbacks — el peor caso posible si algo la interrumpe es que no se vea el efecto, nunca que el contenido quede invisible para siempre, porque el estado final (`opacity: 1`) está declarado en la propia CSS, no depende de que ningún callback de JS se ejecute.

**Regla general para el proyecto, hacia adelante:** cualquier animación que controle la **visibilidad** de contenido (no solo su entrada decorativa) debe preferir CSS declarativo sobre JS imperativo con callbacks — GSAP sigue siendo la herramienta correcta para parallax, scroll-reveals y transiciones puramente decorativas donde un fallo silencioso no rompe la funcionalidad.

### 6.11 Otros ajustes de diseño notables

- **Chevron de `<select>` nativos:** reemplazado por `appearance-none` + ícono `ChevronDown` de lucide posicionado manualmente.
- **Stepper de "Publicar pasaje" clickeable:** tanto el número como el label son clickeables, pero solo hasta el paso máximo ya visitado (`maxStepReached`).
- **Confeti sutil en "¡Pago liberado!":** animación ligera con GSAP sobre divs absolutos dentro del modal de éxito.
- **`FlightCard` — header simplificado:** se quitó el nombre de la aerolínea y el número de vuelo del encabezado de la card, dejando solo el logo, para que el badge de asiento y el corazón de guardar nunca compitan por espacio.
- **Campos con estado "warning" (`Field` en `PublishFormFields.tsx`):** el botón "Continuar" del Paso 1 de Publicar **nunca se deshabilita** — en vez de bloquear, al intentar avanzar sin completar todo, los campos faltantes se marcan con un ring amarillo (`--color-warning-token`) aplicado directamente sobre el `input`/`select` interno (no sobre todo el wrapper del campo, para no estirarse también sobre texto de ayuda u otros elementos que compartan el mismo `Field`).

## 7. Módulos funcionales — estado real

| Módulo | Descripción | Estado |
|---|---|---|
| **Autenticación real vía modal** | Login/signup en un modal (`AuthModal`) que se abre sobre la página actual, sin navegar ni recargar — ver sección 8 | **Implementado** |
| **Registro simplificado (3 campos)** | Nombre completo (un solo input, se parte en nombres/apellido al guardar), correo, contraseña + Google — ver sección 8.2 | **Implementado** |
| **Agente conversacional (lucIA)** | Modo alternativo de búsqueda en `/explore`, sobre webhook real de n8n — ver sección 5 | **Implementado** |
| Búsqueda manual → presets de rango | Presets (`semana`, `quince`, `mes`, `fecha`) + filtrado en vivo + selector de tipo de vuelo integrado a la barra (ya no chips en fila aparte) | **Implementado** |
| Reglas de vigencia (`active`/`last_call`/`expired`) | Ver sección 9.1 | **Implementado** |
| Flujo de pago retenido en garantía (escrow) | Máquina de estados real, persistida en Postgres | **Implementado** |
| **Backend real de vuelos y transacciones** | Tablas `flights` y `transactions` en Postgres con RLS | **Implementado** |
| Publicar pasaje | Formulario de 3 pasos (Vuelo, Precio, Listo); **Paso 1 accesible sin sesión, login recién al pasar a Precio** — ver sección 9 | **Implementado** |
| **Borrador local + recuperación** | El Paso 1 se guarda en `localStorage` antes de pedir login por primera vez; al volver a "Vender vuelos" se ofrece recuperarlo o empezar de nuevo — ver sección 9.2 | **Implementado** |
| **Sugerencia de precio con datos reales** | Promedio de `resale_price` de otras publicaciones activas en la misma ruta/aerolínea, con fallback y mensajes honestos — ver sección 9.4 | **Implementado** |
| **CSAT del precio sugerido** | 👍/👎 en la pantalla de confirmación, persistido en tabla `feature_feedback` | **Implementado** |
| **Revisión manual de publicaciones antes de salir al marketplace** | Estado `pendiente_revision` → panel admin aprueba/rechaza | **Implementado** |
| **Panel de administración** (`/admin/revisiones`) | Cola de publicaciones + cola de cargos de aerolínea pendientes, gateado por `profiles.is_admin` | **Implementado** |
| Editar publicación existente | Reutiliza los mismos campos que publicar | **Implementado** |
| Tope de precio de reventa | Estrictamente menor al original, no menor al 10% | **Implementado** |
| Cálculo de cargo de aerolínea — estimado + confirmado | Modelo híbrido completo (ver sección 9.6) | **Implementado** |
| **Verificación real del cargo de aerolínea confirmado** | Vendedor sube evidencia real a Storage, admin acepta/rechaza, con notificación | **Implementado** |
| Datos del comprador para el endoso (formulario estructurado) | Visible solo al vendedor de esa transacción; **nunca autocompletado desde la cuenta logueada** (ver 8.2) | **Implementado** |
| **Chat interno real por transacción** | Persistido en `chat_messages`, adjuntos reales, suscripción realtime | **Implementado** |
| Máquina de estados de transacción | `pago_retenido` → `vendedor_inicia` → `confirmado` → `liberado` | **Implementado** |
| **Gate de confirmación del comprador antes de liberar el pago** | El vendedor no puede liberar el pago hasta que el comprador marque "Todo OK" | **Implementado** |
| **Reembolso manual ante rechazo de la aerolínea** | Estado `reembolsado`, marcado manualmente | **Implementado** |
| Autocompletar con IA al publicar | Simulación de subir voucher → loading (~1.8s) → autocompleta datos (no email/teléfono); **ya no requiere sesión activa** (ver 9.3) | **Simulación visual** |
| **Notificaciones en tiempo real** | Tabla `notifications` + triggers + suscripción realtime + campanita | **Implementado** |
| **Alertas de ruta reales** | Tabla `route_alerts`; creables desde el formulario manual **o desde el chat con lucIA** | **Implementado** |
| **Viajes guardados reales** | Tabla `saved_flights`; corazón en card y detalle; **pide login vía modal en el lugar** si no hay sesión (ver 8.3) | **Implementado** |
| Header / navegación | Nav: Inicio/Explorar vuelos/Vender vuelos/Cómo funciona; logo Buelazo; botón "Ingresar" abre el modal | **Implementado** |
| Perfil (`/profile`) | Segmented control (Mis datos/Preferencias/Guardados) | **Implementado** |
| **Métodos de pago/cobro guardados reales** | Tabla `payment_methods` | **Implementado** |
| Modal de método de pago | Simulación visual del cargo — la retención en Postgres sí es real | **Simulación visual** |
| Vista "Publicados" del vendedor | Chips `En proceso` / `Finalizados` / `Publicados` / `Retirados` / `Rechazados` | **Implementado** |
| Retirar publicación | Solo para ofertas sin comprador; `status = cancelled` | **Implementado** |
| **Editar y volver a publicar una publicación rechazada** | Límite duro de 2 rechazos | **Implementado** |
| "Reportar problema" / disputas | Pausa el escrow, notifica a la contraparte | **Implementado** |
| Home — secciones nuevas | "lucIA" (demo pasivo, ver 5.5), CTA "Ver cómo funciona" bajo "Así funciona" | **Implementado** |

## 8. El modal de login/signup

### 8.1 Por qué modal, no páginas separadas

Antes, "Ingresar" navegaba a `/login`, y cualquier acción que requería sesión (comprar, guardar, publicar) redirigía ahí y de vuelta con un `window.location.href` — perdiendo scroll y contexto de lo que se estaba haciendo. Ahora:

- `AuthModalProvider` (`src/lib/auth-modal-context.tsx`), montado en `__root.tsx`, expone `openAuthModal(mode?, context?)` / `closeAuthModal()` — llamable desde cualquier punto de la app.
- `AuthForm` (`src/components/site/auth/AuthForm.tsx`) contiene la lógica real (Supabase Auth + Google OAuth), compartida entre el modal y la ruta directa `/login` (mantenida para links compartidos/SEO).
- **Sin recarga de página tras loguearse con email/contraseña:** se quitó el `window.location.href` que existía antes — `AuthProvider` ya escucha `onAuthStateChange` de forma reactiva, así que un `useEffect` en `AuthForm` (que detecta `user` pasando de nulo a existir) simplemente llama a `onAuthenticated?.()`, que el modal usa para cerrarse y la página `/login` para navegar. Esto es lo que permite que el modal nunca pierda el scroll/contexto de la página sobre la que se abrió.
- **Google es la única excepción real:** al ser un redirect externo (`signInWithOAuth`), siempre vuelve a `window.location.origin` (home) — decisión explícita de simplicidad, aceptando que no "recuerda" la página exacta en ese caso puntual.
- **Copy contextual opcional:** `openAuthModal(mode, { title, text })` reemplaza el título/subtítulo genérico de `AuthForm` (nunca agrega una caja/banner aparte encima del formulario — se probó y se descartó por verse mal) — se mantiene igual sin importar si el usuario alterna entre login y signup dentro del modal.
- **`useRequireAuth()`** (usado por `/dashboard`, `/profile`, `/admin/revisiones`, `/edit-flight/$id` — **no por `/publish`**, ver sección 9) ahora abre el modal en el lugar en vez de `navigate({ to: "/login" })`. Si el usuario cierra el modal sin loguearse, la página muestra `AuthRequiredPlaceholder` (candado + botón "Iniciar sesión" + "Volver al inicio") en vez de quedar en blanco.

### 8.2 Registro simplificado — 3 campos, y la regla de nunca mezclar cuenta con pasajero

El signup pasó de 6 campos (Nombres, Apellido paterno, Apellido materno, Teléfono, Correo, Contraseña) a 3: **Nombre completo**, **Correo**, **Contraseña** (+ Google). Al guardar, el nombre completo se parte en la primera palabra (`first_name`) y el resto (`last_name`) para no perder el dato en el trigger que llena `profiles`.

**Regla crítica, sin excepciones:** ningún dato de "Datos del pasajero" (nombres, apellidos, teléfono, documento) en el flujo de Publicar se autocompleta jamás desde el perfil de la cuenta logueada — el vendedor no siempre es el pasajero (puede estar publicando el boleto de un tercero). La única fuente válida es la extracción simulada del comprobante (ver 9.3); si esa extracción no trae un dato, el campo queda vacío para llenado manual. Se verificó explícitamente que `publish.tsx` no lee `profile` en ningún punto.

### 8.3 Puntos de disparo del modal

| Acción | Antes | Ahora |
|---|---|---|
| Botón "Ingresar" del header (desktop y mobile) | `<Link to="/login">` | `openAuthModal("login")` |
| Rutas protegidas (`useRequireAuth`) | `navigate({ to: "/login" })` | `openAuthModal("login")` en el lugar |
| "Comprar" en `flight.$id.tsx` sin sesión | `localStorage` + `navigate({ to: "/login" })`, retomaba con `window.location.href` al volver | `openAuthModal("login")` + un `ref` en memoria que retoma la compra automáticamente cuando `user` pasa a existir — ya no hace falta `localStorage` ni recarga |
| Corazón de "Guardar" sin sesión (`saved-context.tsx`) | Igual patrón de `localStorage` + navegación | Mismo patrón que "Comprar": `openAuthModal("login")` + reintento en memoria vía `useEffect` |
| "Continuar" del Paso 1 de Publicar sin sesión | No existía el control (se podía publicar sin sesión hasta el final) | `openAuthModal("login", { title, text })` con copy contextual — ver sección 9 |

Las constantes `PENDING_PURCHASE_KEY`/`PENDING_SAVE_KEY` (localStorage) quedaron retiradas — ya nada las escribe, todos los flujos de "retomar tras loguearse" ahora viven en memoria (`useEffect` reactivo a `user`), porque el modal ya no requiere abandonar la página.

## 9. Publicar pasaje — login diferido, borrador y precio sugerido

### 9.1 El Paso 1 ya no requiere sesión

`publish.tsx` **dejó de usar `useRequireAuth()`** (que bloqueaba toda la página desde el primer render) — el Paso 1 (comprobante, datos del vuelo, datos del pasajero) se puede llenar completo sin sesión. El login/registro recién se pide al hacer clic en "Continuar" para pasar al Paso 2 (Precio), con este copy contextual en el modal:

> "¡Ya tenemos los datos de tu vuelo! Inicia sesión o crea tu cuenta para continuar con el precio y publicar tu pasaje. No perderás nada de lo que ya llenaste."

Al loguearse/registrarse con éxito, un `useEffect` que escucha `user` avanza solo al Paso 2, sin que el usuario tenga que volver a tocar "Continuar".

**Si la sesión se pierde estando ya en Paso 2**, un efecto detecta `!user && step > 0` y regresa al Paso 1 (los datos no se pierden, siguen en `data`) — evita dejar al usuario interactuando con un paso que de todas formas `handlePublicar()` bloquearía sin explicación clara. **Excepción explícita:** si la sesión se pierde estando en el **Paso 3** ("Enviado a revisión", ya publicado con éxito), en vez de volver al Paso 1 con los mismos datos ya publicados (que invitaría a reenviarlos por error), se redirige a home.

### 9.2 Borrador local y recuperación

Antes de abrir el modal de login por primera vez desde el Paso 1, el estado completo del formulario se guarda en `localStorage` (`src/lib/publish-draft.ts`: `savePublishDraft`/`loadPublishDraft`/`clearPublishDraft`). Al entrar a "Vender vuelos" (con o sin sesión), si existe un borrador guardado, se muestra un modal de decisión — **distinto y con copy distinto** al modal de login, porque resuelve un momento diferente (continuidad inmediata vs. una decisión explícita al volver):

> "🛫 ¡Vemos que tienes un borrador guardado! ¿Quieres recuperar los datos que habías ingresado o empezar de nuevo?"

No es descartable por fuera/Escape (`PublishDraftRecoveryModal`, `[&>button]:hidden` + `onPointerDownOutside`/`onEscapeKeyDown` bloqueados) — es una decisión explícita, no un aviso pasivo. El borrador se elimina recién cuando `createFlight()` tiene éxito (Paso 3).

Cerrar el modal de login *sin* loguearse (Situación A del prompt original) no requiere ningún manejo especial — el estado del formulario (`data`) y el estado del modal siempre fueron independientes, así que el Paso 1 simplemente sigue ahí, editable.

### 9.3 Subida del comprobante sin sesión

`handleVoucherUpload` separa dos cosas que antes eran una sola: la **extracción simulada** (llenar aerolínea, vuelo, fechas, datos del pasajero) ya no depende de `user` — corre igual con o sin sesión. La **subida real a Supabase Storage** sí necesita un usuario real; si no hay sesión al momento de subir el archivo, se guarda en memoria (`voucherFileRef`) y se sube recién en `handlePublicar()`, donde la sesión ya está garantizada por el gate del Paso 1→2. La señal de "¿ya se subió un comprobante?" para la validación del paso y la UI del dropzone es `data.voucherName` (no `data.voucherUrl`, que puede seguir siendo `null` mientras no hay sesión).

### 9.4 Sugerencia de precio con datos reales

`getSimilarActiveResalePrices(originCode, destinationCode, airline?)` en `flights.ts` consulta `resale_price` de otras publicaciones **activas** en la misma ruta (tabla `flights`, pública) — deliberadamente **no** usa la tabla `transactions` (el precio real de venta), porque su RLS solo permite ver transacciones en las que el usuario participó como comprador o vendedor; usar eso requeriría una función nueva en Supabase que agregue el promedio sin exponer filas individuales, evaluado y descartado por ahora a favor de este enfoque sin cambios de esquema.

Lógica de `suggested` en `publish.tsx`:
1. Si hay publicaciones comparables **y** su promedio cae dentro del rango válido para el precio original **de este vendedor** (`precioMinimo`–`precioMaximo`) → se usa ese promedio.
2. Si no hay publicaciones comparables, **o** el promedio existe pero no es válido para este vendedor (otro vendedor puede tener un original distinto, y su promedio de reventa puede terminar siendo igual o mayor al original de este vendedor) → fallback al 48% del precio original — **nunca se fuerza el promedio al límite más cercano** (eso daba sugerencias absurdas, ej. un "descuento" de S/1).
3. El copy siempre distingue los tres casos (promedio real de N publicaciones / no hay suficientes comparables / nunca afirma una fuente de datos que no existe).

**Nota histórica:** el 48% de fallback y el copy original ("basado en vuelos vendidos en las últimas 72h") eran deuda técnica del prototipo original — nadie los revisó al migrar a datos reales, y el copy afirmaba una fuente de datos que nunca existió. Se corrigió el copy para que sea honesto sobre lo que realmente se está calculando.

### 9.5 CSAT del precio sugerido

En la pantalla "Enviado a revisión" (Paso 3), justo después de publicar — no en un banner posterior, para capturar la respuesta con la experiencia fresca — se pregunta "¿Te sirvió el precio que sugirió lucIA?" con 👍/👎 (`submitFeatureFeedback` en `src/lib/services/feedback.ts`, tabla `feature_feedback: id, user_id, feature, score, context, created_at`, con `context` guardando el precio sugerido y si el vendedor terminó usándolo). Tabla genérica a propósito (`feature` como columna libre) para reusarla con otras funcionalidades sin crear una tabla nueva por cada una.

### 9.6 Cargo de aerolínea por endoso (modelo híbrido, Ley N° 32325) — sin cambios en esta etapa

- **Estimado** (`airline_fee_estimate` en `flights`): privado, opcional, ingresado por el vendedor al publicar, sin evidencia requerida. El comprador nunca lo ve.
- **Confirmado** (`confirmed_airline_fee` en `transactions`): solo existe post-compra, requiere evidencia real, pasa por `cargo_verification_status`.
- **Umbral de revisión manual** (`REVISION_MANUAL_UMBRAL = 0.5`): cargo confirmado que supere el 50% del precio de venta nunca se acepta automáticamente.
- **Neto nunca negativo:**
  ```
  comision_efectiva = min(comision_normal, max(0, precio_venta - cargo_aerolinea_confirmado))
  neto_final = max(0, precio_venta - cargo_aerolinea_confirmado - comision_efectiva)
  ```
- **El comprador nunca ve el monto del cargo de aerolínea**, en ningún momento del flujo — ni en el marketplace manual, ni en el chat de lucIA.

## 10. Reglas de negocio críticas (resto del producto, sin cambios en esta etapa)

### 10.1 Estados de un vuelo (`FlightStatus`)
Enum real en Postgres: `active`, `last_call`, `expired` (calculado, no persistido), `sold`, `cancelled`, `pendiente_revision`, `rechazado`.

### 10.2 Ida y vuelta (`tipoBoleto`, `tramoAVender`)
Boleto `solo_ida` o `ida_y_vuelta`. Si es ida y vuelta, el vendedor decide `tramoAVender: "ida" | "regreso" | "ambos"`.

### 10.3 Asiento por tramo
`asientoIda`/`asientoRegreso` independientes. Solo la categoría "ventana" con asiento **seleccionado** obtiene el badge "Ventana confirmada".

### 10.4 Tope de precio de reventa
Estrictamente menor al precio original, no menor al 10% del original.

### 10.5 Chat interno y datos de endoso
Chat real (`chat_messages`, RLS restringido a comprador/vendedor de esa transacción), nunca WhatsApp. Soporta adjuntos reales.

### 10.6 Estado de la transacción y el gate de confirmación del comprador
`pago_retenido` → `vendedor_inicia` → `confirmado` → `liberado` (más `disputa`/`reembolsado`). El vendedor no puede liberar el pago hasta que el comprador confirme (`buyer_confirmed_ok`).

### 10.7 Disputas y reembolso manual
Categorías predefinidas por rol, pausa el escrow. Reembolso es un cambio de estado manual, no hay pasarela real de reembolso.

### 10.8 Revisión manual de publicaciones nuevas
`pendiente_revision` → admin aprueba (`active`) o rechaza (`rechazado`, con motivo + detalle, límite duro de 2 rechazos).

### 10.9 Timeline "Protección Escrow" en el detalle del vuelo
Muestra el estado real solo a comprador/vendedor de la transacción; a terceros, un badge que distingue por qué no está disponible (`sold` vs. `cancelled`/`rechazado`).

### 10.10 Honestidad del precio mostrado al comprador
El precio "hero" es siempre `totalAPagar(flight) = resalePrice + comisionPlataforma(resalePrice)` — nunca el precio base solo. Aplica igual en el marketplace manual y en las cards mostradas por lucIA.

### 10.11 Validación de longitud de documento de identidad
Botón deshabilitado hasta que el número tenga exactamente la longitud esperada según tipo de documento.

### 10.12 Publicaciones activas del vendedor y retiro
`flight.seller.id === user.id`. Retirar solo si no tiene comprador (`status = cancelled`).

### 10.13 Un vendedor no puede comprar su propia oferta — gate de UI, no de base de datos
Pendiente confirmar si existe el `CHECK` de Postgres recomendado (`buyer_id <> seller_id`).

## 11. Limitaciones conocidas del prototipo (no resueltas a propósito)

- **Sin pasarela de pago real.**
- **Autocompletar con IA es simulado** (tanto al publicar como, ahora, la extracción que se muestra en el dropzone del comprobante) — no hay modelo de visión real todavía.
- **DeepSeek como modelo del agente conversacional**, elegido explícitamente por el fundador sobre alternativas — no soporta el mecanismo de function-calling/structured-output nativo de n8n (confirmado en desarrollo); se resolvió con un patrón de prompt + parser en vez de la función nativa.
- **Revisión de publicaciones y de cargos de aerolínea es 100% manual.**
- **Sin panel de soporte con mediación real de disputas.**
- **Equipaje no es 100% por tramo.**
- **Sin verificación de identidad real.**
- **El modelo de comisión de la plataforma no varía aún según urgencia** — porcentajes por definir.

## 12. Roadmap sugerido

1. **Pasarela de pago real.**
2. **Integración real de autocompletado por IA** (modelo de visión).
3. **Automatizar (parcial o totalmente) la verificación de publicaciones y cargos de aerolínea.**
4. **Panel de soporte con más opciones de resolución de disputas.**
5. **Verificación de identidad real.**
6. **Equipaje por tramo.**
7. **Definición del modelo de comisión con cifras reales.**
8. **Función/vista en Supabase para sugerir precio con datos reales de `transactions`** (ventas reales, no solo publicaciones activas), sin exponer filas individuales — para reemplazar el fallback del 48% con algo mejor fundamentado.
9. **Extender el agente conversacional** a otros flujos (ej. seguimiento de una compra en curso vía chat).
10. **Piloto acotado** antes de un lanzamiento amplio.

## 13. Decisiones y validaciones pendientes

- **Modelo de comisión:** rangos exactos por definir según urgencia.
- **Cargo real de aerolíneas en la práctica actual:** verificar directamente con LATAM, Sky y JetSmart.
- **Viabilidad de vender tramos de ida/vuelta por separado a compradores distintos.**
- **Automatización de la verificación** (publicaciones y cargos de aerolínea): evaluada y descartada por ahora.
- **Alcance de la resolución de disputas.**
- **Homologar el color de foco de inputs en todo el sitio** (ver 6.8) — hoy solo se corrigió en los campos de precio.

## 14. Contexto para un agente de IA que retome el proyecto

- Este proyecto usa **React + Vite + TanStack Router + TanStack Query + Tailwind CSS v4**, con **backend real en Supabase** y un **agente conversacional real sobre n8n**. No asumas que algo "vive solo en memoria" sin comprobarlo primero contra `src/lib/services/*.ts`.
- **No tienes acceso directo a la base de datos de Supabase ni al workflow de n8n.** Cambios de esquema/RLS van como SQL para el SQL Editor; cambios al workflow de n8n se coordinan vía una sesión de Claude.ai con MCP a n8n que opera el fundador directamente — prepara un prompt de contexto completo si hace falta ese camino.
- **El login/signup es un modal por defecto**, no una navegación a `/login` — cualquier punto nuevo de la app que necesite requerir sesión debe usar `openAuthModal()` (o `useRequireAuth()` si es una página protegida completa), nunca `navigate({ to: "/login" })`.
- **El Paso 1 de Publicar es la única parte del producto pensada para funcionar sin sesión** — no asumas que "publicar" siempre requiere estar logueado desde el inicio; el gate está específicamente en la transición Paso 1 → Paso 2.
- **Nunca autocompletar "Datos del pasajero" desde la cuenta logueada** (nombre, apellidos, teléfono, documento) — el vendedor no siempre es el pasajero. La única fuente válida es la extracción (simulada) del comprobante.
- **El comprador nunca ve el cargo de aerolínea**, ni en el marketplace manual ni en el chat de lucIA — verificar esto en cualquier cambio al adaptador de datos del webhook (`webhook-client.ts`).
- **Cualquier animación que controle visibilidad de contenido debe ser CSS declarativo** (`@keyframes` + `forwards`), no una librería con callbacks — ver el bug catalogado en 6.10 antes de "resolver" una transición con GSAP y un `onComplete`.
- Todas las reglas de negocio de la sección 10 son restricciones de diseño ya decididas, no sugerencias.
- Las decisiones pendientes (sección 13) no deben resolverse arbitrariamente por un agente de código — le corresponden al fundador (Gianca).
- Las limitaciones conocidas (sección 11) son intencionales para esta etapa del prototipo — no "arreglarlas" sin que el fundador lo pida explícitamente.
