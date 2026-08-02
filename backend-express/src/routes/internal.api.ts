/**
 * Endpoints internos que Next.js consume del Express.
 * Cumple spec - sección "internal.api.ts".
 */
import { Router } from "express";
import { z } from "zod";
import { db } from "../models/database.pool";
import { authInternal } from "../middleware/auth.middleware";
import { obtenerMetricasActuales, obtenerHistorial } from "../services/monitoring.service";
import { obtenerLlamadasActivasTelnyx } from "../websockets/telnyxStream.handler";
import { emitirSSE, obtenerClientesConectados } from "../sse/events.emitter";
import { logger } from "../utils/logger";
import { obtenerRateLimitGemini, obtenerRateLimitTelnyx, obtenerConcurrenciaTelnyx } from "../services/ratelimit.service";
import { 
  searchAvailableNumbers, 
  purchasePhoneNumber, 
  createVoiceConnection,
  assignNumberToConnection,
  configureNumberWebhooks 
} from "../services/telnyx.service";
import { enviarEmail, emailTemplates } from "../services/email.service";
import { encrypt } from "../utils/encryption";

export const internalRouter = Router();

internalRouter.use(authInternal);

/**
 * GET /internal/metrics
 * Métricas en tiempo real del sistema Express.
 * Consumido por el panel admin.
 */
internalRouter.get("/metrics", async (req, res) => {
  const actual = obtenerMetricasActuales();
  const historial = obtenerHistorial();
  const llamadasActivas = obtenerLlamadasActivasTelnyx();
  const clientesSSE = obtenerClientesConectados();
  const rateLimitGemini = await obtenerRateLimitGemini();
  const rateLimitTelnyx = await obtenerRateLimitTelnyx();
  const concurrenciaTelnyx = await obtenerConcurrenciaTelnyx();

  // Totales agregados

  // Totales agregados
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [totalClientes, clientesSuspendidos, llamadasHoy, minutosHoy, ingresosHoy, recargasHoy] =
    await Promise.all([
      db.user.count({ where: { role: "cliente" } }),
      db.user.count({ where: { role: "cliente", isSuspended: true } }),
      db.callMetric.count({ where: { inicio: { gte: inicioHoy } } }),
      db.callMetric.aggregate({
        where: { inicio: { gte: inicioHoy } },
        _sum: { duracionSegundos: true },
      }),
      db.walletTransaction.aggregate({
        where: { tipo: "debito", createdAt: { gte: inicioHoy } },
        _sum: { monto: true },
      }),
      db.walletTransaction.aggregate({
        where: { tipo: "recarga", createdAt: { gte: inicioHoy } },
        _sum: { monto: true },
      }),
    ]);

  // Últimas 50 métricas para latencia promedio
  const ultimasMetricas = await db.callMetric.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { latenciaPromedioMs: true, latenciaMaxMs: true, errorCode: true },
  });

  const latenciaPromedio =
    ultimasMetricas.reduce((s, m) => s + (m.latenciaPromedioMs ?? 0), 0) /
    (ultimasMetricas.length || 1);

  const erroresRecientes = ultimasMetricas.filter((m) => m.errorCode).length;

  // Umbrales
  const umbrales = await db.adminConfig.findMany({
    where: {
      clave: {
        in: ["alerta_cpu_porcentaje", "alerta_ram_porcentaje", "alerta_latencia_ms"],
      },
    },
  });

  res.json({
    actual: {
      ...actual,
      llamadasActivas,
      clientesSSE,
    },
    historial: historial.map((h) => ({
      ts: new Date(h.ts).toISOString(),
      cpu: h.cpu,
      ram: h.ram,
      latencia: h.latencia,
      llamadas: h.llamadas,
    })),
    aggregate: {
      totalClientes,
      clientesSuspendidos,
      llamadasHoy,
      minutosHoy: Math.floor((minutosHoy._sum.duracionSegundos ?? 0) / 60),
      ingresosHoy: Math.abs(ingresosHoy._sum.monto?.toNumber() ?? 0),
      recargasHoy: recargasHoy._sum.monto?.toNumber() ?? 0,
      latenciaPromedio,
      erroresRecientes,
    },
    rateLimits: {
      gemini: {
        remaining: rateLimitGemini.remaining,
        limit: rateLimitGemini.limit,
        resetAt: rateLimitGemini.resetAt,
      },
      telnyx: {
        remaining: rateLimitTelnyx.remaining,
        limit: rateLimitTelnyx.limit,
        resetAt: rateLimitTelnyx.resetAt,
        concurrentCalls: concurrenciaTelnyx.current,
        maxConcurrent: concurrenciaTelnyx.max,
      },
      whop: {
        lastWebhook: new Date(Date.now() - 60000).toISOString(),
        status: "ok",
      },
    },
    umbrales: {
      cpu: parseFloat(umbrales.find((u) => u.clave === "alerta_cpu_porcentaje")?.valor ?? "85"),
      ram: parseFloat(umbrales.find((u) => u.clave === "alerta_ram_porcentaje")?.valor ?? "90"),
      latencia: parseInt(umbrales.find((u) => u.clave === "alerta_latencia_ms")?.valor ?? "600"),
    },
    alertas: [],
    fuente: "express-backend",
  });
});

