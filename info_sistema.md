PLATAFORMA SAAS DE AGENTE DE VOZ IA

## 1. VISIÓN GENERAL

Construye una plataforma SaaS multiinquilino de agentes de voz con IA. El dueño del SaaS (admin) paga la cuenta maestra de **Telnyx**. Cada cliente registrado obtiene una **cuenta hija (child account)** de Telnyx, compra números telefónicos desde el panel, y al recibir llamadas, la IA (Gemini) contesta, conversa en lenguaje natural, y ejecuta herramientas (agendar citas, consultar disponibilidad, etc.).

**Modelo de negocio**: Recargas de saldo. El sistema debita por minuto (o por segundo, configurable por admin) de procesamiento de llamadas. Pagos procesados por **Whop.com**.

**El Cerebro**: Gemini 3.1 Flash Live (streaming bidireccional de audio + function calling síncrono).

**El Conector**: **Telnyx** con `<Dial><Stream>` (WebSocket bidireccional, Media Streaming API).

**El Frontend**: Next.js 14+ con detección de dispositivo (Desktop/Móvil), estilos inspirados en WhatsApp Web (Light/Dark).

**Idioma de la plataforma**: Español. **Idioma de la IA en llamadas**: Configurable por cada negocio (español, inglés, portugués, francés, etc.).

---

## 2. STACK TECNOLÓGICO OBLIGATORIO

| Capa | Tecnología |
|------|-----------|
| Frontend (Dashboard) | Next.js 14+ (App Router) + React + Tailwind CSS |
| Lenguaje | TypeScript en todo el proyecto |
| Backend ligero (CRUD, auth) | Next.js API Routes |
| Backend tiempo real (voz, SSE) | Express.js dedicado |
| Base de datos | PostgreSQL + extensión `pgvector` |
| Cache | Redis (`ioredis`) |
| Almacenamiento audio | Cloudflare R2 (S3 compatible) |
| LLM / Voz | Google Gemini 3.1 Flash Live (`@google/genai`) |
| Embeddings (RAG) | `gemini-embedding-001` (768 dimensiones) |
| Telefonía | **Telnyx** (Numbers API, Call Control API, Media Streaming, TeXML, Account Hierarchy) |
| Pagos | Whop.com (`@whop/sdk`) |
| Logging | Pino (JSON, no-bloqueante) |
| Transcodificación audio | `fluent-ffmpeg` + paquete `g711` |
| Email | Nodemailer (Gmail App Password) |
| Despliegue | Render.com (Web Services) |

---

## 3. ESTRUCTURA DE CARPETAS

```text
/ (Raíz)
├── /backend-express/
│   ├── /src/
│   │   ├── /websockets/
│   │   │   ├── telnyxStream.handler.ts
│   │   │   └── gemini.handler.ts
│   │   ├── /sse/
│   │   │   └── events.emitter.ts
│   │   ├── /services/
│   │   │   ├── audio.service.ts          (Transcodificación, ensamblado, subida R2)
│   │   │   ├── billing.service.ts        (Débito por minuto/segundo, verificación saldo)
│   │   │   ├── calendar.service.ts       (CRUD citas, validación overlap)
│   │   │   ├── rag.service.ts            (Embeddings + búsqueda pgvector)
│   │   │   ├── cache.service.ts          (Redis: contexto negocio, invalidación)
│   │   │   ├── email.service.ts          (Nodemailer: confirmaciones, alertas)
│   │   │   └── monitoring.service.ts     (Métricas CPU/RAM/latencia, alertas)
│   │   ├── /routes/
│   │   │   ├── webhooks.telnyx.ts        (Recepción de llamadas)
│   │   │   ├── webhooks.whop.ts          (Recepción de pagos)
│   │   │   ├── admin.api.ts              (Endpoints del panel admin)
│   │   │   └── internal.api.ts           (Endpoints que Next.js consume)
│   │   ├── /middleware/
│   │   │   ├── auth.middleware.ts        (JWT verification)
│   │   │   ├── telnyxSignature.ts        (Validación Telnyx-Signature-Ed25519)
│   │   │   └── rateLimiter.ts
│   │   ├── /models/
│   │   │   └── database.pool.ts          (pg Pool)
│   │   ├── /utils/
│   │   │   ├── logger.ts                 (Instancia Pino)
│   │   │   ├── audioTranscoder.ts        (μ-law ↔ PCM, resampling)
│   │   │   └── encryption.ts            (AES-256-GCM)
│   │   └── index.ts
│   └── package.json
│
├── /frontend-next/
│   ├── /src/
│   │   ├── /app/
│   │   │   ├── /(desktop)/
│   │   │   │   ├── /dashboard/
│   │   │   │   ├── /configuracion/
│   │   │   │   │   ├── /perfil/
│   │   │   │   │   ├── /contexto/       (Simulador de voz)
│   │   │   │   │   ├── /numeros/
│   │   │   │   │   ├── /horarios/       (Horarios de atención + timezone)
│   │   │   │   │   └── /grabaciones/
│   │   │   │   ├── /citas/
│   │   │   │   ├── /recargas/           (Comprar saldo vía Whop)
│   │   │   │   └── /admin/              (Panel administrativo)
│   │   │   │       ├── /clientes/
│   │   │   │       ├── /tarifas/
│   │   │   │       ├── /metricas/
│   │   │   │       ├── /flujo-caja/
│   │   │   │       └── /configuracion/
│   │   │   ├── /(movil)/
│   │   │   │   ├── /mobile-dashboard/
│   │   │   │   └── /mobile-configuracion/
│   │   │   │       └── /simulador/
│   │   │   ├── /api/
│   │   │   │   ├── /auth/
│   │   │   │   ├── /users/
│   │   │   │   ├── /telnyx-proxy/
│   │   │   │   └── /whop/               (Webhook de Whop)
│   │   │   └── layout.tsx
│   │   ├── /components/
│   │   │   ├── /ui/
│   │   │   ├── /calendar/
│   │   │   ├── /voice/
│   │   │   │   └── MicButton.tsx
│   │   │   ├── /admin/
│   │   │   │   ├── MetricsPanel.tsx
│   │   │   │   ├── CashFlowChart.tsx
│   │   │   │   └── ClientRanking.tsx
│   │   │   └── /billing/
│   │   │       ├── WalletBalance.tsx
│   │   │       └── RechargeModal.tsx
│   │   └── /lib/
│   │       ├── /hooks/
│   │       │   ├── useSSE.ts
│   │       │   └── useWallet.ts
│   │       └── /utils/
│   │           └── validators.ts
│   └── package.json
│
├── /docker-compose.yml  (Postgres + Redis para dev local)
└── /render.yaml         (Config de despliegue en Render)
```

