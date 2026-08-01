# 🎙️ VozIA — Agente de Voz IA Multi-tenant

> **SaaS de agentes de voz con IA** para negocios: la IA contesta las llamadas, conversa en lenguaje natural y agenda citas. Plataforma multi-tenant con billing por saldo, panel admin y simulador de voz.

VozIA conecta **Telnyx** (telefonía) con **Gemini Live** (conversación de audio en tiempo real) y **Whop** (pagos), sobre un stack Next.js + Express + PostgreSQL.

---

## ✨ Funcionalidades

### 🤖 Agente de voz en llamadas
- **Llamadas entrantes reales** vía Telnyx `<Dial><Stream>` (WebSocket bidireccional, Media Streaming API).
- **Gemini 3.1 Flash Live**: audio streaming bidireccional + *function calling* síncrono.
- **VAD real (WebRTC VAD / WASM)** para barge-in preciso — distingue voz de ruido de fondo.
- **Detección de fin de frase** y transcripción en vivo por SSE.
- **Idioma configurable** por negocio (español, inglés, portugués, francés, italiano, alemán).

### 📅 Citas inteligentes
- Herramientas de IA: `consultar_disponibilidad`, `agendar_cita`, `cancelar_cita`.
- Validación de horario, franjas, modo noches y conflictos (overlap).

### 💰 Billing por saldo (Whop)
- Recargas vía **Whop.com** con acreditación idempotente de wallet.
- Débito por **minuto** o **segundo** (configurable), con alertas de saldo bajo.
- **Idempotencia completa**: un webhook duplicado jamás cobra/abona dos veces (transacciones + constraints UNIQUE).

### 🛠️ Panel admin
- Métricas reales (CPU/RAM/latencia/llamadas) desde el backend Express, con fallback a BD.
- Gestión de clientes, paquetes de recarga, ajustes de saldo, flujo de caja y ranking.
- **Logs reales** de la aplicación (Pino → ring buffer Redis/memoria).
- Logs de auditoría de acciones admin.

### 🧠 RAG / Memoria del negocio
- Embeddings `gemini-embedding-001` (768 dims) con búsqueda **pgvector**.
- Entrevista de voz (simulador) que captura el contexto del negocio.
- Cache del contexto en Redis con invalidación.

### 📝 Transcripts reales
- Transcripciones de las llamadas/simulaciones **persistidas** en BD (`CallTranscript`).

### 🔐 Seguridad
- Webhooks Telnyx firmados con **Ed25519** (verificación one-shot).
- API keys de Telnyx de child accounts **encriptadas en reposo** (AES-256-GCM).
- JWT, rate limiting, helmet, sanitización de prompts.

---

## 🏗️ Arquitectura

```
┌──────────────────────────┐      ┌───────────────────────────┐
│  Frontend (Next.js 16)   │      │   Backend (Express/Bun)   │
│  Dashboard + Simulador   │◄────►│   WebSockets + SSE + API  │
│  puerto 3000             │ SSE  │   puerto 3001             │
└──────────────────────────┘      └────────────┬──────────────┘
                                               │
                         ┌─────────────────────┼──────────────────┐
                         ▼                     ▼                  ▼
                   ┌───────────┐        ┌────────────┐     ┌────────────┐
                   │  Telnyx   │        │  Gemini    │     │    Whop    │
                   │ telefonía │◄──────►│ Live (LLM) │     │   pagos    │
                   └───────────┘        └────────────┘     └────────────┘
```

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Zustand |
| Backend tiempo real | Express 4 (WebSockets, SSE, webhooks, billing, monitoreo) |
| Base de datos | PostgreSQL 17 + `pgvector` (via Prisma) |
| Cache | Redis 7 (`ioredis`, con fallback en memoria) |
| LLM / Voz | Google Gemini 3.1 Flash Live (`@google/genai`) |
| Telefonía | Telnyx (Call Control API, Media Streaming, TeXML, Account Hierarchy) |
| Pagos | Whop.com (`@whop/sdk`) |
| Audio | `fluent-ffmpeg` + `g711` (μ-law ↔ PCM) + `@ennuicastr/webrtcvad.js` |
| Almacenamiento | Cloudflare R2 (S3 compatible) |
| Logging | Pino (JSON, multistream → Redis ring buffer) |
| Email | Nodemailer (Gmail App Password) |
| Despliegue | Render.com (`render.yaml`) |

---

## 📁 Estructura

