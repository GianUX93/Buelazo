# Buelazo — Documento Maestro

**Estado:** Prototipo funcional con **backend real** (Supabase: base de datos, autenticación, almacenamiento de archivos, tiempo real) + **agente conversacional real** (n8n + IA) · **Propósito:** negocio real + pieza de portafolio
**Última actualización:** septiembre 2026
**Nota de marca:** el producto se llamó "Traspaso" durante buena parte del desarrollo; el nombre comercial es ahora **Buelazo**. La palabra minúscula "traspaso" se sigue usando en el copy como el sustantivo genérico de la acción de transferir un pasaje (ej. "Traspaso confirmado") — no es un residuo de marca, es intencional.

---

## 1. El problema

En Perú, cuando alguien compra un pasaje aéreo nacional y luego no puede viajar, en la práctica pierde ese dinero. Aunque existe un derecho legal a transferir (endosar) el pasaje a otra persona, el proceso es poco conocido, está disperso entre las políticas de cada aerolínea, y no hay ningún canal simple donde ese pasajero pueda encontrar a alguien interesado en comprarlo.

Del otro lado, hay viajeros con planes flexibles que estarían dispuestos a pagar mucho menos que la tarifa oficial por un vuelo de último minuto — pero hoy no tienen dónde buscar ese tipo de oferta de forma confiable, y las herramientas de búsqueda existentes (formularios de filtros rígidos) no calzan bien con un inventario finito y cambiante de terceros.

**El resultado:** dinero perdido de un lado, oportunidades de ahorro invisibles del otro, y ninguna plataforma peruana que resuelva esto bien del todo (existe competencia directa, Rename Travel, con vacíos claros de transparencia — ver sección 4).

## 2. La solución

**Buelazo** es un marketplace P2P donde:
- Un **vendedor** publica el pasaje nacional que no va a usar, y recupera parte de su dinero.
- Un **comprador** encuentra ese vuelo con un descuento agresivo frente a la tarifa oficial — buscando con filtros tradicionales, o **conversando en lenguaje natural con lucIA**, el agente conversacional del producto.
- La plataforma **retiene el pago en garantía (escrow)** hasta confirmar que el endoso se completó con éxito, y gestiona todo el proceso de forma transparente y segura para ambas partes.

El producto ya cubre el recorrido completo con cuentas reales: registro y login (como modal, sin salir de la página en la que se estaba), explorar y filtrar vuelos (con un modo de búsqueda asistida por IA como alternativa a los filtros manuales), publicar un pasaje (con autocompletado simulado por IA a partir de un voucher, una sugerencia de precio basada en datos reales de otras publicaciones, y una **revisión manual** antes de salir al público), pagar y retener el dinero, gestionar el trámite de endoso con datos estructurados y **chat interno real**, y liberar el pago — solo después de que **el propio comprador confirme** que todo salió bien. Si la aerolínea rechaza el cambio de nombre a mitad de trámite, el dinero queda protegido y se puede reembolsar. Ambas partes reciben **notificaciones reales e instantáneas** de cada avance, y el vendedor ve el desempeño real de sus publicaciones activas (vistas, interesados, guardados) y puede retirarlas si cambia de planes.

## 3. Propuesta de valor

| Para el vendedor | Para el comprador |
|---|---|
| Recupera dinero que hoy pierde por completo | Vuelos nacionales con descuento agresivo de último minuto |
| Ve un desglose real de cuánto va a recibir, no una cifra opaca | Precio fijo garantizado, mostrado siempre como el total final a pagar — nunca cambia después de pagar |
| Publica en minutos con autocompletado simulado por IA desde su voucher, y una sugerencia de precio basada en publicaciones reales de la misma ruta | Puede buscar hablando en lenguaje natural con lucIA en vez de llenar un formulario de filtros, incluyendo pedir alertas de ruta solo con pedirlo por chat |
| Puede empezar a llenar su publicación sin tener cuenta todavía — el login solo se pide justo antes de fijar el precio, sin perder nada de lo ya avanzado | Reembolso protegido si la aerolínea rechaza el cambio de nombre a mitad de trámite |
| Cada publicación pasa por una revisión antes de salir al público, lo que da más confianza al comprador | Puede guardar vuelos y crear alertas para rutas que aún no tienen oferta, y recibe una notificación real en cuanto aparece una |
| Guía clara paso a paso del trámite de endoso, sin exponer sus datos personales por WhatsApp, con chat interno real y notificaciones al instante | El pago solo se libera al vendedor después de que el propio comprador confirma que el traspaso se completó correctamente |
| Ve vistas, interesados y guardados reales de cada publicación activa, y puede retirarla si cambia de planes | Si algo sale mal, puede reportarlo y el pago retenido queda protegido en pausa mientras se revisa |

