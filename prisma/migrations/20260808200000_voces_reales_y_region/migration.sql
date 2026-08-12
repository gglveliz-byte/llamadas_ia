-- AlterTable: voces reales de Gemini 3.x + acento regional
ALTER TABLE "business_settings" ALTER COLUMN "aiVoice" SET DEFAULT 'Dipper';
ALTER TABLE "business_settings" ADD COLUMN "aiRegion" TEXT NOT NULL DEFAULT 'es-MX';

-- DataMigration: normalizar voces antiguas (Puck) al default real
UPDATE "business_settings" SET "aiVoice" = 'Dipper' WHERE "aiVoice" = 'Puck';
