# VozIA vs Blueprint White-Label — Comparativa y Roadmap

> Fecha: 2026-08-05
> Documento externo comparado: "ARCHITECTURE, FINANCES & SYSTEMS BLUEPRINT: CUSTOMER SERVICE VOICE-AI ENGINE" (plataforma 3 niveles: plataforma → agencias white-label → comercios, con SIP propio).
> Decisión: **no adoptar nada por ahora**. Este documento registra el análisis y el roadmap futuro.

---

## 1. Qué es el blueprint

Una plataforma enterprise de voz IA con:

- **3 niveles de reventa**: plataforma vende a agencias a $0.80/min (wholesale); agencias revenden a comercios a $2–4/min (retail configurable).
- **White-label**: agencias rebrandean el panel (logo, colores, dominio CNAME).
- **Telefonía SIP propia** (Asterisk / FreeSWITCH / LiveKit SIP) para costo de fábrica ~$0.005/min, sin intermediarios.
- **IA de audio nativa** (OpenAI Realtime / similares) evitando STT→LLM→TTS.
- **Billing en vivo**: débito en cascada cada 15 s, kill-switch inmediato si el saldo toca $0 en plena llamada (SIP 402 pre-llamada), tope duro de 10 min anti-fraude.
- **Pagos**: Stripe / Lemon Squeezy + pasarelas locales (Conekta, Openpay, SPEI/ACH).
- **Outbound**: llamadas salientes (reactivación de leads, confirmaciones).
- **Localización dialectal automática** por prefijo E.164 del llamante.
- **Sync de calendarios externos**: Google Calendar, Outlook, CRMs.

---

## 2. Lo que VozIA YA tiene (igual o mejor)

| Blueprint | VozIA hoy |
|---|---|
| IA de audio nativa (OpenAI Realtime) | ✔ Gemini Live (omnimodal, mismo enfoque, sin triple conversión) |
| Barge-in con aborto de TTS | ✔ **Mejor**: Silero VAD (ML) + sensibilidad configurable desde el panel admin (`vad_*`) + guardia anti-eco |
| Multi-tenant con monederos prepagados | ✔ Wallet por cliente con saldo, límite negativo configurable y alertas (50/20/5/0%) |
| Validación pre-llamada (SIP 402) | ✔ Verificación de saldo + rechazo con TeXML `<Say>` |
| Cobro por minuto/segundo | ✔ Configurable (`cobro_por_segundo`), debitado **al finalizar** la llamada |
| — | ✔ Extras que el blueprint no cubre: compra self-service de números con margen, suspensión + liberación anti-pérdida (gracia configurable), citas con recursos universales, RAG pgvector, grabaciones estéreo en R2, SSE en vivo, monitoreo con alertas, simulador/entrevista de contexto, saludo personalizado, idioma por negocio |

## 3. Lo que el blueprint tiene y VozIA NO (brechas)

1. **Protección de caja durante la llamada**: débito fraccionado cada 15–30 s, corte inmediato si el saldo se agota en plena llamada, tope duro de 10 min anti-fraude. *(VozIA debita al final; una llamada muy larga con saldo justo consume margen.)*
2. **Tier de agencias white-label**: rebranding (logo/dominio/colores) y precio minorista configurable por agencia sobre el wholesale.
3. **Outbound**: llamadas salientes (confirmación de citas, reactivación).
4. **Telefonía SIP propia** (Asterisk/FreeSWITCH/LiveKit): margen mayor (~$0.005/min) a cambio de operar infraestructura VoIP. *(VozIA usa Telnyx gestionado: más costo por minuto + renta de números, pero cero operaciones de infraestructura.)*
5. **Dialecto automático por prefijo del llamante**. *(VozIA: idioma configurable por negocio, que cubre el caso práctico.)*
6. **Sync con Google Calendar / Outlook / CRM**. *(VozIA: calendario interno.)*
7. **Pasarelas adicionales**: Stripe / pasarelas locales. *(VozIA: Whop, pagos únicos.)*

## 4. Comparativa financiera

- **Blueprint**: costo de fábrica ~$0.066/min → wholesale $0.80 → retail $2–4. Margen plataforma ~91%.
- **VozIA**: costo real Telnyx+Gemini (~$0.10–0.20/min + renta de números) → venta default $0.50/min (`precio_minuto_default`, por paquete de recarga) + margen de números (`margen_numero_pct`, default 50%). Margen menor por minuto pero **modelo más simple**, sin operar VoIP ni sostener 3 niveles.

Conclusión: el blueprint es la **evolución comercial enterprise** del mismo núcleo que Vozia ya tiene operativo. VozIA va por delante en el pulido del core de voz (VAD configurable, anti-eco, anti-pérdida en números); el blueprint gana en margen potencial y capas de reventa.

## 5. Roadmap priorizado (cuando se decida crecer)

| Prioridad | Pieza | Esfuerzo | Nota |
|---|---|---|---|
| 1 | Protección de llamada: débito cada 15–30 s + kill-switch en llamada + tope 10 min | Bajo-Medio | Sobre `billing.service.ts` + `telnyxStream.handler.ts` (hangupCall ya existe) |
| 2 | Outbound (confirmaciones/reactivación) | Medio | Telnyx Call API ya integrada para compras |
| 3 | Sync Google Calendar | Medio | Valor directo al cliente final |
| 4 | Tier agencias white-label | Alto | Roles + sub-wallets en cascada + rebranding |
| 5 | Telefonía SIP propia | Alto | Solo si el volumen justifica el margen |

---

*Estado: análisis completado 2026-08-05. Se pospone todo; se prioriza pulir el sistema actual.*
