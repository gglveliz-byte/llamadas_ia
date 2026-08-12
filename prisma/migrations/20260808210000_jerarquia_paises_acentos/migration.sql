-- DataMigration: aiRegion pasa a jerarquía PAÍS → IDIOMA → ACENTO.
-- Nuevos ids con formato "PAIS-idioma" (ej. "MX-es", "US-en", "BR-pt").
-- El idioma se deriva SIEMPRE del acento (nunca se configura libre).

UPDATE "business_settings" SET "aiRegion" = 'MX-es' WHERE "aiRegion" = 'es-MX';
UPDATE "business_settings" SET "aiRegion" = 'US-es' WHERE "aiRegion" = 'es-US';
UPDATE "business_settings" SET "aiRegion" = 'ES-es' WHERE "aiRegion" = 'es-ES';
UPDATE "business_settings" SET "aiRegion" = 'AR-es' WHERE "aiRegion" = 'es-AR';
UPDATE "business_settings" SET "aiRegion" = 'CO-es' WHERE "aiRegion" = 'es-CO';
UPDATE "business_settings" SET "aiRegion" = 'US-en' WHERE "aiRegion" = 'en-US';
UPDATE "business_settings" SET "aiRegion" = 'GB-en' WHERE "aiRegion" = 'en-GB';
UPDATE "business_settings" SET "aiRegion" = 'BR-pt' WHERE "aiRegion" = 'pt-BR';

-- Sincronizar aiLanguage con el idioma derivado de cada acento nuevo.
UPDATE "business_settings"
SET "aiLanguage" = SUBSTRING("aiRegion" FROM strpos("aiRegion", '-') + 1)
WHERE "aiRegion" ~ '^[A-Z]{2}-[a-z]{2,3}$';
