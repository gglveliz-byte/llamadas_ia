-- Add servicio (service booked by the customer) to appointments
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "servicio" TEXT;
