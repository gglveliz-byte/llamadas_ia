# QA & Bug Tracking (VozIA)

Este archivo es el registro oficial de errores, problemas y bugs encontrados durante la fase de pruebas manuales y QA en producción (Render/Telnyx). 
A medida que reportes errores, iré actualizando este documento y marcándolos cuando estén resueltos.

## 🐛 Errores Reportados

1. **[Frontend] Error 401 en `/api/session` y `/api/whop/checkout`**
   - *Síntoma*: Consola muestra "401 Unauthorized" al cargar el panel o modal de recargas.
   - *Causa*: La cookie de sesión (JWT) es inválida o expiró, probablemente porque la variable `JWT_SECRET` en el entorno de Render de `vozia-frontend` no coincide con la original, o simplemente requiere volver a iniciar sesión.
2. **[Frontend] Error 500 en `/api/phone-numbers`**
   - *Síntoma*: POST a `/api/phone-numbers` crashea con error 500.
   - *Causa*: Falta correr migraciones en la base de datos (`db:push`) o falta la variable `TELNYX_API_KEY` en el frontend para poder listar/comprar números.
3. **[Frontend] WebSocket Simulator Error**
   - *Síntoma*: Conexión a `wss://vozia-backend-eezl.onrender.com/stream/sim` falla.
   - *Causa*: Por investigar (revisar configuración de proxy o logs del backend).

---

## ✅ Errores Resueltos

1. **[Backend] Error 502 en `/api/express/metrics` y `/sse/events`**
   - *Síntoma*: Panel dice "Backend Express no disponible". Consola da 502 Bad Gateway.
   - *Causa*: Render "Port scan timeout". El puerto 3001 estaba hardcodeado, ignorando la variable de entorno `PORT` proporcionada por Render.
   - *Solución*: Se cambió a `parseInt(process.env.PORT || "3001", 10)` en `index.ts`.

2. **[Backend] Webhooks de Telnyx (Voz) retornan 401 Unauthorized**
   - *Síntoma*: En el dashboard de Telnyx, todos los webhooks `call.initiated`, `call.answered`, etc. fallan con `{"error":"Formato de firma inválido"}` o `"Firma inválida"`.
   - *Causa*: La clave `TELNYX_PUBLIC_KEY` configurada en Render estaba en formato base64 crudo en lugar del formato PEM esperado por `crypto.createPublicKey()`.
   - *Solución*: Se implementó conversión automática de base64 crudo a PEM con prefijo DER en `telnyxSignature.ts`.