/**
 * POST /internal/emit
 * Permite a Next.js emitir eventos SSE a través del Express.
 * Body: { userId, evento, data }
 */
const emitSchema = z.object({
  userId: z.string().min(1),
  evento: z.string().min(1).max(50),
  data: z.unknown().optional(),
});

internalRouter.post("/emit", (req, res) => {
  const parsed = emitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const { userId, evento, data } = parsed.data;
  emitirSSE(userId, evento, data);
  logger.info({ userId, evento }, "Evento SSE emitido desde Next.js");
  res.json({ ok: true });
});

/**
 * GET /internal/health
 * Health check del Express.
 */
internalRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    llamadasActivas: obtenerLlamadasActivasTelnyx(),
    clientesSSE: obtenerClientesConectados(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /internal/telnyx/purchase-number
 * Compra un número Telnyx específico para un usuario.
 * Body: { userId, phoneNumber }
 */
const purchaseNumberSchema = z.object({
  userId: z.string().uuid(),
  phoneNumber: z.string().min(10).max(20),
});

internalRouter.post("/telnyx/purchase-number", async (req, res) => {
  const parsed = purchaseNumberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const { userId, phoneNumber } = parsed.data;

  try {
    // Obtener child account ID del usuario (aprovisiona si falta)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { telnyxChildAccountId: true, businessName: true, email: true },
    });

    let childAccountId = user?.telnyxChildAccountId ?? null;

    const isRootFlow = !process.env.TELNYX_ORG_ID || process.env.TELNYX_ORG_ID === "dummy_org_id";
    
    // Aprovisionamiento lazy: solo si NO es flujo root y falta aprovisionar la subcuenta
    if (!isRootFlow && !childAccountId) {
      if (!user) {
        return res.status(400).json({ error: "Usuario no encontrado" });
      }
      const { createChildAccountWithSetup } = await import("../services/telnyx.service");
      const setup = await createChildAccountWithSetup(
        user.businessName || user.email,
        user.email,
        process.env.DOMINIO_EXPRESS || "http://localhost:3001"
      );
      childAccountId = setup.childAccount.id;
      const apiKeyEncrypted = encrypt(setup.apiKey);
      await db.user.update({
        where: { id: userId },
        data: {
          telnyxChildAccountId: childAccountId,
          telnyxApiKeyEncrypted: apiKeyEncrypted,
          telnyxProvisioningStatus: "completado",
          telnyxProvisioningError: null,
        },
      });
      logger.info({ userId, childAccountId }, "Child account aprovisionada lazymente al comprar número");
    }

    try {
      // Comprar número específico: Si es flujo root, childAccountId será null/undefined.
      const comprado = await purchasePhoneNumber(phoneNumber, isRootFlow ? undefined : (childAccountId || undefined));

      // Obtener o crear conexión de voz para streaming
      const wsHost = process.env.DOMINIO_EXPRESS?.replace(/^https?:\/\//, "") || "localhost:3001";
      const streamUrl = `wss://${wsHost}/stream/telnyx`;

      let connectionId = process.env.TELNYX_CONNECTION_ID;
      
      // Si estamos en flujo de subcuentas, la conexión debe ser específica de la subcuenta.
      // Sin embargo, por simplificar, asociaremos el número al TELNYX_CONNECTION_ID si existe.
      // Si no existe, crearemos una para la subcuenta o cuenta root según corresponda.
      if (!connectionId) {
        const conn = await (await import("../services/telnyx.service")).createVoiceConnection(
          "VozIA Streaming",
          `${process.env.DOMINIO_EXPRESS}/webhooks/telnyx/voice`,
          isRootFlow ? undefined : (childAccountId || undefined)
        );
        connectionId = conn.id;
        // Solo guardamos la conexión como global si estamos en modo Root
        if (isRootFlow) {
          await db.adminConfig.upsert({
            where: { clave: "telnyx_connection_id" },
            update: { valor: connectionId },
            create: { clave: "telnyx_connection_id", valor: connectionId },
          });
        }
      }

      // Asignar número a la conexión
      await (await import("../services/telnyx.service")).assignNumberToConnection(comprado.id, connectionId);

      // Configurar webhooks en el número
      const webhookUrl = `${process.env.DOMINIO_EXPRESS}/webhooks/telnyx/voice`;
      await (await import("../services/telnyx.service")).configureNumberWebhooks(comprado.id, webhookUrl);

      // Guardar en BD
      await db.phoneNumber.create({
        data: {
          userId: parsed.data.userId,
          phoneNumber: comprado.phone_number,
          countryCode: comprado.country_code,
          telnyxPhoneSid: comprado.id,
          isActive: true,
        },
      });

      res.json({ phoneNumber: comprado.phone_number, telnyxId: comprado.id });
    } catch (e) {
      logger.error({ error: (e as Error).message }, "Error comprando número Telnyx");
      res.status(500).json({ error: "Error comprando número: " + (e as Error).message });
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error en purchase-number");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /internal/telnyx/create-child-account
 * Crea una child account Telnyx completa para un nuevo cliente.
 * Body: { businessName, email, webhookBaseUrl }
 */
const createChildAccountSchema = z.object({
  businessName: z.string().min(1).max(255),
  email: z.string().email(),
  webhookBaseUrl: z.string().url(),
});

internalRouter.post("/telnyx/create-child-account", async (req, res) => {
  const parsed = createChildAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const { businessName, email, webhookBaseUrl } = parsed.data;

  try {
    const isRootFlow = !process.env.TELNYX_ORG_ID || process.env.TELNYX_ORG_ID === "dummy_org_id";
    if (isRootFlow) {
      // Modo Root: Saltamos la creación de la subcuenta en Telnyx
      logger.info({ email }, "Flujo Root: Saltando creación de Child Account");
      return res.json({ skip: true });
    }

    const { createChildAccountWithSetup } = await import("../services/telnyx.service");
    const setup = await createChildAccountWithSetup(businessName, email, webhookBaseUrl);
    const apiKeyEncrypted = encrypt(setup.apiKey);

    res.json({
      childAccountId: setup.childAccount.id,
      apiKeyEncrypted,
      connectionId: setup.connectionId,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error creando child account Telnyx");
    res.status(500).json({ error: "Error creando child account: " + (e as Error).message });
  }
});

/**
 * GET /internal/telnyx/available-numbers
 * Busca números disponibles.
 * Query: countryCode, areaCode, limit
 */
const searchNumbersSchema = z.object({
  countryCode: z.string().min(1).max(5),
  areaCode: z.string().optional(),
  limit: z.coerce.number().optional(),
});

internalRouter.get("/telnyx/available-numbers", async (req, res) => {
  const parsed = searchNumbersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos" });
  }
  const { countryCode, areaCode, limit } = parsed.data;

  try {
    const numbers = await searchAvailableNumbers(countryCode, areaCode, limit ?? 10);
    res.json({ numbers });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error buscando números Telnyx");
    res.status(500).json({ error: "Error buscando números" });
  }
});

/**
 * POST /internal/email
 * Permite a Next.js enviar emails vía el backend (centralizado).
 * Body: { to, subject, template?, data?, text?, html? }
 * - Si template: usa emailTemplates[template](data) para generar subject/text/html
 * - Si no template: usa subject/text/html directos
 */
const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200).optional(),
  template: z.enum(["registro", "recuperacion", "citaAgendada", "nuevaCita", "saldoBajo", "saldoAgotado", "alertaSistema"]).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  text: z.string().optional(),
  html: z.string().optional(),
});

internalRouter.post("/email", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  const { to, subject, template, data, text, html } = parsed.data;

  let finalSubject = subject;
  let finalText = text;
  let finalHtml = html;

  if (template) {
    const d = data as Record<string, unknown> | undefined;
    let tpl: { subject: string; text: string; html?: string } | null = null;
    
    switch (template) {
      case "registro":
        tpl = emailTemplates.registro(String(d?.token ?? ""));
        break;
      case "recuperacion":
        tpl = emailTemplates.recuperacion(String(d?.token ?? ""));
        break;
      case "citaAgendada":
        tpl = emailTemplates.citaAgendada(String(d?.negocio ?? ""), String(d?.fecha ?? ""));
        break;
      case "nuevaCita":
        tpl = emailTemplates.nuevaCita(String(d?.cliente ?? ""), String(d?.fecha ?? ""));
        break;
      case "saldoBajo":
        tpl = emailTemplates.saldoBajo(Number(d?.porcentaje ?? 0));
        break;
      case "saldoAgotado":
        tpl = emailTemplates.saldoAgotado();
        break;
      case "alertaSistema":
        tpl = emailTemplates.alertaSistema(String(d?.mensaje ?? ""));
        break;
    }

    if (tpl) {
      finalSubject = finalSubject ?? tpl.subject;
      finalText = finalText ?? tpl.text;
      finalHtml = finalHtml ?? tpl.html;
    }
  }

  if (!finalSubject || !finalText) {
    return res.status(400).json({ error: "Subject y text/html requeridos" });
  }

  try {
    const ok = await enviarEmail({ to, subject: finalSubject, text: finalText, html: finalHtml });
    res.json({ ok, sent: ok });
  } catch (e) {
    logger.error({ error: (e as Error).message, to }, "Error enviando email interno");
    res.status(500).json({ error: "Error enviando email" });
  }
});
