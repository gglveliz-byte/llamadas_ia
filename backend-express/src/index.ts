/**
 * VozIA - Backend Express
 * Cumple spec sección 7 (flujo de voz), 12 (SSE), 13 (monitoreo), 14 (seguridad).
 *
 * Servicios:
 * - HTTP: webhooks Telnyx/Whop, internal API, admin API, SSE
 * - WebSocket: Telnyx <Dial><Stream> bidireccional
 * - Monitoreo: cada 10s
 *
 * Puerto: 3001 (configurado en Caddyfile como mini-service)
 */
import "./config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { WebSocketServer } from "ws";
import { telnyxRouter } from "./routes/webhooks.telnyx";
import { whopRouter } from "./routes/webhooks.whop";
import { internalRouter } from "./routes/internal.api";
import { adminRouter } from "./routes/admin.api";
import { registrarTelnyxStreamHandler } from "./websockets/telnyxStream.handler";
import { registrarSimuladorHandler } from "./websockets/simulador.handler";
import { parse } from "url";
import { configurarSSEHeaders, registrarClienteSSE, removerClienteSSE, emitirSSE } from "./sse/events.emitter";
import { iniciarMonitoreo } from "./services/monitoring.service";
import { rateLimiter } from "./middleware/rateLimiter";
import { logger } from "./utils/logger";
import { verificarFfmpegDisponible } from "./utils/audioTranscoder";
import { verificarSMTP } from "./services/email.service";
import { verificarVad } from "./services/vad.service";

const PORT = 3001;

const app = express();

// Security headers
const connectSrc = ["'self'"];
if (process.env.DOMINIO_FRONTEND) connectSrc.push(process.env.DOMINIO_FRONTEND);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc,
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));

// Middlewares
app.use(cors({
  origin: process.env.DOMINIO_FRONTEND,
  credentials: true,
}));
app.use(express.raw({ type: "application/xml" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(async (req, res, next) => {
  try {
    await rateLimiter(req, res, next);
  } catch (e) {
    next(e);
  }
});

// Logger de requests
app.use((req, _res, next) => {
  logger.debug({ method: req.method, path: req.path }, "Request");
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "backend-express",
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Rutas
app.use("/webhooks/telnyx", telnyxRouter);
app.use("/webhooks/whop", whopRouter);
app.use("/internal", internalRouter);
app.use("/admin", adminRouter);

// SSE endpoint
// Cumple spec 12.1
app.get("/sse/events", (req, res) => {
  const userId = req.query.user_id as string;
  const token = req.query.token as string;

  if (!userId) {
    res.status(400).json({ error: "user_id requerido" });
    return;
  }

  // En prod: verificar JWT token aquí
  // if (!token || !verificarJwt(token)) { res.status(401); return; }

  configurarSSEHeaders(res);
  const cliente = registrarClienteSSE(userId, res);

  // Heartbeat cada 30s para mantener conexión viva
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      removerClienteSSE(cliente);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removerClienteSSE(cliente);
  });

  // Enviar evento de bienvenida
  setTimeout(() => {
    emitirSSE(userId, "conexion_establecida", {
      mensaje: "Conectado al backend Express VozIA",
      timestamp: new Date().toISOString(),
    });
  }, 100);
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint no encontrado", path: req.path });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, "Error no manejado");
  res.status(500).json({ error: "Error interno del servidor" });
});

// Crear servidor HTTP + WebSocket
const server = http.createServer(app);

const wssTelnyx = new WebSocketServer({ noServer: true });
registrarTelnyxStreamHandler(wssTelnyx);

const wssSim = new WebSocketServer({ noServer: true });
registrarSimuladorHandler(wssSim);

server.on("upgrade", (request, socket, head) => {
  const { pathname } = parse(request.url || "", true);

  if (pathname === "/stream/telnyx") {
    wssTelnyx.handleUpgrade(request, socket, head, (ws) => {
      wssTelnyx.emit("connection", ws, request);
    });
  } else if (pathname === "/stream/sim") {
    wssSim.handleUpgrade(request, socket, head, (ws) => {
      wssSim.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      dominio: process.env.DOMINIO_EXPRESS || `http://localhost:${PORT}`,
    },
    `🚀 VozIA Backend Express iniciado en puerto ${PORT}`
  );
  logger.info("📡 WebSocket Telnyx Stream: ws://localhost:" + PORT + "/stream/telnyx");
  logger.info("📡 SSE endpoint: http://localhost:" + PORT + "/sse/events?user_id=...&token=...");
  logger.info("📡 Webhook Telnyx: http://localhost:" + PORT + "/webhooks/telnyx/voice");
  logger.info("📡 Webhook Whop: http://localhost:" + PORT + "/webhooks/whop");

  // Iniciar monitoreo
  iniciarMonitoreo();

  // Verificar dependencias de runtime
  const ffmpegCheck = verificarFfmpegDisponible();
  if (ffmpegCheck.disponible) {
    logger.info({ ffmpegPath: ffmpegCheck.path }, "✅ ffmpeg disponible para transcodificación");
  } else {
    logger.error(
      { ffmpegPath: ffmpegCheck.path },
      "❌ ffmpeg no disponible - transcodificación y grabaciones fallarán"
    );
  }
  verificarSMTP().catch((e) => {
    logger.error({ error: (e as Error).message }, "Error verificando SMTP");
  });
  verificarVad();

  // Verificar configuración
  if (!process.env.GEMINI_API_KEY) {
    logger.warn("⚠️  GEMINI_API_KEY no configurada - sesiones de voz serán simuladas");
  }
  if (!process.env.TELNYX_API_KEY) {
    logger.warn("⚠️  TELNYX_API_KEY no configurada - telefonía Telnyx no funcionará");
  }
  if (!process.env.TELNYX_PUBLIC_KEY) {
    logger.warn("⚠️  TELNYX_PUBLIC_KEY no configurada - webhooks Telnyx no validarán firma");
  }
  if (!process.env.WHOP_WEBHOOK_SECRET) {
    logger.warn("⚠️  WHOP_WEBHOOK_SECRET no configurado - webhooks de Whop no validarán firma");
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM recibido - cerrando servidor...");
  server.close(() => {
    logger.info("Servidor cerrado");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT recibido - cerrando servidor...");
  server.close(() => {
    logger.info("Servidor cerrado");
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  logger.fatal({ error: err.message, stack: err.stack }, "UncaughtException");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "UnhandledRejection");
});
