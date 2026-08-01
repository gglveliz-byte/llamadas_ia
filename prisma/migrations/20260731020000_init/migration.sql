-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension (pgvector + pgcrypto)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'cliente',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "recoveryToken" TEXT,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessName" TEXT,
    "businessPhone" TEXT,
    "twilioSubaccountSid" TEXT,
    "twilioSubaccountAuthTokenEncrypted" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "userId" UUID NOT NULL,
    "aiLanguage" TEXT NOT NULL DEFAULT 'es',
    "bookingMode" TEXT NOT NULL DEFAULT 'hours',
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "checkInTime" TEXT NOT NULL DEFAULT '15:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "businessHours" JSONB NOT NULL DEFAULT '{"lunes":{"abierto":true,"inicio":"09:00","fin":"18:00"},"martes":{"abierto":true,"inicio":"09:00","fin":"18:00"},"miercoles":{"abierto":true,"inicio":"09:00","fin":"18:00"},"jueves":{"abierto":true,"inicio":"09:00","fin":"18:00"},"viernes":{"abierto":true,"inicio":"09:00","fin":"18:00"},"sabado":{"abierto":true,"inicio":"09:00","fin":"14:00"},"domingo":{"abierto":false,"inicio":null,"fin":null}}',
    "modo247" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "grabacionActiva" BOOLEAN NOT NULL DEFAULT false,
    "mensajeConsentimiento" TEXT NOT NULL DEFAULT 'Esta llamada puede ser grabada para fines de calidad.',
    "consentimientoActivo" BOOLEAN NOT NULL DEFAULT false,
    "formFields" JSONB NOT NULL DEFAULT '[{"key":"nombre","label":"Nombre completo","type":"text","required":true},{"key":"telefono","label":"Teléfono","type":"tel","required":false},{"key":"email","label":"Correo electrónico","type":"email","required":false},{"key":"notas","label":"Notas adicionales","type":"textarea","required":false}]',
    "systemPromptContext" TEXT NOT NULL DEFAULT 'Eres un asistente amable que agenda citas...',
    "recursos" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "wallet" (
    "userId" UUID NOT NULL,
    "saldo" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(10,4) NOT NULL,
    "saldoAnterior" DECIMAL(10,4) NOT NULL,
    "saldoNuevo" DECIMAL(10,4) NOT NULL,
    "whopPaymentId" TEXT,
    "callSid" TEXT,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recharge_packages" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoRecarga" DECIMAL(10,2) NOT NULL,
    "saldoOtorgado" DECIMAL(10,2) NOT NULL,
    "precioPorMinuto" DECIMAL(10,4) NOT NULL,
    "precioPorSegundo" DECIMAL(10,6),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recharge_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_config" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_memory" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "rawContext" TEXT NOT NULL,
    "embedding" vector(768),
    "status" TEXT NOT NULL DEFAULT 'activo',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "twilioPhoneSid" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '+1',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phoneNumberId" INTEGER,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "extraFields" JSONB,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ,
    "durationMinutes" INTEGER,
    "recursoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'agendado',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_recordings" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "appointmentId" UUID,
    "twilioCallSid" TEXT,
    "twilioStreamSid" TEXT,
    "r2FileUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_metrics" (
    "id" SERIAL NOT NULL,
    "callSid" TEXT,
    "userId" UUID,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "duracionSegundos" INTEGER,
    "latenciaPromedioMs" INTEGER,
    "latenciaMaxMs" INTEGER,
    "cobroAplicado" DECIMAL(10,4),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "wallet_transactions_userId_createdAt_idx" ON "wallet_transactions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_config_clave_key" ON "admin_config"("clave");

-- CreateIndex
CREATE INDEX "business_memory_userId_status_idx" ON "business_memory"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_phoneNumber_key" ON "phone_numbers"("phoneNumber");

-- CreateIndex
CREATE INDEX "phone_numbers_userId_idx" ON "phone_numbers"("userId");

-- CreateIndex
CREATE INDEX "appointments_userId_startTime_idx" ON "appointments"("userId", "startTime");

-- CreateIndex
CREATE INDEX "appointments_userId_recursoId_startTime_idx" ON "appointments"("userId", "recursoId", "startTime");

-- CreateIndex
CREATE INDEX "call_metrics_userId_createdAt_idx" ON "call_metrics"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_tx_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_tx_wallet_fkey" FOREIGN KEY ("userId") REFERENCES "wallet"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memory" ADD CONSTRAINT "business_memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_metrics" ADD CONSTRAINT "call_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
