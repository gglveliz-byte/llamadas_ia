import { Router } from "express";
import { db } from "../models/database.pool";
import { authAdmin } from "../middleware/auth.middleware";
import { logger } from "../utils/logger";
import { z } from "zod";

export const refundRouter = Router();

// Todas las rutas requieren auth admin
refundRouter.use(authAdmin);

/**
 * GET /admin/refunds
 * Lista solicitudes de reembolso, opcionalmente filtrando por status.
 */
refundRouter.get("/", async (req, res) => {
  try {
    const status = req.query.status as string;
    const where = status ? { status } : {};
    
    const refunds = await db.refundRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        endCustomer: {
          select: { nombre: true, telefono: true, email: true, saldoDinero: true }
        }
      }
    });

    res.json(refunds);
  } catch (error) {
    logger.error(error, "Error al listar reembolsos");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /admin/refunds/:id/complete
 * Marca un reembolso como completado y descuenta el saldo del cliente final.
 */
refundRouter.post("/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.$transaction(async (tx) => {
      const request = await tx.refundRequest.findUnique({
        where: { id },
        include: { endCustomer: true }
      });

      if (!request) {
        throw new Error("Solicitud no encontrada");
      }

      if (request.status !== "pendiente") {
        throw new Error("La solicitud ya no está pendiente");
      }

      if (request.endCustomer.saldoDinero.toNumber() < request.montoSolicitado.toNumber()) {
        throw new Error("El cliente no tiene suficiente saldo para este reembolso");
      }

      // Marcar completado
      const updatedReq = await tx.refundRequest.update({
        where: { id },
        data: { status: "completado" }
      });

      // Descontar saldo
      await tx.endCustomer.update({
        where: { id: request.endCustomerId },
        data: { saldoDinero: request.endCustomer.saldoDinero.toNumber() - request.montoSolicitado.toNumber() }
      });

      return updatedReq;
    });

    res.json(result);
  } catch (error: any) {
    logger.error(error, "Error al completar reembolso");
    res.status(400).json({ error: error.message || "Error interno" });
  }
});

/**
 * POST /admin/refunds/:id/reject
 * Marca un reembolso como rechazado.
 */
refundRouter.post("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await db.refundRequest.update({
      where: { id },
      data: { status: "rechazado" }
    });

    res.json(request);
  } catch (error) {
    logger.error(error, "Error al rechazar reembolso");
    res.status(500).json({ error: "Error interno" });
  }
});
