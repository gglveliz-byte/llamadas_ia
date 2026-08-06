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
  configureNumberWebhooks,
  getAvailableNumberByPhone,
  getOwnedNumberByPhone
} from "../services/telnyx.service";
import { enviarEmail, emailTemplates } from "../services/email.service";
import { encrypt } from "../utils/encryption";
import { saldoPermiteCobro, debitarConcepto, reversarConcepto } from "../services/billing.service";
import { procesarRentasUsuario } from "../services/rentas.service";

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
 * Precios de venta de números: costo real del proveedor × (1 + margen%),
 * o defaults de admin cuando el proveedor no reporta costo.
 * El margen (margen_numero_pct) es configurable en el panel admin.
 */
async function preciosNumero(): Promise<{ defAlta: number; defMes: number; factor: number }> {
  const [cfgAlta, cfgMes, cfgMargen] = await Promise.all([
    db.adminConfig.findUnique({ where: { clave: "precio_alta_numero" } }),
    db.adminConfig.findUnique({ where: { clave: "precio_mes_numero" } }),
    db.adminConfig.findUnique({ where: { clave: "margen_numero_pct" } }),
  ]);
  const defAlta = parseFloat(cfgAlta?.valor ?? "1") || 1;
  const defMes = parseFloat(cfgMes?.valor ?? "1") || 1;
  const margen = parseFloat(cfgMargen?.valor ?? "50");
  const factor = 1 + (isFinite(margen) ? margen : 50) / 100;
  return { defAlta, defMes, factor };
}

function precioVenta(base: number, def: number, factor: number): number {
  const b = isFinite(base) && base > 0 ? base : def;
  return Math.round(b * factor * 100) / 100;
}

/**
 * POST /internal/telnyx/purchase-number
 * Compra un número Telnyx específico para un usuario.
 * Body: { userId, phoneNumber }
 */
