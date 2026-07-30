/**
 * Webhooks de Whop.
 * Cumple spec sección 5.2.
 *
 * Verifica firma HMAC automáticamente con @whop/sdk.
 */
import { Router } from "express";
import { Whop } from "@whop/sdk";
import { acreditarSaldo, reversarSaldo } from "../services/billing.service";
import { emitirSSE } from "../sse/events.emitter";
import { logger } from "../utils/logger";

export const whopRouter = Router();

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || "dev",
  webhookKey: process.env.WHOP_WEBHOOK_SECRET
    ? btoa(process.env.WHOP_WEBHOOK_SECRET)
    : btoa("dev"),
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
    // En sandbox puede no haber secret configurado - skip verification
    if (process.env.WHOP_WEBHOOK_SECRET) {
      evento = whopsdk.webhooks.unwrap(body, { headers });
    } else {
      evento = JSON.parse(body);
      logger.warn("WHOP_WEBHOOK_SECRET no configurado - skip firma");
    }
  } catch (e) {
    logger.error({ error: (e as Error).message }, "Firma Whop inválida");
    return res.status(401).send("Invalid signature");
  }

  logger.info({ type: evento.type }, "Webhook Whop recibido");

  try {
    if (evento.type === "payment.succeeded") {
      const { id, metadata } = evento.data;
      const userId = metadata?.user_id;
      const packageId = parseInt(metadata?.package_id);

      if (!userId || !packageId) {
        logger.error({ metadata }, "Metadata incompleta en webhook Whop");
        return res.status(200).send("OK");
      }

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
