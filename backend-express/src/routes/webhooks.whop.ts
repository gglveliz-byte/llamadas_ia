/**
 * Webhooks de Whop.
 * Cumple spec sección 5.2.
 *
 * Verifica firma HMAC automáticamente con @whop/sdk.
 */
import { Router } from "express";
import { z } from "zod";
import { Whop } from "@whop/sdk";
import { emitirSSE } from "../sse/events.emitter";
import { logger } from "../utils/logger";
import { db } from "../models/database.pool";
import { enviarEmail, emailTemplates } from "../services/email.service";
import { calcularComisiones, aplicarComisiones } from "../services/commission.service";

export const whopRouter = Router();

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || "dummy_api_key",
  webhookKey: process.env.WHOP_WEBHOOK_SECRET 
    ? Buffer.from(process.env.WHOP_WEBHOOK_SECRET).toString("base64") 
    : "dummy_webhook_key",
});

/**
 * POST /webhooks/whop
 * Recibe eventos de Whop (payment.succeeded, refund.created, etc.)
 */
whopRouter.post("/", async (req, res) => {
  const body = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  const headers = req.headers as Record<string, string>;

  let evento;
  try {
    if (process.env.WHOP_WEBHOOK_SECRET) {
      evento = whopsdk.webhooks.unwrap(body, { headers });
    } else if (process.env.NODE_ENV === "production") {
      logger.error("WHOP_WEBHOOK_SECRET no configurado en producción");
      return res.status(500).send("Webhook secret not configured");
    } else {
      evento = JSON.parse(body);
      logger.warn("WHOP_WEBHOOK_SECRET no configurado - skip firma (solo dev)");
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Firma Whop inválida");
    return res.status(401).send("Invalid signature");
  }

  logger.info({ type: evento.type }, "Webhook Whop recibido");

  try {
    const whopEventSchema = z.object({
      type: z.string(),
      data: z.object({
        id: z.string(),
        amount_after_fees: z.number().optional(),
        metadata: z.record(z.string(), z.any()),
      }),
    });

    if (evento.type === "payment.succeeded") {
      const parsed = whopEventSchema.safeParse(evento);
      if (!parsed.success) {
        logger.error({ errors: parsed.error.issues, evento }, "Evento Whop mal formado");
        return res.status(200).send("OK");
      }
      const metadata = parsed.data.data.metadata;
      const amountAfterFees = parsed.data.data.amount_after_fees ?? 0;
      const paymentId = parsed.data.data.id;

      if (metadata.action_type === "installation_fee") {
        const tenantId = metadata.tenant_id;
        if (tenantId) {
          const tenant = await db.user.findUnique({ where: { id: tenantId }, include: { affiliate: true } });
          if (tenant) {
            await db.user.update({
              where: { id: tenantId },
              data: {
                installationPaid: true,
                installationPaidAt: new Date(),
                installationAmount: amountAfterFees
              }
            });

            // Repartir fee de instalación con afiliado si existe
            if (tenant.affiliateId && tenant.affiliate) {
              const gananciaInstalacion = tenant.affiliate.gananciaInstalacion ? tenant.affiliate.gananciaInstalacion.toNumber() : 50;
              const gananciaAfiliado = parseFloat(Math.min(amountAfterFees, gananciaInstalacion).toFixed(2));
              
              if (gananciaAfiliado > 0) {
                await db.affiliate.update({
                  where: { id: tenant.affiliateId },
                  data: {
                    saldoAcumulado: tenant.affiliate.saldoAcumulado.toNumber() + gananciaAfiliado,
                    totalGanado: tenant.affiliate.totalGanado.toNumber() + gananciaAfiliado
                  }
                });
              }
            }
            logger.info({ tenantId, paymentId }, "Fee de instalación procesado correctamente");
            emitirSSE(tenantId, "installation_paid", { paymentId });
          }
        }
      } else if (metadata.action_type === "end_customer_payment") {
        const tenantId = metadata.tenant_id;
        const endCustomerId = metadata.end_customer_id;
        const paymentType = metadata.payment_type; // "prepago" o "retencion"
        const minutosComprados = metadata.minutos ? parseFloat(metadata.minutos) : 0;
        const montoTotal = amountAfterFees;

        if (tenantId && endCustomerId) {
          // 1. Calcular comisiones (Solo si es prepago)
          let comisionPlataforma = montoTotal;
          let comisionDueno = 0;
          let comisionAfiliado = 0;
          let affiliateId = null;

          if (paymentType === "prepago") {
            const comisiones = await calcularComisiones(tenantId, montoTotal, minutosComprados);
            comisionPlataforma = comisiones.comisionPlataforma;
            comisionDueno = comisiones.comisionDueno;
            comisionAfiliado = comisiones.comisionAfiliado;
            affiliateId = comisiones.affiliateId;
          }

          await db.$transaction(async (tx) => {
            // 2. Registrar EndCustomerPayment
            await tx.endCustomerPayment.create({
              data: {
                endCustomerId,
                tenantId,
                whopPaymentId: paymentId,
                tipo: paymentType,
                montoTotal,
                minutosComprados,
                precioPorMinuto: montoTotal / (minutosComprados || 1), // Aproximado para el snapshot
                comisionPlataforma: comisionPlataforma,
                comisionDueno: comisionDueno,
                comisionAfiliado: comisionAfiliado,
                affiliateId: affiliateId,
                status: "activo"
              }
            });

            // 3. Acreditar a EndCustomer
            const endCustomer = await tx.endCustomer.findUnique({ where: { id: endCustomerId } });
            if (endCustomer) {
              if (paymentType === "prepago") {
                await tx.endCustomer.update({
                  where: { id: endCustomerId },
                  data: { saldoMinutos: endCustomer.saldoMinutos.toNumber() + minutosComprados }
                });
              } else if (paymentType === "retencion") {
                await tx.endCustomer.update({
                  where: { id: endCustomerId },
                  data: { saldoDinero: endCustomer.saldoDinero.toNumber() + montoTotal }
                });
              }
            }

            // 4. Aplicar comisiones a Dueño y Afiliado (Solo si es prepago)
            if (paymentType === "prepago") {
              await aplicarComisiones(
                tx,
                tenantId,
                affiliateId,
                comisionDueno,
                comisionAfiliado,
                paymentId
              );
            }
          });
          logger.info({ endCustomerId, tenantId, paymentId }, "Pago de cliente final procesado");
        }
      }
    }

    res.status(200).send("OK");
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error procesando webhook Whop");
    res.status(500).send("Internal error");
  }
});