**Regla**: Máximo 600 líneas por archivo. Si excede, crear sub-módulo.

---

## 4. MODELOS DE BASE DE DATOS (PostgreSQL + pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════
-- 1. USUARIOS (Clientes del SaaS)
-- ═══════════════════════════════════════════
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'cliente', -- 'cliente' | 'admin'
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    recovery_token TEXT,
    is_suspended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    -- Perfil del negocio
    business_name VARCHAR(255),
    business_phone VARCHAR(50),
    -- Credenciales Telnyx (encriptadas AES-256-GCM)
    telnyx_child_account_id VARCHAR(100),
    telnyx_api_key_encrypted TEXT
);

-- ═══════════════════════════════════════════
-- 2. CONFIGURACIÓN DEL NEGOCIO
-- ═══════════════════════════════════════════
CREATE TABLE business_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Idioma en que la IA habla con el cliente final
    ai_language VARCHAR(10) DEFAULT 'es', -- 'es','en','pt','fr', etc.
    -- Modo de citas
    booking_mode VARCHAR(10) DEFAULT 'hours', -- 'hours' | 'nights'
    default_duration_minutes INT DEFAULT 30,
    check_in_time TIME DEFAULT '15:00:00',
    check_out_time TIME DEFAULT '11:00:00',
    -- Horarios de atención (JSON por día)
    business_hours JSONB DEFAULT '{
        "lunes": {"abierto": true, "inicio": "09:00", "fin": "18:00"},
        "martes": {"abierto": true, "inicio": "09:00", "fin": "18:00"},
        "miercoles": {"abierto": true, "inicio": "09:00", "fin": "18:00"},
        "jueves": {"abierto": true, "inicio": "09:00", "fin": "18:00"},
        "viernes": {"abierto": true, "inicio": "09:00", "fin": "18:00"},
        "sabado": {"abierto": true, "inicio": "09:00", "fin": "14:00"},
        "domingo": {"abierto": false, "inicio": null, "fin": null}
    }'::jsonb,
    -- Modo 24/7: si true, la IA contesta siempre (fuera de horario informa pero no agenda)
    -- si false, fuera de horario no se contesta
    modo_24_7 BOOLEAN DEFAULT FALSE,
    -- Zona horaria del negocio (IANA)
    timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
    -- Grabación de llamadas
    grabacion_activa BOOLEAN DEFAULT FALSE,
    mensaje_consentimiento TEXT DEFAULT 'Esta llamada puede ser grabada para fines de calidad.',
    consentimiento_activo BOOLEAN DEFAULT FALSE,
    -- Formulario dinámico
    form_fields JSONB DEFAULT '[
        {"key": "nombre", "label": "Nombre completo", "type": "text", "required": true},
        {"key": "telefono", "label": "Teléfono", "type": "tel", "required": false},
        {"key": "email", "label": "Correo electrónico", "type": "email", "required": false},
        {"key": "notas", "label": "Notas adicionales", "type": "textarea", "required": false}
    ]'::jsonb,
    -- Prompt del sistema
    system_prompt_context TEXT DEFAULT 'Eres un asistente amable que agenda citas...',
    -- Recursos del negocio (barbería: sillas, clínica: doctores, hotel: habitaciones)
    recursos JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- 3. WALLET / BILLING (Ledger)
