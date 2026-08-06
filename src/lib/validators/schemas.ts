import { z } from "zod";

const recordUnknown = z.record(z.string(), z.unknown());
const arrayRecordUnknown = z.array(z.record(z.string(), z.unknown()));

export const userIdParamSchema = z.object({ userId: z.string().uuid() });

export const emailSchema = z.string().email("Email inválido").max(255);

export const passwordSchema = z
  .string()
  .min(6, "Mínimo 6 caracteres")
  .max(128, "Máximo 128 caracteres");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  businessName: z.string().max(255).optional().default(""),
  businessPhone: z.string().max(50).optional().default(""),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Contraseña requerida"),
});

export const uuidSchema = z.string().uuid("UUID inválido");

export const rechargeSchema = z.object({
  userId: uuidSchema,
  packageId: z.string().or(z.number().transform(String)),
  whopPaymentId: z.string().max(100).optional(),
});

export const createAppointmentSchema = z.object({
  userId: uuidSchema,
  customerName: z.string().min(1, "Nombre requerido").max(255),
  customerPhone: z.string().max(50).optional().default(""),
  customerEmail: z.string().max(255).optional().default(""),
  startTime: z.string().min(1, "startTime requerido"),
  durationMinutes: z.number().int().positive().optional().default(30),
  recursoId: z.string().max(100).optional().default(""),
  notes: z.string().max(500).optional().default(""),
  extraFields: recordUnknown.optional(),
});

export const updateAppointmentSchema = z.object({
  appointmentId: uuidSchema,
  status: z.enum(["agendado", "asistio", "no_asistio", "cancelado"]),
});

export const adminClientActionSchema = z.object({
  clientId: uuidSchema,
  action: z.enum(["suspend", "activate", "delete"]),
});

export const adminAdjustBalanceSchema = z.object({
  clientId: uuidSchema,
  monto: z.number().finite(),
  descripcion: z.string().max(500).optional().default(""),
});

export const businessSettingsSchema = z.object({
  aiLanguage: z.string().max(10).optional(),
  mensajeSaludo: z.string().max(500).nullish(),
  bookingMode: z.enum(["hours", "nights"]).optional(),
  defaultDurationMinutes: z.number().int().positive().optional(),
  timezone: z.string().max(50).optional(),
  modo247: z.boolean().optional(),
  businessHours: recordUnknown.optional(),
  formFields: arrayRecordUnknown.optional(),
  systemPromptContext: z.string().max(5000).optional(),
  recursos: arrayRecordUnknown.optional(),
  grabacionActiva: z.boolean().optional(),
  mensajeConsentimiento: z.string().max(500).optional(),
  consentimientoActivo: z.boolean().optional(),
  checkInTime: z.string().max(10).optional(),
  checkOutTime: z.string().max(10).optional(),
});

export const businessMemorySchema = z.object({
  userId: z.string().uuid(),
  rawContext: z.string().min(1, "Contexto requerido").max(10000),
  action: z.enum(["save", "reinterview"]).optional().default("save"),
});

export const phoneNumberSchema = z.object({
  phoneNumber: z.string().min(5).max(20),
  countryCode: z.string().max(5).default("+52"),
});

export const purchasePhoneSchema = z.object({
  userId: z.string().uuid(),
  countryCode: z.string().max(5).default("+1"),
  areaCode: z.string().optional(),
});

export const updateUserSchema = z.object({
  businessName: z.string().max(255).optional(),
  businessPhone: z.string().max(50).optional(),
});

export const adminPackageSchema = z.object({
  nombre: z.string().min(1).max(100),
  montoRecarga: z.number().positive(),
  saldoOtorgado: z.number().positive(),
  precioPorMinuto: z.number().positive(),
  activo: z.boolean().optional().default(true),
});

export const adminConfigSchema = z.object({
  clave: z.string().min(1).max(100),
  valor: z.string(),
  descripcion: z.string().max(500).optional().default(""),
});

export const adminConfigUpdateSchema = z.object({
  clave: z.string().min(1).max(100),
  valor: z.string(),
});

export const adminPackageUpdateSchema = z.object({
  id: z.string().or(z.number().transform(String)),
  nombre: z.string().min(1).max(100).optional(),
  montoRecarga: z.number().positive().optional(),
  saldoOtorgado: z.number().positive().optional(),
  precioPorMinuto: z.number().positive().optional(),
  activo: z.boolean().optional(),
});

export const adminPackageCreateSchema = z.object({
  nombre: z.string().min(1).max(100),
  montoRecarga: z.number().positive(),
  saldoOtorgado: z.number().positive(),
  precioPorMinuto: z.number().positive(),
  activo: z.boolean().optional().default(true),
});
