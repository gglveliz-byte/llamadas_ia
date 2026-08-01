/**
 * Webhooks de Whop.
 * Cumple spec sección 5.2.
 *
 * Verifica firma HMAC automáticamente con @whop/sdk.
 */
import { Router } from "express";
import { z } from "zod";
import { Whop } from "@whop/sdk";
import { acreditarSaldo, reversarSaldo } from "../services/billing.service";
import { emitirSSE } from "../sse/events.emitter";
import { logger } from "../utils/logger";

export const whopRouter = Router();

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || "dummy_api_key",
  webhookKey: process.env.WHOP_WEBHOOK_SECRET
    ? btoa(process.env.WHOP_WEBHOOK_SECRET)
    : "dummy_webhook_key",
});

/**
 * POST /webhooks/whop
 * Recibe eventos de Whop (payment.succeeded, refund.created, etc.)
 */
whopRouter.post("/", async (req, res) => {
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
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
        metadata: z.object({
          user_id: z.string(),
          package_id: z.string(),
        }),
      }),
    });

    if (evento.type === "payment.succeeded") {
      const parsed = whopEventSchema.safeParse(evento);
      if (!parsed.success) {
        logger.error({ errors: parsed.error.issues, evento }, "Evento Whop mal formado");
        return res.status(200).send("OK");
      }
      const { id, metadata, amount_after_fees } = parsed.data.data;
      const userId = metadata.user_id;
      const packageId = parseInt(metadata.package_id);

      const { saldoNuevo } = await acreditarSaldo(userId, packageId, id, evento.data.amount_after_fees ?? 0);

      // Notificar al usuario via SSE
      emitirSSE(userId, "recarga_exitosa", {
        paymentId: id,
        saldoNuevo,
      });
    }

    if (evento.type === "refund.created") {
      // Reversar saldo
      const paymentId = evento.data?.id;
      if (paymentId) {
        await reversarSaldo(paymentId);
      }
    }

    res.status(200).send("OK");
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Error procesando webhook Whop");
    res.status(500).send("Internal error");
  }
});