-- ═══════════════════════════════════════════
CREATE TABLE wallet (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    saldo DECIMAL(10,4) DEFAULT 0.0000, -- Saldo actual (puede ser negativo)
    moneda VARCHAR(3) DEFAULT 'USD',
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL, -- 'recarga' | 'debito' | 'ajuste_admin' | 'trial'
    monto DECIMAL(10,4) NOT NULL, -- Positivo = crédito, Negativo = débito
    saldo_anterior DECIMAL(10,4) NOT NULL,
    saldo_nuevo DECIMAL(10,4) NOT NULL,
    -- Referencia externa
    whop_payment_id VARCHAR(100), -- Si es recarga por Whop
    call_sid VARCHAR(100), -- Si es débito por llamada
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recharge_packages (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL, -- "Paquete Básico", "Paquete Pro"
    monto_recarga DECIMAL(10,2) NOT NULL, -- Cuánto paga el cliente
    saldo_otorgado DECIMAL(10,2) NOT NULL, -- Cuánto saldo recibe
    precio_por_minuto DECIMAL(10,4) NOT NULL, -- Tarifa aplicable
    precio_por_segundo DECIMAL(10,6), -- Calculado: precio_minuto / 60
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- 4. CONFIGURACIÓN GLOBAL DEL ADMIN
-- ═══════════════════════════════════════════
CREATE TABLE admin_config (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Valores iniciales
INSERT INTO admin_config (clave, valor, descripcion) VALUES
('saldo_trial', '5.00', 'Saldo de regalo para nuevos usuarios (USD)'),
('limite_saldo_negativo', '-5.00', 'Límite de saldo negativo antes de bloquear llamadas'),
('cobro_por_segundo', 'false', 'true = cobrar por segundo, false = cobrar por minuto completo'),
('precio_minuto_default', '0.50', 'Precio por minuto si no hay paquete asignado'),
('mensaje_mantenimiento', '', 'Mensaje global de mantenimiento (vacío = desactivado)'),
('alerta_cpu_porcentaje', '85', 'Umbral de CPU para alerta al admin'),
('alerta_ram_porcentaje', '90', 'Umbral de RAM para alerta al admin'),
('alerta_latencia_ms', '600', 'Umbral de latencia de audio para alerta'),
('email_admin_alertas', 'admin@midominio.com', 'Email del admin para recibir alertas');

-- ═══════════════════════════════════════════
-- 5. MEMORIA / RAG
-- ═══════════════════════════════════════════
CREATE TABLE business_memory (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    raw_context TEXT,
    embedding vector(768), -- gemini-embedding-001, 768 dims
    status VARCHAR(20) DEFAULT 'activo', -- 'borrador' | 'activo' | 'archivado'
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- 6. NÚMEROS TELEFÓNICOS
-- ═══════════════════════════════════════════
-- 6. NÚMEROS TELEFÓNICOS
-- ═══════════════════════════════════════════
CREATE TABLE phone_numbers (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    telnyx_phone_sid VARCHAR(100),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    country_code VARCHAR(5) DEFAULT '+1', -- País del número
    is_active BOOLEAN DEFAULT TRUE,
    purchased_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- 7. CITAS (Universal: horas, noches, recursos)
-- ═══════════════════════════════════════════
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone_number_id INT REFERENCES phone_numbers(id),
    -- Datos del cliente final
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    extra_fields JSONB,
    -- Fechas (siempre en UTC internamente)
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INT,
    -- Recurso asignado (silla, doctor, habitación, etc.)
    recurso_id VARCHAR(100),
    -- Estado
    status VARCHAR(20) DEFAULT 'agendado', -- 'agendado'|'asistio'|'no_asistio'|'cancelado'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- 8. GRABACIONES
-- ═══════════════════════════════════════════
CREATE TABLE call_recordings (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    telnyx_call_control_id VARCHAR(100),
    telnyx_stream_sid VARCHAR(100),
    r2_file_url TEXT NOT NULL,
    duration_seconds INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- 9. MÉTRICAS DE LLAMADAS (para monitoreo)
-- ═══════════════════════════════════════════
CREATE TABLE call_metrics (
    id SERIAL PRIMARY KEY,
    telnyx_call_control_id VARCHAR(100),
    user_id UUID REFERENCES users(id),
    inicio TIMESTAMP,
    fin TIMESTAMP,
    duracion_segundos INT,
    latencia_promedio_ms INT, -- Latencia promedio de respuesta de Gemini
    latencia_max_ms INT,
    cobro_aplicado DECIMAL(10,4),
    error_code VARCHAR(20), -- Si hubo error de telefonía (Telnyx)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_appointments_user_start ON appointments(user_id, start_time);
CREATE INDEX idx_appointments_recurso ON appointments(user_id, recurso_id, start_time);
CREATE INDEX idx_phone_numbers_user ON phone_numbers(user_id);
CREATE INDEX idx_memory_user ON business_memory(user_id) WHERE status = 'activo';
CREATE INDEX idx_wallet_tx_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_call_metrics_user ON call_metrics(user_id, created_at DESC);
CREATE INDEX idx_memory_embedding ON business_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 5. SISTEMA DE BILLING (Whop + Wallet)

### 5.1 Flujo de Recarga

1. El cliente va a `/recargas` en su dashboard.
2. Ve los paquetes configurados por el admin (tabla `recharge_packages`).
3. Selecciona un paquete → se genera un **checkout link de Whop** con `metadata: { user_id, package_id }`.
4. El cliente paga en Whop.
5. Whop envía webhook `payment.succeeded` a `POST /api/whop/webhook`.

### 5.2 Webhook de Whop (Next.js API Route)

```typescript
// /frontend-next/src/app/api/whop/webhook/route.ts
import { Whop } from '@whop/sdk';

const whopsdk = new Whop({
    apiKey: process.env.WHOP_API_KEY!,
    webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ''),
});

export async function POST(request: Request): Promise<Response> {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers);
    
    // Verifica firma automáticamente. Lanza excepción si es inválida.
    const evento = whopsdk.webhooks.unwrap(body, { headers });
    
    if (evento.type === 'payment.succeeded') {
        const { id, amount_after_fees, metadata } = evento.data;
        const userId = metadata.user_id;
        const packageId = metadata.package_id;
        
        // Acreditar saldo en wallet + registrar transacción
        await acreditarSaldo(userId, packageId, id, amount_after_fees);
    }
    
    if (evento.type === 'refund.created') {
        // Descontar saldo si hay reembolso
        await reversarSaldo(evento.data);
    }
    
    return new Response('OK', { status: 200 });
}
```

### 5.3 Lógica de Débito (Express - billing.service.ts)

```typescript
// Al INICIAR la llamada (evento 'start' de Telnyx):
async function verificarSaldo(userId: string): Promise<boolean> {
    const { saldo } = await getWallet(userId);
    const limiteNegativo = await getConfig('limite_saldo_negativo'); // ej: -5.00
    
    if (saldo <= parseFloat(limiteNegativo)) {
        return false; // Rechazar llamada
    }
    return true; // Permitir (incluso con saldo negativo hasta el límite)
}

// DURANTE la llamada (cada 60 segundos o al finalizar):
async function debitarLlamada(userId: string, callControlId: string, duracionSegundos: number) {
    const cobroPorSegundo = await getConfig('cobro_por_segundo') === 'true';
    const precioMinuto = await getPrecioMinuto(userId);
    
    let monto: number;
    if (cobroPorSegundo) {
        const precioSegundo = precioMinuto / 60;
        monto = precioSegundo * duracionSegundos;
    } else {
        const minutos = Math.ceil(duracionSegundos / 60); // Redondea hacia arriba
        monto = precioMinuto * minutos;
    }
    
    // Registrar débito en wallet_transactions
    await registrarTransaccion(userId, 'debito', -monto, callControlId, `Llamada ${callControlId}`);
}
```

### 5.4 Notificaciones de Saldo Bajo

- Al **50%** del saldo inicial de la última recarga → notificación in-app.
- Al **20%** → notificación in-app + email.
- Al **5%** → notificación in-app + email urgente.
- Al llegar a **$0.00** → email: "Tu saldo se agotó. Recarga para seguir recibiendo llamadas."
- Las notificaciones se emiten vía SSE al frontend + Nodemailer.

### 5.5 Cuando el saldo llega al límite negativo

- La llamada **actual** termina normalmente (no se corta a mitad).
- Las **siguientes** llamadas reciben un TwiML con `<Say>`: *"Lo sentimos, este servicio no está disponible temporalmente."* y se cuelga.
- El número sigue activo pero no procesa IA.

---

## 6. PANEL ADMINISTRATIVO

### 6.1 Rutas del Admin (solo `role = 'admin'`)

| Ruta | Función |
|------|---------|
| `/admin/clientes` | Lista de todos los usuarios. Suspender/activar/eliminar. Ver saldo y consumo de cada uno. |
| `/admin/tarifas` | CRUD de `recharge_packages`. Configurar precio/minuto, cobro por segundo ON/OFF, límite saldo negativo, saldo trial. |
| `/admin/metricas` | Dashboard en tiempo real: CPU, RAM, llamadas activas, latencia promedio, rate limits de APIs (Gemini, Telnyx). Gráficos con `recharts`. |
| `/admin/flujo-caja` | Ingresos por Whop, débitos totales, balance general. Filtro por fecha. Exportar CSV. |
| `/admin/ranking` | Ranking de clientes por consumo (minutos, dinero). Top 10. |
| `/admin/configuracion` | Mensaje de mantenimiento global. Email de alertas. Umbrales de alertas. |

### 6.2 Alertas al Admin

El `monitoring.service.ts` corre un intervalo cada **10 segundos** que verifica:

```typescript
const metricas = {
    cpu: os.loadavg()[0] / os.cpus().length * 100,
    ram: (1 - os.freemem() / os.totalmem()) * 100,
    llamadasActivas: contadorWebSocketsActivos(),
    latenciaUltima: ultimaLatenciaGemini,
};

if (metricas.cpu > umbralCPU || metricas.ram > umbralRAM || metricas.latencia > umbralLatencia) {
    await enviarEmailAdmin(`⚠️ Alerta: CPU ${metricas.cpu}% | RAM ${metricas.ram}% | Latencia ${metricas.latencia}ms`);
    await emitirSSEAdmin('alerta_sistema', metricas);
}
```

### 6.3 Rate Limits de APIs (Visibilidad)

El panel de métricas muestra:
- **Gemini API**: Requests restantes del día (leer de headers `x-ratelimit-remaining-requests`).
- **Telnyx API**: Límite de concurrencia de llamadas (configurado en cuenta Telnyx).
- **Whop**: Estado del webhook (último evento recibido, errores).

---

## 7. FLUJO DE VOZ (Express + Telnyx + Gemini)

### 7.1 Webhook de Entrada

Cuando Telnyx recibe una llamada en el número del cliente:

```typescript
// webhooks.telnyx.ts
app.post('/webhooks/telnyx/voice', validarFirmaTelnyx, async (req, res) => {
    const { call_control_id, From, To } = req.body.payload;
    const userId = await obtenerUsuarioPorNumero(To);
    
    // 1. Verificar mantenimiento global
    const mantenimiento = await getConfig('mensaje_mantenimiento');
    if (mantenimiento) {
        return res.type('application/xml').send(generateRejectionTeXML(mantenimiento));
    }
    
    // 2. Verificar saldo
    const saldoOk = await verificarSaldo(userId);
    if (!saldoOk) {
        return res.type('application/xml').send(generateRejectionTeXML("Lo sentimos, este servicio no está disponible temporalmente."));
    }
    
    // 3. Verificar horario de atención
    const settings = await getBusinessSettings(userId); // Desde Redis cache
    const dentroDeHorario = verificarHorario(settings);
    
    if (!dentroDeHorario && !settings.modo_24_7) {
        return res.type('application/xml').send(generateRejectionTeXML(`Gracias por llamar. Nuestro horario de atención es de...`, settings.ai_language));
    }
    
    // 4. Conectar stream bidireccional
    const wsUrl = `wss://${process.env.DOMINIO_EXPRESS}/stream/telnyx?user_id=${userId}&call_control_id=${call_control_id}`;
    res.type('text/xml').send(`
        <Response>
            ${settings.consentimiento_activo ? `<Say language="${settings.ai_language}">${settings.mensaje_consentimiento}</Say>` : ''}
            <Connect>
                <Stream url="${wsUrl}" />
            </Connect>
        </Response>
    `);
});
```

### 7.2 WebSocket de Telnyx → Gemini (Pipeline de Audio)

**Eventos de Telnyx entrantes**: `start`, `media`, `stop`.

**Transcodificación Telnyx → Gemini**:
```
Telnyx envía: G.711 μ-law, 8kHz, mono, Base64
     ↓ decodificar Base64
     ↓ μ-law → PCM lineal 16-bit (usar paquete 'g711')
     ↓ resamplear 8kHz → 16kHz (usar fluent-ffmpeg o interpolación lineal)
Gemini espera: PCM 16-bit, 16kHz, Little-Endian
```

**Transcodificación Gemini → Telnyx**:
```
Gemini envía: PCM 16-bit, 24kHz, Little-Endian, Base64
     ↓ decodificar Base64
     ↓ resamplear 24kHz → 8kHz
     ↓ PCM lineal → μ-law (usar paquete 'g711')
     ↓ codificar Base64
Telnyx espera: G.711 μ-law, 8kHz, Base64
```

### 7.3 Conexión con Gemini Live

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function crearSesionGemini(userId: string, streamSid: string) {
    // Obtener contexto del negocio (Redis → fallback Postgres → RAG)
    const contexto = await obtenerContextoNegocio(userId);
    const settings = await getBusinessSettings(userId);
    
    const systemPrompt = construirSystemPrompt(contexto, settings);
    
    const session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: obtenerHerramientas(settings),
            thinkingConfig: { thinkingLevel: 'MINIMAL' }
        }
    });
    
    return session;
}
```

### 7.4 System Prompt Dinámico (Inyectado al inicio)

```typescript
function construirSystemPrompt(contexto: string, settings: BusinessSettings): string {
    const idiomaInstruccion = obtenerInstruccionIdioma(settings.ai_language);
    const horarioTexto = formatearHorario(settings.business_hours, settings.timezone);
    const modoCita = settings.booking_mode === 'hours' 
        ? `Las citas son por franjas horarias de ${settings.default_duration_minutes} minutos.`
        : `Las citas son por noches. Check-in: ${settings.check_in_time}, Check-out: ${settings.check_out_time}.`;
    
    return `
${idiomaInstruccion}

## CONTEXTO DEL NEGOCIO
${contexto}

## REGLAS DE AGENDAMIENTO
- Modo: ${modoCita}
- Horario de atención: ${horarioTexto}
- Zona horaria: ${settings.timezone}
- ${settings.modo_24_7 ? 'Fuera de horario: informa el horario pero NO agendes. Ofrece tomar un mensaje.' : ''}

## FORMULARIO DE DATOS
Debes recopilar: ${JSON.stringify(settings.form_fields)}

## RECURSOS DISPONIBLES
${settings.recursos.length > 0 ? JSON.stringify(settings.recursos) : 'No hay recursos específicos. Agenda por tiempo.'}

## INSTRUCCIONES
- Sé amable, profesional y conciso.
- Antes de agendar, SIEMPRE consulta disponibilidad con la herramienta.
- Confirma los datos con el cliente antes de guardar.
- Si el cliente quiere cancelar, usa la herramienta de cancelación.
    `.trim();
}
```

### 7.5 Barge-in (Interrupción)

**Gemini detecta la interrupción** (VAD nativo del modelo multimodal). Cuando detecta voz del usuario mientras genera audio:
1. Gemini **cancela** su generación actual internamente.
2. Deja de enviar chunks de audio por el WebSocket.

**Tu servidor Express debe**:
1. Detectar que Gemini dejó de enviar audio (no hay nuevos `part.inlineData` por > 200ms mientras Telnyx sigue mandando `media` inbound).
2. Inmediatamente enviar a Telnyx:
```json
{ "event": "clear", "stream_id": "MZ..." }
```
3. Esto limpia el búfer residual de Telnyx (los 1-2 segundos de audio ya encolado).

**Filtro de ruido**: Para evitar que ruido ambiental dispare falsas interrupciones, implementar un umbral de energía en los chunks inbound de Telnyx. Solo considerar "voz real" si la energía del frame supera un umbral configurable (ej: -40dBFS). Usar la librería `webrtcvad` (VAD nativo) como segundo filtro si el análisis de energía no es suficiente.

### 7.6 Function Calling (Síncrono y Bloqueante)

**Herramientas registradas**:

```typescript
function obtenerHerramientas(settings: BusinessSettings) {
    const herramientas = [
        {
            functionDeclarations: [
                {
                    name: "consultar_disponibilidad",
                    description: "Consulta citas agendadas para una fecha. Retorna horarios ocupados y libres.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            date: { type: "STRING", description: "Fecha YYYY-MM-DD en la zona horaria del negocio" },
                            recurso_id: { type: "STRING", description: "ID del recurso (opcional)" }
                        },
                        required: ["date"]
                    }
                },
                {
                    name: "agendar_cita",
                    description: "Agenda una nueva cita. Verifica que no haya conflicto antes de guardar.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customer_name: { type: "STRING" },
                            customer_phone: { type: "STRING" },
                            customer_email: { type: "STRING" },
                            start_time: { type: "STRING", description: "ISO 8601 con timezone" },
                            end_time: { type: "STRING", description: "ISO 8601 (modo noches)" },
                            duration_minutes: { type: "INTEGER" },
                            recurso_id: { type: "STRING" },
                            notes: { type: "STRING" },
                            extra_fields: { type: "OBJECT" }
                        },
                        required: ["customer_name", "start_time"]
                    }
                },
                {
                    name: "cancelar_cita",
                    description: "Cancela una cita existente buscando por nombre o teléfono del cliente.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customer_name: { type: "STRING" },
                            customer_phone: { type: "STRING" },
                            date: { type: "STRING", description: "Fecha aproximada YYYY-MM-DD" }
                        },
                        required: ["customer_name"]
                    }
                }
            ]
        }
    ];
    
    // Solo en modo simulador:
    if (esSimulador) {
        herramientas[0].functionDeclarations.push({
            name: "guardar_contexto",
            description: "Guarda el contexto del negocio. Solo usar cuando el usuario confirme que la información está completa.",
            parameters: {
                type: "OBJECT",
                properties: {
                    raw_context: { type: "STRING", description: "Resumen completo del contexto del negocio" }
                },
                required: ["raw_context"]
            }
        });
    }
    
    return herramientas;
}
```

**Manejo de la respuesta (SÍNCRONO)**:

```typescript
for await (const message of session.receive()) {
    const parts = message.serverContent?.modelTurn?.parts;
    if (!parts) continue;
    
    for (const part of parts) {
        // Audio de respuesta
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
            const pcm24k = Buffer.from(part.inlineData.data, 'base64');
const mulaw8k = transcodificarGeminiATelefonía(pcm24k);
            enviarATelnyx(streamSid, mulaw8k);
            registrarLatencia();
        }
        
        // Transcripción
        if (part.text) {
            emitirSSE(userId, 'transcripcion', part.text);
        }
        
        // Function Call
        if (part.functionCall) {
            const { name, args } = part.functionCall;
            const resultado = await ejecutarHerramienta(name, args, userId);
            
            // RESPONDER A GEMINI (bloqueante - el modelo espera esto)
            await session.sendRealtimeInput({
                functionResponses: [{
                    name: name,
                    response: { result: resultado }
                }]
            });
        }
    }
    
    // Turno completo
    if (message.serverContent?.turnComplete) {
        logger.info({ callSid }, 'Turno de Gemini completado');
    }
}
```

### 7.7 Grabación de Llamadas (Opcional)

Si `settings.grabacion_activa === true`:

- Express acumula todos los chunks inbound (voz del cliente) y outbound (voz de la IA) en dos buffers separados durante la llamada.
- Al evento `stop` de Telnyx:
  1. Ensamblar ambos buffers en un WAV estéreo (canal izq = cliente, canal der = IA) usando `fluent-ffmpeg`.
  2. Subir a Cloudflare R2 con `@aws-sdk/client-s3`.
  3. Guardar URL en `call_recordings`.
  4. Generar URL firmada (expira 1 hora) para reproducción en frontend.
- **Retención**: Indefinida. El cliente elimina desde su panel cuando quiera.

### 7.8 Fin de Llamada y Cobro

```typescript
// Evento 'stop' de Telnyx
async function finalizarLlamada(userId: string, callControlId: string, streamSid: string) {
    const inicio = registroLlamadas.get(callControlId)?.inicio;
    const duracionSegundos = Math.round((Date.now() - inicio) / 1000);
    
    // 1. Debitar
    await debitarLlamada(userId, callControlId, duracionSegundos);
    
    // 2. Grabación (si aplica)
    if (grabacionActiva) await ensamblarYSubirAudio(callControlId, userId);
    
    // 3. Métricas
    await guardarMetricas(callControlId, userId, duracionSegundos);
    
    // 4. Cerrar sesión Gemini
    await session.close();
    
    // 5. Limpiar Redis temporal
    await limpiarBuffersLlamada(callSid);
    
    // 6. Notificar al dueño (SSE)
    emitirSSE(userId, 'llamada_finalizada', { callSid, duracionSegundos });
}
```

---

## 8. SIMULADOR DE CONTEXTO (Entrevista de Voz)

### 8.1 Flujo Completo

1. El cliente entra a `/configuracion/contexto` (desktop) o `/mobile-configuracion/simulador` (móvil).
2. Ve un botón de micrófono. Al presionar:
   - Se abre WebSocket con Express.
   - Express abre sesión Gemini con `systemInstruction` de entrevistador.
   - **El cliente habla primero**. La IA escucha.
3. La IA tiene como objetivo: extraer toda la información del negocio (qué hace, servicios, precios, reglas, tono deseado, etc.).
4. Cuando la IA considera que tiene suficiente información, pregunta: *"¿Esto sería todo? Te doy un resumen de lo que tenemos hasta ahora."*
5. Si el cliente dice **"sí / está bien"** → La IA da el resumen y llama a `guardar_contexto`.
6. Si el cliente dice **"no, falta más"** → La IA sigue escuchando y preguntando.
7. **Timeout**: Si no se detecta intención real de conversación (silencio prolongado > 30s o respuestas sin sentido), la IA pregunta: *"¿Sigues ahí? Si necesitas más tiempo, puedes volver a iniciar la conversación."* Tras 60s más sin respuesta, se cierra gracefully.

### 8.2 Edición Posterior

- Después de la entrevista, el `raw_context` se muestra en un textarea editable.
- El cliente puede modificarlo manualmente y guardar.
- Al guardar: se re-embedda (nuevo vector 768 dims) y se actualiza en Redis cache.

### 8.3 Re-entrevista

- Botón "Re-entrevistar".
- La IA inicia diciendo: *"Ya tengo información de tu negocio: [resumen breve]. ¿Qué partes quieres actualizar o agregar? También podemos empezar desde cero si prefieres."*
- Si el cliente dice "empezar de cero" → se archiva la versión anterior (`status = 'archivado'`) y se crea nueva.
- Si dice "quiero cambiar X" → la IA solo actualiza esa parte.

### 8.4 Versionado

- Cada guardado incrementa `version` en `business_memory`.
- Las versiones anteriores quedan con `status = 'archivado'` (no se borran).

---

## 9. SISTEMA DE CITAS UNIVERSAL

### 9.1 Flexibilidad

El sistema NO asume un tipo de negocio. La tabla `appointments` + `business_settings.recursos` permite:

| Negocio | Recursos | Modo | Duración |
|---------|----------|------|----------|
| Barbería | `["Silla 1", "Silla 2", "Silla 3"]` | hours | 30 min |
| Clínica | `["Dr. García", "Dra. López"]` | hours | 45 min |
| Hotel | `["Habitación 101", "Suite 201"]` | nights | check-in/out |
| Spa | `["Sala Masaje 1", "Sala Facial 2"]` | hours | 60 min |
| Consultoría | `[]` (sin recursos) | hours | 60 min |

### 9.2 Validación de Overlap

```typescript
async function verificarOverlap(userId: string, startTime: Date, endTime: Date, recursoId?: string): Promise<boolean> {
    let query = `
        SELECT COUNT(*) FROM appointments 
        WHERE user_id = $1 
        AND status != 'cancelado'
        AND start_time < $3 
        AND end_time > $2
    `;
    const params: any[] = [userId, startTime, endTime];
    
    if (recursoId) {
        query += ` AND recurso_id = $4`;
        params.push(recursoId);
    }
    
    const { rows } = await pool.query(query, params);
    return parseInt(rows[0].count) > 0; // true = HAY conflicto
}
```

### 9.3 Horarios y Zonas Horarias

- Todas las fechas se guardan en **UTC** (`TIMESTAMP WITH TIME ZONE`).
- La IA conoce la zona horaria del negocio (inyectada en system prompt).
- Cuando la IA dice "Tu cita es a las 3 PM", se refiere a la hora local del negocio.
- El frontend muestra las citas en la zona horaria del negocio (usar `date-fns-tz` o `luxon`).

### 9.4 Modo 24/7 vs Horario Restringido

- `modo_24_7 = true`: La IA contesta siempre. Fuera de horario: informa, ofrece tomar mensaje, pero **NO agenda**.
- `modo_24_7 = false`: Fuera de horario, el webhook devuelve TwiML con `<Say>` informando horario y `<Hangup/>`. No se abre WebSocket ni sesión Gemini (ahorra costos).

---

## 10. CONFIRMACIÓN AL CLIENTE FINAL

Después de agendar una cita:

1. **Verbal** (siempre): La IA dice *"Perfecto, tu cita queda agendada para el [fecha] a las [hora]. ¿Necesitas algo más?"*
2. **Email** (condicional): Solo si el campo `email` está en `form_fields` como `required: true` Y el cliente final proporcionó su correo.
   - Asunto: *"Confirmación de cita - {business_name}"*
   - Cuerpo: Resumen de la cita (fecha, hora, negocio, notas).
   - Se envía con Nodemailer desde el backend Express.

---

## 11. INTERFAZ Y ESTILOS (WhatsApp Web)

### 11.1 Temas

- Light y Dark con variables CSS + Tailwind.
- `panelClass`: `bg-white dark:bg-[#111b21] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-none`
- Fondo raíz: `bg-slate-50 dark:bg-[#0b141a]`
- Transiciones: `transition-colors duration-200`

### 11.2 Móvil (No responsive, archivos separados)

- Middleware Next.js detecta `User-Agent` → redirige a `/(movil)`.
- Simulador móvil: fondo con vista previa del contexto + botón redondo fijo (60px radio, `position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%)`).
- Al grabar: botón cambia a estado "grabando" con ondas animadas CSS.
- Texto se actualiza en tiempo real vía SSE.

### 11.3 Calendario

- `booking_mode = 'hours'` → `react-big-calendar` con franjas horarias.
- `booking_mode = 'nights'` → `react-date-range` con selección de rango.
- Estados: `agendado` (verde), `asistio` (azul), `no_asistio` (rojo), `cancelado` (gris).
- Dropdown para cambiar estado desde el dashboard.

### 11.4 Widget de Saldo

- En el header del dashboard: `WalletBalance.tsx` muestra saldo actual con color:
  - Verde: > 50% de la última recarga.
  - Amarillo: 20-50%.
  - Rojo: < 20%.
- Click → abre `RechargeModal.tsx` con los paquetes disponibles (Whop checkout).

---

## 12. NOTIFICACIONES (SSE + Email)

### 12.1 SSE (Tiempo real)

- Endpoint Express: `GET /sse/events?user_id={uuid}&token={jwt}`
- Eventos emitidos:
  - `nueva_cita` → "Nueva cita agendada por {nombre}"
  - `llamada_finalizada` → "Llamada de {duracion}s finalizada"
  - `saldo_bajo` → "Tu saldo está por agotarse"
  - `transcripcion` → Texto en vivo (solo en simulador)
  - `alerta_sistema` → Solo para admin

### 12.2 Emails (Nodemailer)

| Evento | Destinatario | Asunto |
|--------|-------------|--------|
| Registro | Usuario | "Verifica tu cuenta" |
| Recuperación password | Usuario | "Restablece tu contraseña" |
| Cita agendada (con email) | Cliente final | "Confirmación de cita - {negocio}" |
| Nueva cita | Dueño del negocio | "Tienes una nueva cita" |
| Saldo bajo (20%) | Dueño del negocio | "Tu saldo está por agotarse" |
| Saldo agotado | Dueño del negocio | "Saldo agotado - Recarga para seguir" |
| Alerta sistema | Admin | "⚠️ Alerta de rendimiento" |

---

## 13. MONITOREO Y OBSERVABILIDAD

### 13.1 Logging (Pino)

```typescript
// utils/logger.ts
import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty', // Solo en dev
        options: { colorize: true }
    },
    // En producción: JSON puro a stdout (Render lo captura)
});

// Uso con contexto de llamada
const callLogger = logger.child({ callControlId, userId, streamSid });
callLogger.info({ latencia: 234 }, 'Chunk de audio enviado a Telnyx');
```

### 13.2 Métricas de Hardware (monitoring.service.ts)

Cada 10 segundos:
- `os.loadavg()` → CPU
- `os.freemem() / os.totalmem()` → RAM
- `process.memoryUsage()` → Heap de Node
- Contador de WebSockets activos → Llamadas concurrentes
- Último `x-ratelimit-remaining` de Gemini → Cuota restante

### 13.3 Métricas de Latencia

- En cada chunk de audio enviado a Telnyx, registrar `Date.now() - timestampInicioTurno`.
- Calcular promedio y máximo por llamada.
- Guardar en `call_metrics`.
- Si latencia > umbral (600ms default) → alerta SSE al admin + email.

### 13.4 Endpoint de Métricas (Admin)

```typescript
// admin.api.ts
app.get('/admin/metricas', authAdmin, (req, res) => {
    res.json({
        cpu: obtenerCPU(),
        ram: obtenerRAM(),
        heap: process.memoryUsage(),
        llamadasActivas: contadorWS,
        latenciaPromedio: obtenerLatenciaPromedia(),
        geminiRateLimit: ultimoRateLimitGemini,
        uptime: process.uptime(),
        historial: obtenerHistorialMetricas() // Últimos 60 minutos, sampleado cada 10s
    });
});
```

---

## 14. SEGURIDAD

## 14. SEGURIDAD

1. **Telnyx**: Validar `Telnyx-Signature-Ed25519` en cada webhook usando la Public Key de la cuenta.
2. **Whop**: Verificación automática con `whopsdk.webhooks.unwrap()` (firma HMAC).
3. **JWT**: En todas las rutas protegidas. Expiración: 24h. Refresh token: 7 días.
4. **Encriptación**: `telnyx_api_key` con AES-256-GCM (`crypto.createCipheriv`).
5. **CORS**: Express solo acepta requests del dominio del frontend.
6. **Rate Limiting**: 100 req/min por IP en Express y Next.js.
7. **Validación de entrada**: Zod en todos los endpoints.
8. **SQL Injection**: Siempre queries parametrizadas (`$1, $2...`).
9. **Admin**: Middleware que verifica `role = 'admin'` en el JWT.

---

## 15. DESPLIEGUE EN RENDER

### 15.1 Servicios

| Servicio | Tipo en Render | Comando |
|----------|---------------|---------|
| `frontend-next` | Static Site o Web Service | `next build && next start` |
| `backend-express` | Web Service (con WebSocket) | `node dist/index.js` |
| `postgres` | PostgreSQL (managed) | — |
| `redis` | Redis (managed o Upstash) | — |

### 15.2 render.yaml

```yaml
services:
  - type: web
    name: backend-express
    runtime: node
    buildCommand: cd backend-express && npm install && npm run build
    startCommand: cd backend-express && node dist/index.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: postgres-main
          property: connectionString
      - key: REDIS_URL
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: TELNYX_API_KEY
        sync: false
      - key: TELNYX_PUBLIC_KEY
        sync: false
      - key: TELNYX_ORG_ID
        sync: false
      - key: TELNYX_WEBHOOK_SECRET
        sync: false
      - key: TELNYX_WEBHOOK_URL
        sync: false
      - key: WHOP_API_KEY
        sync: false
      - key: WHOP_WEBHOOK_SECRET
        sync: false
      - key: R2_ACCOUNT_ID
        sync: false
      - key: R2_ACCESS_KEY
        sync: false
      - key: R2_SECRET_KEY
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: ENCRYPTION_KEY
        generateValue: true

  - type: web
    name: frontend-next
    runtime: node
    buildCommand: cd frontend-next && npm install && npm run build
    startCommand: cd frontend-next && npm start
    envVars:
      - key: NEXT_PUBLIC_API_URL
        sync: false
      - key: NEXT_PUBLIC_WS_URL
        sync: false

databases:
  - name: postgres-main
    plan: starter
```

### 15.3 Consideraciones Render

- Render soporta WebSockets nativamente en Web Services [[4]].
- El dominio del Express service será `wss://backend-express.onrender.com` (SSL automático).
- **Importante**: Render en plan gratuito duerme tras 15 min de inactividad. Para producción, usar plan **Starter** o superior (siempre activo).
- Configurar custom domain para el frontend.

---

## 16. RAG / EMBEDDINGS

### 16.1 Modelo

- **`gemini-embedding-001`** con `output_dimensionality: 768`.
- `text-embedding-004` está deprecado. NO usarlo.

### 16.2 Flujo

```typescript
import { GoogleGenAI } from '@google/genai';

async function generarEmbedding(texto: string): Promise<number[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: texto,
        config: { outputDimensionality: 768 }
    });
    return result.embeddings[0].values;
}
```

### 16.3 Búsqueda al inicio de llamada

```typescript
async function obtenerContextoNegocio(userId: string): Promise<string> {
    // 1. Intentar Redis (TTL 60s)
    const cached = await redis.get(`contexto:${userId}`);
    if (cached) return cached;
    
    // 2. Buscar en pgvector (por si hay múltiples fragmentos)
    const { rows } = await pool.query(`
        SELECT raw_context, 1 - (embedding <=> $2::vector) AS similitud
        FROM business_memory
        WHERE user_id = $1 AND status = 'activo'
        ORDER BY embedding <=> $2::vector
        LIMIT 3
    `, [userId, embeddingConsulta]);
    
    const contexto = rows.map(r => r.raw_context).join('\n---\n');
    
    // 3. Cachear
    await redis.setex(`contexto:${userId}`, 60, contexto);
    
    return contexto;
}
```

### 16.4 Invalidación de Cache

Cuando el cliente edita su contexto o configuración:
```typescript
// En el endpoint de actualización
await redis.del(`contexto:${userId}`);
await redis.del(`settings:${userId}`);
// La próxima llamada recarga desde Postgres
```

---

## 17. INSTRUCCIONES FINALES PARA LA IA CONSTRUCTORA

1. **Genera TODO el código**. Sin `// TODO`, sin placeholders, sin "implementar aquí".
2. **Máximo 600 líneas por archivo**. Si excede, extraer a sub-módulo.
3. **Idioma del código**: Variables, funciones, tablas, comentarios → **Español**.
4. **Idioma de la IA en llamadas**: Dinámico según `business_settings.ai_language`.
5. **Manejo de errores**: `try-catch` en todos los WebSockets. Si Gemini falla → mensaje de voz: *"Lo siento, tengo problemas técnicos. Intenta de nuevo."* + colgar.
6. **Validación de overlap**: Antes de agendar, SIEMPRE verificar conflicto de horarios.
7. **Transcodificación**: Usar `fluent-ffmpeg` + `g711`. Verificar que los buffers no se corrompan.
8. **Function Calling síncrono**: El modelo PAUSA hasta recibir `functionResponses`. No continuar el loop sin enviar la respuesta.
9. **Billing**: Debitar al finalizar la llamada. Registrar en `wallet_transactions` con `saldo_anterior` y `saldo_nuevo`.
10. **Whop**: Verificar firma del webhook. Acreditar saldo solo tras `payment.succeeded`.
11. **Redis**: Cachear contexto y settings con TTL 60s. Invalidar al editar.
12. **Pino**: Loggear cada evento relevante (inicio llamada, fin llamada, error, function call, latencia).
13. **Alertas**: Si CPU > umbral O RAM > umbral O latencia > umbral → email al admin + SSE.
14. **Zonas horarias**: Guardar en UTC. Mostrar y comunicar en la zona del negocio. Usar `luxon` o `date-fns-tz`.
15. **Grabación**: Solo si `grabacion_activa = true`. Ensamblar estéreo (izq=cliente, der=IA). Subir a R2.
16. **Simulador**: Timeout de 30s silencio → preguntar. 60s más → cerrar. Guardar `raw_context` incluso si se cierra inesperadamente.
17. **Scripts**: `backend-express/package.json` → `"dev": "nodemon src/index.ts"`. `frontend-next/package.json` → `"dev": "next dev"`.
18. **Docker-compose local**: Solo Postgres + Redis. Express y Next corren con `npm run dev`.
19. **Errores Telnyx**: Loggear y monitorear (protocol, broken pipe, buffer overflow).
20. **No usar SMS**: No configurar `SmsUrl`. No crear endpoints SMS. No crear tablas SMS.

---

## 18. VARIABLES DE ENTORNO (.env)

```env
# ─── Base de Datos ───
DATABASE_URL=postgresql://user:pass@localhost:5432/vozsaas

# ─── Redis ───
REDIS_URL=redis://localhost:6379

# ─── Gemini ───
GEMINI_API_KEY=AIza...

# ─── Telnyx (Telefonía) ───
# Obtén tu API Key v2 en https://portal.telnyx.com
# Public Key para validar webhooks Ed25519
# Organization ID para crear child accounts
TELNYX_API_KEY=
TELNYX_PUBLIC_KEY=
TELNYX_ORG_ID=
TELNYX_WEBHOOK_SECRET=
TELNYX_WEBHOOK_URL=https://api.tu-dominio.com/webhooks/telnyx/voice

# ─── Whop ───
WHOP_API_KEY=...
WHOP_WEBHOOK_SECRET=...

# ─── Cloudflare R2 ───
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=grabaciones

# ─── Auth ───
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ENCRYPTION_KEY=... # 32 bytes hex para AES-256

# ─── Email ───
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=... # App Password

# ─── Dominios ───
DOMINIO_FRONTEND=https://midominio.com
DOMINIO_EXPRESS=https://backend-express.onrender.com

# ─── Render ───
NODE_ENV=production
LOG_LEVEL=info
```

---

**¡SISTEMA COMPLETAMENTE DEFINIDO! PROCEDE A CONSTRUIR LA PLATAFORMA.**