```
├── src/                    # Frontend Next.js (dashboard, simulador, API routes)
│   └── app/api/            #   - admin/*, auth/*, simulator, wallet, citas, whop
├── backend-express/        # Backend Express
│   └── src/
│       ├── websockets/     #   telnyxStream.handler, gemini.handler, simulador.handler
│       ├── routes/         #   webhooks.telnyx, webhooks.whop, admin.api, internal.api
│       ├── services/       #   billing, calendar, rag, cache, email, monitoring, vad, audio
│       ├── middleware/     #   auth, telnyxSignature (Ed25519), rateLimiter
│       ├── sse/            #   events.emitter
│       ├── utils/          #   logger, audioTranscoder, encryption
│       └── __tests__/      #   Suite de tests (Vitest + Supertest)
├── prisma/                 # Schema Prisma compartido + seeds + migraciones
├── render.yaml             # Despliegue en Render (backend + frontend + Postgres)
├── docker-compose.yml      # Postgres + Redis para desarrollo local
└── info_sistema.md         # Especificación técnica del sistema
```

---

## 🚀 Puesta en marcha

### Requisitos
- Node.js ≥ 22, npm, **Bun** (para seeds) y **Docker** (Postgres + Redis locales).

### 1. Infraestructura local
```bash
npm run docker:up          # Postgres + Redis
cp .env.example .env       # completa tus claves (ver abajo)
```

### 2. Base de datos
```bash
npm run db:push            # sincroniza el schema Prisma
npm run db:seed            # configuración base + paquetes (requiere Bun)
```

### 3. Desarrollo
```bash
npm run dev                # Frontend (puerto 3000)
npm run dev:backend        # Backend (puerto 3001)
npm run dev:all            # Ambos a la vez
```

### 4. Tests
```bash
cd backend-express && npm test     # Suite de integración (schema test aislado)
npm run lint                        # Typecheck del backend
```

### 5. Despliegue (Render)
Sube el repo y crea los servicios desde `render.yaml`, o conecta el repo en Render Dashboard.
Telnyx enviará los webhooks a `https://<tu-backend>.onrender.com/webhooks/telnyx/voice`.

---

## ⚙️ Variables de entorno (`.env`)

```env
# Base de datos + Redis
DATABASE_URL=postgresql://user:pass@host:5432/vozia
REDIS_URL=redis://localhost:6379

# Gemini
GEMINI_API_KEY=

# Telnyx (telefonía)
TELNYX_API_KEY=
TELNYX_PUBLIC_KEY=
TELNYX_ORG_ID=
TELNYX_WEBHOOK_SECRET=
TELNYX_WEBHOOK_URL=https://api.tu-dominio.com/webhooks/telnyx/voice
TELNYX_CONNECTION_ID=

# Whop (pagos)
WHOP_API_KEY=
WHOP_WEBHOOK_SECRET=

# Cloudflare R2 (grabaciones)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=grabaciones

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
ENCRYPTION_KEY=
INTERNAL_API_KEY=

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Dominios
DOMINIO_FRONTEND=http://localhost:3000
DOMINIO_EXPRESS=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Runtime
NODE_ENV=development
LOG_LEVEL=info
```

---

## 🔌 Endpoints principales

### Backend Express (3001)
| Ruta | Descripción |
|------|-------------|
| `GET /health` | Health check |
| `POST /webhooks/telnyx/voice` | Webhook de llamada entrante (TeXML) |
| `POST /webhooks/telnyx/call-control` | Eventos de Call Control |
| `POST /webhooks/whop` | Webhook de pagos |
| `GET /admin/*` | Panel admin (métricas, clientes, logs, cashflow, audit) |
| `GET /sse/events?user_id=&token=` | Eventos en tiempo real (SSE) |
| `WS /stream/telnyx` | Streaming de audio Telnyx ↔ Gemini |
| `WS /stream/sim` | Simulador de entrevista de voz |

### Frontend (3000)
`/api/auth/*`, `/api/admin/*`, `/api/simulator`, `/api/wallet`, `/api/appointments`, `/api/whop/*`, `/api/session`, `/api/business-settings`.

---

## 🧪 Calidad

- **34 tests de integración** (Vitest + Supertest) contra un schema `test` aislado:
  - Billing (acreditación, débito por minuto/segundo, reversa, idempotencia).
  - Webhooks Telnyx (firma Ed25519 real, TeXML, rechazos, débito en hangup).
  - Gemini (transcripción SSE, function calling, persistencia de transcripts).
  - VAD (detección de silencio/voz, carga del módulo WASM).
- Typecheck del backend limpio (2 errores TS preexistentes en archivos de servicios).

---

## 📄 Licencia

Propietario. Uso interno del proyecto VozIA.
