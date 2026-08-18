import { Router } from "express";
import { db } from "../models/database.pool";
import { logger } from "../utils/logger";
import { z } from "zod";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 100000;
  const keylen = 64;
  const digest = "sha512";
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString("hex");
  return `pbkdf2$${digest}$${iterations}$${salt}$${hash}`;
}

export const affiliateRouter = Router();

/**
 * Middleware para asegurar que el request viene de un admin
 */
const requireAdmin = (req: any, res: any, next: any) => {
  const role = req.headers["x-user-role"];
  if (role !== "admin") {
    return res.status(403).json({ error: "Acceso denegado: solo admin" });
  }
  next();
};

/**
 * GET /api/admin/affiliates
 * Lista todos los afiliados
 */
affiliateRouter.get("/admin/list", requireAdmin, async (req, res) => {
  try {
    const afiliados = await db.affiliate.findMany({
      include: {
        _count: {
          select: { referidos: true }
        },
        referidos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formated = afiliados.map(a => ({
      ...a,
      negociosRef: a._count.referidos,
      ultimoReferidoAt: a.referidos.length > 0 ? a.referidos[0].createdAt : null,
      referidos: undefined // ocultar el array para no ensuciar la respuesta
    }));

    res.json(formated);
  } catch (error) {
    logger.error(error, "Error en GET /api/admin/affiliates");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * GET /api/affiliates/public/config
 * Obtiene los valores por defecto públicos para mostrar en la landing de registro
 */
affiliateRouter.get("/public/config", async (req, res) => {
  try {
    const comisionCfg = await db.adminConfig.findUnique({ where: { clave: "afiliado_comision_minuto_default" } });
    const feeCfg = await db.adminConfig.findUnique({ where: { clave: "fee_instalacion_minimo" } });
    const gananciaCfg = await db.adminConfig.findUnique({ where: { clave: "afiliado_ganancia_instalacion_default" } });

    res.json({
      comisionPorMinuto: parseFloat(comisionCfg?.valor || "0.05"),
      feeInstalacion: parseFloat(feeCfg?.valor || "200.00"),
      gananciaInstalacion: parseFloat(gananciaCfg?.valor || "50.00"),
    });
  } catch (error) {
    logger.error(error, "Error en GET /api/affiliates/public/config");
    res.json({ comisionPorMinuto: 0.05, feeInstalacion: 200, gananciaInstalacion: 50 }); // Fallback seguro
  }
});

/**
 * POST /api/affiliates/public/register
 * Registro público de afiliados
 */
affiliateRouter.post("/public/register", async (req, res) => {
  try {
    const schema = z.object({
      nombre: z.string().min(1, "El nombre es obligatorio"),
      email: z.string().email("Email inválido"),
      password: z.string().min(6, "Mínimo 6 caracteres")
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", issues: parsed.error.issues });
    }

    const { nombre, email, password } = parsed.data;

    // Verificar si el email ya existe en afiliados o usuarios
    const exists = await db.affiliate.findFirst({ where: { email } });
    const userExists = await db.user.findFirst({ where: { email } });

    if (exists || userExists) {
      return res.status(400).json({ error: "Este correo electrónico ya está registrado." });
    }

    // Generar slug único
    let baseSlug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    if (!baseSlug) baseSlug = "afiliado";
    
    let slug = `${baseSlug}-${crypto.randomBytes(2).toString("hex")}`;
    while (await db.affiliate.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`;
    }

    const passwordHash = hashPassword(password);

    // Valores por defecto dinámicos desde AdminConfig
    const comisionCfg = await db.adminConfig.findUnique({ where: { clave: "afiliado_comision_minuto_default" } });
    const feeCfg = await db.adminConfig.findUnique({ where: { clave: "fee_instalacion_minimo" } });
    const gananciaCfg = await db.adminConfig.findUnique({ where: { clave: "afiliado_ganancia_instalacion_default" } });

    const comisionPorMinuto = parseFloat(comisionCfg?.valor || "0.05");
    const feeInstalacion = parseFloat(feeCfg?.valor || "200.00");
    const gananciaInstalacion = parseFloat(gananciaCfg?.valor || "50.00");

    const afiliado = await db.affiliate.create({
      data: {
        nombre,
        email,
        passwordHash,
        slug,
        comisionPorMinuto,
        feeInstalacion,
        gananciaInstalacion,
        isActive: true
      }
    });

    res.json({ success: true, message: "Afiliado registrado exitosamente", afiliadoId: afiliado.id });
  } catch (error: any) {
    logger.error(error, "Error en POST /api/affiliates/public/register");
    require("fs").appendFileSync("error-debug.log", "\n" + Date.now() + " " + (error?.stack || error?.message || String(error)));
    res.status(500).json({ error: "Error interno del servidor", details: error?.message });
  }
});

/**
 * POST /api/admin/affiliates
 * Crea un nuevo afiliado
 */
affiliateRouter.post("/admin/create", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      nombre: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      slug: z.string().min(3),
      comisionPorMinuto: z.number().min(0),
      feeInstalacion: z.number().min(0)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", issues: parsed.error.issues });
    }

    const { nombre, email, password, slug, comisionPorMinuto, feeInstalacion } = parsed.data;

    const exists = await db.affiliate.findFirst({
      where: {
        OR: [
          { email },
          { slug }
        ]
      }
    });

    if (exists) {
      return res.status(400).json({ error: "El email o slug ya están en uso" });
    }

    const passwordHash = hashPassword(password);

    const afiliado = await db.affiliate.create({
      data: {
        nombre,
        email,
        slug,
        passwordHash,
        comisionPorMinuto,
        feeInstalacion,
        gananciaInstalacion: req.body.gananciaInstalacion ?? 50
      }
    });

    res.json(afiliado);
  } catch (error) {
    logger.error(error, "Error en POST /api/admin/affiliates");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * PATCH /api/admin/affiliates/:id
 * Edita un afiliado
 */
affiliateRouter.patch("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      comisionPorMinuto: z.number().min(0).optional(),
      feeInstalacion: z.number().min(0).optional(),
      gananciaInstalacion: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", issues: parsed.error.issues });
    }

    const afiliado = await db.affiliate.update({
      where: { id: req.params.id },
      data: parsed.data
    });

    // Propagar feeInstalacion a referidos que no han pagado
    if (parsed.data.feeInstalacion !== undefined) {
      await db.user.updateMany({
        where: {
          affiliateId: req.params.id,
          installationPaid: false
        },
        data: {
          installationAmount: parsed.data.feeInstalacion
        }
      });
    }

    res.json(afiliado);
  } catch (error) {
    logger.error(error, "Error en PATCH /api/admin/affiliates/:id");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * DELETE /api/admin/affiliates/:id
 * Elimina un afiliado
 */
affiliateRouter.delete("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const affiliateId = req.params.id;
    
    // Validar que no tenga referidos
    const referidosCount = await db.user.count({ where: { affiliateId } });
    if (referidosCount > 0) {
      return res.status(400).json({ error: "No se puede eliminar porque tiene negocios referidos activos o históricos. Por favor, suspende la cuenta en su lugar." });
    }

    await db.affiliate.delete({ where: { id: affiliateId } });
    res.json({ success: true });
  } catch (error) {
    logger.error(error, "Error en DELETE /api/admin/affiliates/:id");
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * GET /api/affiliate/dashboard
 * Obtiene el dashboard para un afiliado autenticado
 */
affiliateRouter.get("/dashboard", async (req, res) => {
  try {
    const affiliateId = req.headers["x-affiliate-id"] as string;
    if (!affiliateId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const afiliado = await db.affiliate.findUnique({
      where: { id: affiliateId },
      include: {
        referidos: {
          select: {
            id: true,
            businessName: true,
            createdAt: true,
          }
        }
      }
    });

    if (!afiliado) {
      return res.status(404).json({ error: "Afiliado no encontrado" });
    }

    // Calcular lo generado por cada referido 
    // Nota: Esto asume EndCustomerPayment
    const referidosConGanancias = await Promise.all(afiliado.referidos.map(async (r) => {
      const pagos = await db.endCustomerPayment.aggregate({
        where: {
          tenantId: r.id,
          affiliateId: afiliado.id
        },
        _sum: {
          comisionAfiliado: true
        }
      });
      return {
        id: r.id,
        nombre: r.businessName || "Negocio sin nombre",
        fecha: r.createdAt,
        generado: pagos._sum.comisionAfiliado?.toNumber() || 0
      };
    }));

    res.json({
      gananciasGeneradas: afiliado.totalGanado.toNumber(),
      saldoAcumulado: afiliado.saldoAcumulado.toNumber(),
      negociosActivos: afiliado.referidos.length,
      referidos: referidosConGanancias
    });
  } catch (error) {
    logger.error(error, "Error en GET /api/affiliate/dashboard");
    res.status(500).json({ error: "Error interno" });
  }
});