## 4. Diferenciadores frente a la competencia (Rename Travel)

- **Agente conversacional real, no un formulario de filtros**: el comprador puede pedirle a lucIA "vuelos a Cusco este fin de semana, lo más barato" y recibir cards reales de inventario, en vez de llenar selectores uno por uno — algo que Rename Travel (ni ningún competidor identificado) ofrece hoy.
- **Desglose real vs. advertencia genérica**: Rename Travel advierte con un texto que "las aerolíneas cobran una tarifa", pero su cálculo de "monto neto a recibir" no la descuenta. Buelazo sí construye ese cálculo, con un estimado que el propio vendedor puede ingresar antes de publicar, y un monto **verificado con evidencia real** (revisado por el equipo) una vez que el trámite es real.
- **Sugerencia de precio con datos reales del propio marketplace**: al publicar, se sugiere un precio basado en el promedio de otras publicaciones activas en la misma ruta — nunca un número inventado, y con un mensaje honesto cuando todavía no hay suficientes datos para comparar.
- **Confianza reforzada por revisión humana**: cada publicación nueva y cada cargo de aerolínea reportado pasa por una revisión antes de afectar al comprador o al pago final — no es solo un formulario que se acepta sin más.
- **El comprador tiene la última palabra antes de liberar el pago**: el vendedor no puede cobrar hasta que el comprador confirme que recibió el traspaso correctamente.
- **Protección de precio para ambos lados**: tope de precio de reventa (nunca igual o mayor al original, nunca por debajo del 10%) evita publicaciones abusivas o irrisorias.
- **Fechas y vigencia**: nunca se muestra inventario vencido ni ofertas sin margen de tiempo real para completar el trámite.
- **Búsqueda flexible**: presets de rango de fechas (semana, quince días, mes, fecha exacta) en vez de un buscador rígido tipo motor de vuelos, con filtrado en vivo sin fricción de "buscar" y esperar — más el modo conversacional descrito arriba como alternativa completa, no un agregado cosmético.
- **Precio siempre honesto**: el número grande que ve el comprador es siempre el total real que va a pagar (incluyendo la comisión de servicio) — nunca un precio base que "sorprende" con cargos después.
- **Privacidad y confianza**: comunicación entre comprador y vendedor por chat interno real de la plataforma (con notificaciones instantáneas), nunca exponiendo el número de teléfono real ni derivando a WhatsApp; los datos de identidad para el endoso se piden en un formulario estructurado, no por chat. Cuando la aerolínea exige además una foto del documento, el chat interno permite adjuntarla directamente — sin salir de Buelazo ni exponer el dato en un canal externo.

## 5. Usuario objetivo

Público peruano de consumo masivo (sectores B y C), mobile-first, entre 20 y 45 años, cómodo con apps tipo fintech/marketplace (Yape, Mercado Libre, inDrive). Dos perfiles dentro de la misma base de usuarios:

- **Vendedor**: tiene un pasaje que no puede usar, quiere recuperar dinero rápido y sin fricción.
- **Comprador**: viajero con planes flexibles, prioriza precio sobre fecha exacta, busca vuelos nacionales de último minuto — con o sin experiencia usando buscadores tradicionales, ya que puede simplemente conversar con lucIA.

## 6. Alcance

Solo vuelos **nacionales** dentro de Perú, en las tres aerolíneas que operan rutas domésticas: LATAM, Sky Airline y JetSmart.

## 7. Modelo de negocio

Comisión por servicio cobrada al vendedor en cada transacción completada, con un modelo pensado para variar **según la urgencia del vuelo**. Los porcentajes exactos todavía están **por definir**.

