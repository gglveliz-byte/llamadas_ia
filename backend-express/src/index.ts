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
import { publicRouter } from "./routes/public.api";
import { affiliateRouter } from "./routes/affiliate.api";
import { refundRouter } from "./routes/refund.api";
import { registrarTelnyxStreamHandler } from "./websockets/telnyxStream.handler";
import { registrarSimuladorHandler } from "./websockets/simulador.handler";
import { configurarSSEHeaders, registrarClienteSSE, removerClienteSSE, emitirSSE } from "./sse/events.emitter";
import { iniciarMonitoreo } from "./services/monitoring.service";
import { procesarRentasMensuales } from "./services/rentas.service";
import { rateLimiter } from "./middleware/rateLimiter";
import { logger } from "./utils/logger";
import { getAudioTranscoder } from "./utils/audioTranscoder";
import { verificarSMTP } from "./services/email.service";
import { verificarVad, prewarmSileroVAD } from "./services/vad.service";

const PORT = parseInt(process.env.PORT || "3001", 10);

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
const orígenesPermitidos = (() => {
  const base = process.env.DOMINIO_FRONTEND;
  const orígenes = base ? [base] : [];
  if (process.env.NODE_ENV !== "production") {
    orígenes.push(
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "https://voice-ia-8y6x.onrender.com" // Permitir frontend desplegado en Render
    );
  }
  return orígenes;
})();

app.use(cors({
  origin(origin, callback) {
    if (!origin || orígenesPermitidos.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Origen no permitido por CORS"));
    }
  },
  credentials: true,
}));
app.use(express.raw({ type: "application/xml" }));
app.use(express.json({ 
  limit: "10mb",
  verify: (req, res, buf) => {
    (req as any).rawBody = buf.toString();
  }
}));
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
app.use("/admin/refunds", refundRouter);
app.use("/api/public", cors({ origin: "*" }), publicRouter);
app.use("/api/affiliate", cors({ origin: "*" }), affiliateRouter);

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
  require("fs").appendFileSync("../express-global-error.log", "\n" + Date.now() + " " + err.message + " " + err.stack);
  res.status(500).json({ error: "Error interno del servidor", details: err.message });
});

// Crear servidor HTTP + WebSocket
const server = http.createServer(app);

const wssTelnyx = new WebSocketServer({ noServer: true });
registrarTelnyxStreamHandler(wssTelnyx);

const wssSim = new WebSocketServer({ noServer: true });
registrarSimuladorHandler(wssSim);

server.on("upgrade", (request, socket, head) => {
  const baseURL = "http://" + (request.headers.host || "localhost");
  const parsedUrl = new URL(request.url || "", baseURL);
  const pathname = parsedUrl.pathname;

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

  // Rentas mensuales de números: al arrancar y cada 6 horas
  procesarRentasMensuales().catch((e) =>
    logger.error({ error: (e as Error).message }, "Error procesando rentas mensuales")
  );
  setInterval(() => {
    procesarRentasMensuales().catch((e) =>
      logger.error({ error: (e as Error).message }, "Error procesando rentas mensuales")
    );
  }, 6 * 60 * 60 * 1000);

  // Verificar dependencias de runtime
  verificarSMTP().catch((e) => {
    logger.error({ error: (e as Error).message }, "Error verificando SMTP");
  });
  verificarVad();
  // Pre-cargar la sesión ONNX de Silero VAD al boot (fuera del path de llamada)
  prewarmSileroVAD().catch((e) =>
    logger.error({ error: (e as Error).message }, "Error precargando Silero VAD al boot")
  );

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
