import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Whop } from "@whop/sdk";
import { logger } from "@/lib/logger";

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || "dummy_api_key",
  webhookKey: process.env.WHOP_WEBHOOK_SECRET ? btoa(process.env.WHOP_WEBHOOK_SECRET) : "dummy_webhook_key",
});

export async function POST(req: NextRequest) {
  const body = await req.text();

  let evento: Record<string, unknown> = {};
  try {
    evento = whopsdk.webhooks.unwrap(body, { headers: Object.fromEntries(req.headers) }) as unknown as Record<string, unknown>;
  } catch (e) {
    logger.error({ error: (e as Error).message }, "[whop] Firma inválida");
    return new Response("Invalid signature", { status: 401 });
  }

  logger.info({ type: evento.type }, "[whop] Evento recibido");

  try {
    if (evento.type === "payment.succeeded") {
      const data = evento.data as Record<string, unknown>;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      const userId = metadata.user_id as string | undefined;
      const packageId = parseInt((metadata.package_id as string) ?? "");

      if (!userId || !packageId) {
        logger.warn({ metadata }, "[whop] Metadata incompleta");
        return new Response("OK", { status: 200 });
      }

      const paquete = await db.rechargePackage.findUnique({ where: { id: packageId } });
      if (!paquete) {
        logger.error({ packageId }, "[whop] Paquete no encontrado");
        return new Response("OK", { status: 200 });
      }

      const saldoOtorgado = paquete.saldoOtorgado.toNumber();
      const montoRecarga = paquete.montoRecarga.toNumber();

      const wallet = await db.wallet.findUnique({ where: { userId } });
      let saldoNuevo: number;

      if (wallet) {
        saldoNuevo = wallet.saldo.toNumber() + saldoOtorgado;
        await db.wallet.update({ where: { userId }, data: { saldo: saldoNuevo } });
      } else {
        saldoNuevo = saldoOtorgado;
        await db.wallet.create({ data: { userId, saldo: saldoNuevo } });
      }

      await db.walletTransaction.create({
        data: {
          userId,
          tipo: "recarga",
          monto: saldoOtorgado,
          saldoAnterior: wallet?.saldo.toNumber() ?? 0,
          saldoNuevo,
          whopPaymentId: (data.id as string) ?? "whop_" + Date.now(),
          descripcion: `Recarga Paquete ${paquete.nombre} ($${montoRecarga})`,
        },
      });

      logger.info({ userId, monto: saldoOtorgado, saldoNuevo, paymentId: data.id }, "[whop] Saldo acreditado");
    }

    if (evento.type === "refund.created") {
      const data = evento.data as Record<string, unknown>;
      logger.info({ paymentId: (data.id as string) ?? "unknown" }, "[whop] Reembolso recibido");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    logger.error({ error: (e as Error).message, eventType: evento.type }, "[whop] Error procesando");
    return new Response("Internal error", { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