El cargo que eventualmente cobre la aerolínea por el trámite de endoso lo asume el vendedor (se descuenta de su monto neto, con un piso de S/0 — nunca queda debiendo dinero) — el precio que paga el comprador es siempre fijo y no se ve afectado por este cargo, y se le muestra siempre como el total final, sin desglosar la comisión por separado como si fuera un cargo aparte.

## 8. Base legal

El derecho a transferir un pasaje nacional está respaldado por el Código de Protección y Defensa del Consumidor (Ley 29571) y, desde mayo de 2025, por la Ley N° 32325, que refuerza el carácter gratuito del endoso doméstico solicitado con 24 horas de anticipación. Existe cierta ambigüedad legal sobre si esa gratuidad cubre también los "gastos administrativos" del trámite — un punto que Buelazo maneja con transparencia en vez de asumir una respuesta única (ver PRD para el detalle).

## 9. Confianza y verificación — cómo se protege a ambas partes

Este es uno de los pilares que más distingue a Buelazo de la competencia:

- **Publicaciones revisadas antes de salir al público**: ningún pasaje aparece en el marketplace apenas se publica — primero pasa por una revisión (hoy manual) que valida el comprobante subido por el vendedor. Si se rechaza, el vendedor recibe el motivo y puede corregir y reenviar — hasta dos veces; al tercer rechazo, esa publicación queda cerrada y tendría que crear una nueva, para no dejar una publicación problemática dando vueltas indefinidamente en la cola de revisión.
- **Cargo de aerolínea verificado, no solo declarado**: cuando el vendedor reporta cuánto le cobró realmente la aerolínea por el endoso, debe subir evidencia, y esa evidencia se revisa antes de descontarse del monto que recibe. Si el cargo reportado es inusualmente alto (más de la mitad del precio de venta), siempre pasa por revisión manual, sin excepción.
- **El comprador confirma antes de que se libere el dinero**: el pago retenido no se libera al vendedor automáticamente al completar el trámite — el propio comprador tiene que confirmar que todo salió bien.
- **Reportar un problema pausa el dinero, no lo pierde**: si algo sale mal en cualquier punto del trámite (por ejemplo, la aerolínea rechaza el cambio de nombre), cualquiera de las dos partes puede reportarlo. El pago queda protegido y en pausa, y si se confirma que el traspaso no se pudo completar, se reembolsa.
- **Notificaciones instantáneas de cada paso**: ninguna de las dos partes tiene que estar revisando la plataforma constantemente para enterarse de un avance — las notificaciones llegan en tiempo real.
- **lucIA nunca expone datos internos ni de otros vendedores**: el agente conversacional nunca muestra el cargo de aerolínea, ni la publicación propia del comprador que está chateando, ni ningún campo interno de la base de datos — solo lo mismo que ya es público en el marketplace.

## 10. Identidad de marca

Dirección visual de consumo masivo, inspirada en la claridad de Airbnb y la cercanía de inDrive — colores vibrantes (coral, teal, morado, amarillo), iconografía amigable, mobile-first. Explícitamente alejada de clichés de "startup de viajes" (sin íconos de avión de stock ni gradientes azul-cielo genéricos). El nombre "lucIA" (el agente conversacional) usa un degradé de marca (coral → morado) cada vez que se menciona sobre fondo claro, como una pequeña firma visual reconocible.

## 11. Estado actual

Prototipo funcional con **backend real sobre Supabase** y **agente conversacional real sobre n8n**: cuentas de usuario reales (registro/login vía modal, sin navegar a otra página), base de datos persistente, archivos e imágenes almacenados de verdad (comprobantes de vuelo, evidencia de cargos de aerolínea, adjuntos de chat), notificaciones/chat en tiempo real, y un chat de búsqueda conversacional que consulta el inventario real de Supabase a través de un workflow de IA en n8n. Todos los flujos principales son navegables de punta a punta con datos reales: explorar (manual o conversacional), publicar (con revisión), comprar, gestionar el trámite completo, liberar el pago con confirmación del comprador, y — si algo sale mal — reportar y reembolsar.

Lo que todavía es una simulación visual, a propósito, en esta etapa: la pasarela de pago (no se procesa dinero real todavía) y el autocompletado de datos por IA al publicar (usa una animación de carga con datos de ejemplo, en vez de un modelo de visión real). El PRD detalla el alcance técnico exacto, todas las reglas de negocio, y lo que falta para llevarlo a producción.
