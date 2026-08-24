import { Router } from "express";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import { z } from "zod";
import { Whop } from "@whop/sdk";
import { getS3 } from "../services/audio.service";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const publicRouter = Router();

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || "dummy_api_key",
});

/**
 * GET /api/public/business/:slug
 * Devuelve la configuración pública del negocio para la landing
 */
publicRouter.get("/business/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    
    const settings = await db.businessSettings.findFirst({
      where: {
        OR: [
          { registrationSlug: slug },
          ...(isUuid ? [{ userId: slug }] : [])
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            businessName: true,
            phoneNumbers: {
              where: { isActive: true },
              select: { phoneNumber: true }
            }
          }
        }
      }
    });

    if (!settings) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    res.json({
      tenantId: settings.user.id,
      nombreEmpresa: settings.user.businessName,
      precioPorMinuto: settings.precioPorMinuto,
      metodosPago: settings.metodosPago,
      depositoMinimo: settings.depositoMinimo,
      landingLogo: settings.landingLogo,
      landingDescripcion: settings.landingDescripcion,
      landingColorPrimario: settings.landingColorPrimario,
      landingColorFondo: settings.landingColorFondo,
      landingImagenFondo: settings.landingImagenFondo,
      aiRegion: settings.aiRegion,
      businessPhones: settings.user.phoneNumbers.map(p => p.phoneNumber),
    });
  } catch (error) {
    logger.error(error, "Error en GET /business/:slug");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /api/public/register
 * Registra o recupera un EndCustomer
 */
publicRouter.post("/register", async (req, res) => {
  try {
    const schema = z.object({
      tenantId: z.string().uuid(),
      nombre: z.string().min(1),
      telefono: z.string().min(1),
      email: z.string().email().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", issues: parsed.error.issues });
    }

    const { tenantId, nombre, telefono, email } = parsed.data;

    let endCustomer = await db.endCustomer.findUnique({
      where: { tenantId_telefono: { tenantId, telefono } }
    });

    if (!endCustomer) {
      endCustomer = await db.endCustomer.create({
        data: { tenantId, nombre, telefono, email }
      });
    } else {
      // Actualizar datos si cambiaron
      endCustomer = await db.endCustomer.update({
        where: { id: endCustomer.id },
        data: { nombre, email: email || endCustomer.email }
      });
    }

    res.json({
      id: endCustomer.id,
      saldoMinutos: endCustomer.saldoMinutos,
      saldoDinero: endCustomer.saldoDinero
    });
  } catch (error) {
    logger.error(error, "Error en POST /register");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /api/public/checkout
 * Genera el link de pago en Whop
 */
publicRouter.post("/checkout", async (req, res) => {
  try {
    const schema = z.object({
      tenantId: z.string().uuid(),
      endCustomerId: z.string().uuid().optional(),
      tipo: z.enum(["prepago", "retencion", "instalacion"]),
      minutos: z.number().optional(), // Si es prepago
      monto: z.number().optional(), // Si es retencion, o se calcula
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", issues: parsed.error.issues });
    }

    const { tenantId, endCustomerId, tipo, minutos, monto } = parsed.data;

    const settings = await db.businessSettings.findUnique({ where: { userId: tenantId } });
    const user = await db.user.findUnique({ where: { id: tenantId } });
    if (!settings || !user) return res.status(404).json({ error: "Negocio no encontrado" });

    let finalAmount = 0;
    if (tipo === "instalacion") {
      finalAmount = user.installationAmount ? user.installationAmount.toNumber() : 0;
      if (finalAmount <= 0) return res.status(400).json({ error: "No hay cuota de instalación pendiente" });
    } else if (tipo === "prepago") {
      if (!minutos) return res.status(400).json({ error: "Debe especificar los minutos para prepago" });
      finalAmount = minutos * settings.precioPorMinuto.toNumber();
    } else {
      finalAmount = monto || settings.depositoMinimo?.toNumber() || 10;
    }

    // Aquí generamos un link de pago dinámico con Whop API.
    const whopCompanyId = process.env.WHOP_COMPANY_ID;
    if (!whopCompanyId) {
      return res.status(500).json({ error: "WHOP_COMPANY_ID no configurado" });
    }

    const checkout = await whopsdk.checkoutConfigurations.create({
      account_id: whopCompanyId,
      plan: {
        title: tipo === "instalacion" ? "Cuota de Configuración Inicial" : (tipo === "prepago" ? `Recarga de minutos` : `Depósito Inicial`),
        description: tipo === "instalacion" 
          ? "Pago único por instalación y configuración de tu cuenta"
          : (tipo === "prepago" 
            ? `Pago por ${minutos} minutos de llamadas` 
            : `Depósito inicial requerido para comenzar a llamar`),
        initial_price: finalAmount,
        currency: "usd",
        plan_type: "one_time",
      },
      metadata: {
        action_type: tipo === "instalacion" ? "installation_fee" : "end_customer_payment",
        tenant_id: tenantId,
        end_customer_id: endCustomerId || "",
        payment_type: tipo,
        minutos: minutos?.toString() || "0",
      },
      redirect_url: tipo === "instalacion" 
        ? (process.env.DOMINIO_FRONTEND || "http://localhost:3000").replace("http://localhost", "https://lvh.me") + "/?verificado=ok"
        : (process.env.DOMINIO_FRONTEND || "http://localhost:3000").replace("http://localhost", "https://lvh.me") + `/r/${settings.registrationSlug || tenantId}?pago=exito`
    });

    let checkoutUrl = checkout.purchase_url;
    if (checkoutUrl && checkoutUrl.startsWith("/")) {
      checkoutUrl = `https://whop.com${checkoutUrl}`;
    }

    if (!checkoutUrl) {
      return res.status(500).json({ error: "No se pudo generar el link de pago" });
    }

    res.json({ url: checkoutUrl });
  } catch (error) {
    logger.error(error, "Error en POST /checkout");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /api/public/customer/balance
 * Obtiene el saldo de un cliente final
 */
publicRouter.post("/customer/balance", async (req, res) => {
  try {
    const { telefono, tenantId } = req.body;
    if (!telefono || !tenantId) return res.status(400).json({ error: "Faltan datos" });

    const customer = await db.endCustomer.findUnique({
      where: { tenantId_telefono: { tenantId, telefono } }
    });

    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });

    res.json({
      saldoDinero: customer.saldoDinero,
      saldoMinutos: customer.saldoMinutos
    });
  } catch (error) {
    logger.error(error, "Error en POST /customer/balance");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /api/public/customer/refund
 * Crea una solicitud de reembolso
 */
publicRouter.post("/customer/refund", async (req, res) => {
  try {
    const { telefono, tenantId, montoSolicitado } = req.body;
    
    const customer = await db.endCustomer.findUnique({
      where: { tenantId_telefono: { tenantId, telefono } }
    });

    if (!customer) return res.status(404).json({ error: "Cliente no encontrado" });
    
    if (customer.saldoDinero.toNumber() < montoSolicitado) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    // Buscamos el pago original más reciente
    const payment = await db.endCustomerPayment.findFirst({
      where: { endCustomerId: customer.id, tipo: "retencion" },
      orderBy: { createdAt: "desc" }
    });

    const refundRequest = await db.refundRequest.create({
      data: {
        endCustomerId: customer.id,
        tenantId,
        montoSolicitado,
        whopPaymentId: payment?.whopPaymentId || "N/A"
      }
    });

    res.json(refundRequest);
  } catch (error) {
    logger.error(error, "Error en POST /customer/refund");
    res.status(500).json({ error: "Error interno" });
  }
});



/**
 * GET /api/public/logo/:filename
 * Sirve el logo de la empresa desde R2 de forma pública.
 */
publicRouter.get("/logo/:filename", async (req, res) => {
  try {
    const s3 = getS3();
    if (!s3) {
      return res.status(500).json({ error: "R2 no configurado" });
    }

    const { filename } = req.params;
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `logos/${filename}`
    });

    const item = await s3.send(command);
    res.setHeader("Content-Type", item.ContentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");

    if (item.Body) {
      // item.Body is a Node.js Readable stream
      (item.Body as any).pipe(res);
    } else {
      res.status(404).send("Not found");
    }
  } catch (err: any) {
    if (err.name === "NoSuchKey") {
      res.status(404).send("Logo no encontrado");
    } else {
      logger.error(err, "Error sirviendo logo");
      res.status(500).send("Error sirviendo logo");
    }
  }
});