const purchaseNumberSchema = z.object({
  userId: z.string().uuid(),
  phoneNumber: z.string().min(10).max(20),
  // coerce: Telnyx/frontend pueden mandar los costos como string ("1.00000")
  upfrontCost: z.coerce.number().min(0).max(1000).optional(),
  monthlyCost: z.coerce.number().min(0).max(1000).optional(),
  currency: z.string().max(10).optional(),
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

    // Guardia de duplicado: el usuario ya tiene este número
    const numeroExistente = await db.phoneNumber.findUnique({ where: { phoneNumber } });
    if (numeroExistente) {
      return res.status(409).json({ error: "Este número ya está en tu cuenta." });
    }

    // Precio de venta = costo real × (1 + margen%). Telnyx no tiene filtro por
    // número exacto (lo ignora): solo confiamos en el costo si la consulta
    // devuelve ESE número. Respaldo: el costo que el frontend vio en nuestra
    // búsqueda, con piso mínimo = default admin × margen (evita vender bajo costo).
    const infoTelnyx = await getAvailableNumberByPhone(phoneNumber);
    const costoReal =
      infoTelnyx && infoTelnyx.phone_number === phoneNumber
        ? infoTelnyx.cost_information
        : undefined;
    const { defAlta, defMes, factor } = await preciosNumero();
    const pisoAlta = Math.round(defAlta * factor * 100) / 100;
    const pisoMes = Math.round(defMes * factor * 100) / 100;
    // El frontend envía el precio de venta que mostró (YA con margen, calculado
    // por nuestra búsqueda): se respeta tal cual, con piso mínimo. Solo se
    // recalcula desde el costo crudo si Telnyx devolvió ESE número exacto
    // (evita aplicar el margen dos veces).
    const ventaAlta = parseFloat(String(parsed.data.upfrontCost ?? ""));
    const ventaMes = parseFloat(String(parsed.data.monthlyCost ?? ""));
    const upfront = costoReal
      ? precioVenta(parseFloat(String(costoReal.upfront_cost)), defAlta, factor)
      : Math.max(isFinite(ventaAlta) && ventaAlta > 0 ? ventaAlta : pisoAlta, pisoAlta);
    const monthly = costoReal
      ? precioVenta(parseFloat(String(costoReal.monthly_cost)), defMes, factor)
      : Math.max(isFinite(ventaMes) && ventaMes > 0 ? ventaMes : pisoMes, pisoMes);
    const currency = costoReal?.currency ?? parsed.data.currency ?? "USD";

    // Verificar saldo antes de cobrar el alta
    if (!(await saldoPermiteCobro(userId, upfront))) {
      return res.status(402).json({
        error: `Saldo insuficiente para el pago de alta ($${upfront.toFixed(2)} ${currency}). Recarga saldo e inténtalo de nuevo.`,
      });
    }

    // Cobrar alta primero (idempotente por número+día); se reversa si Telnyx falla.
    // Tras una reversa el re-cobro usa ref nuevo: la BD tiene @@unique([tipo, callSid])
    // y reutilizar el mismo ref chocaría con el índice.
    const baseRef = `alta_num_${phoneNumber}_${new Date().toISOString().slice(0, 10)}`;
    const reversasPrevias = await db.walletTransaction.count({
      where: { tipo: "ajuste_admin", callSid: { startsWith: baseRef } },
    });
    const refAlta = reversasPrevias > 0 ? `${baseRef}_r${reversasPrevias}` : baseRef;
    await debitarConcepto(userId, upfront, `Alta número ${phoneNumber}`, refAlta);

    try {
      // Comprar número específico: Si es flujo root, childAccountId será null/undefined.
      let comprado: Awaited<ReturnType<typeof purchasePhoneNumber>>;
      try {
        comprado = await purchasePhoneNumber(
          phoneNumber,
          isRootFlow ? undefined : (childAccountId || undefined)
        );
      } catch (buyError) {
        // Reintento tras un fallo previo: el número ya es nuestro → reutilizarlo
        // y completar asignación/webhooks en vez de volver a comprar.
        const propio = await getOwnedNumberByPhone(phoneNumber);
        if (propio) {
          logger.warn({ phoneNumber }, "Número ya comprado previamente; completando configuración");
          comprado = propio;
        } else if (/10005|404/.test(String((buyError as Error).message))) {
          // El inventario de Telnyx rota en tiempo real: el número desapareció
          throw new Error(
            `El número ${phoneNumber} ya no está disponible en el inventario del proveedor. Vuelve a buscar y elige otro.`
          );
        } else {
          throw buyError;
        }
      }

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

      // Guardar en BD con costos para el cobro mensual
      await db.phoneNumber.create({
        data: {
          userId: parsed.data.userId,
          phoneNumber: comprado.phone_number,
          countryCode: comprado.country_code,
          telnyxPhoneSid: comprado.id,
          isActive: true,
          upfrontCost: upfront,
          monthlyCost: monthly,
          currency,
          lastMonthlyChargeAt: new Date(),
        },
      });

      res.json({
        phoneNumber: comprado.phone_number,
        telnyxId: comprado.id,
        upfrontCost: upfront,
        monthlyCost: monthly,
        currency,
      });
    } catch (e) {
      await reversarConcepto(userId, upfront, `Reversa alta número ${phoneNumber}`, refAlta);
      logger.error({ error: (e as Error).message }, "Error comprando número Telnyx");
      res.status(500).json({ error: "Error comprando número: " + (e as Error).message });
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error en purchase-number");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /internal/rentas/procesar-usuario
 * Procesa rentas vencidas del usuario (cobro, suspensión, liberación,
 * reactivación). Lo llama Next tras cada recarga Whop para reactivar
 * números suspendidos de inmediato.
 */
const procesarRentasSchema = z.object({ userId: z.string().uuid() });

internalRouter.post("/rentas/procesar-usuario", async (req, res) => {
  const parsed = procesarRentasSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }
  try {
    await procesarRentasUsuario(parsed.data.userId);
    res.json({ ok: true });
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error procesando rentas del usuario");
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
  limit: z.coerce.number().min(1).max(50).optional(),
  page: z.coerce.number().min(1).optional(),
});

internalRouter.get("/telnyx/available-numbers", async (req, res) => {
  const parsed = searchNumbersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos" });
  }
  const { countryCode, areaCode, limit, page } = parsed.data;

  try {
    const { numbers, total } = await searchAvailableNumbers(
      countryCode,
      areaCode,
      limit ?? 20,
      page ?? 1
    );

    // Precio de venta visible: costo real × (1 + margen%); si el proveedor no
    // reporta costo (pasa en varios países), base = defaults de admin.
    const { defAlta, defMes, factor } = await preciosNumero();
    // El proveedor reporta los costos como strings ("1.00000"): normalizar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (numbers as any[]).map((n) => {
      const up = parseFloat(n.cost_information?.upfront_cost);
      const mo = parseFloat(n.cost_information?.monthly_cost);
      return {
        ...n,
        cost_information: {
          upfront_cost: precioVenta(up, defAlta, factor),
          monthly_cost: precioVenta(mo, defMes, factor),
          currency: n.cost_information?.currency ?? "USD",
        },
      };
    });

    res.json({ numbers: enriched, total, page: page ?? 1 });
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
