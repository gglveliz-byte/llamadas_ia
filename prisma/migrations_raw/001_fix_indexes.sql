-- Ejecutar DESPUES de `npx prisma migrate dev`
-- Prisma NO puede expresar: ivfflat, DESC direction, partial indexes

-- 1. ivfflat index para pgvector (RAG similarity search)
CREATE INDEX IF NOT EXISTS idx_memory_embedding
  ON business_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 2. Reemplazar índice wallet_transactions con DESC direction (snake_case column names = camelCase en Prisma)
DROP INDEX IF EXISTS wallet_transactions_userId_createdAt_idx;
DROP INDEX IF EXISTS idx_wallet_tx_user_desc;
CREATE INDEX idx_wallet_tx_user_desc
  ON wallet_transactions("userId", "createdAt" DESC);

-- 3. Reemplazar índice call_metrics con DESC direction
DROP INDEX IF EXISTS call_metrics_userId_createdAt_idx;
DROP INDEX IF EXISTS idx_call_metrics_user_desc;
CREATE INDEX idx_call_metrics_user_desc
  ON call_metrics("userId", "createdAt" DESC);

-- 4. Partial index para business_memory activo
CREATE INDEX IF NOT EXISTS idx_memory_user_active
  ON business_memory("userId") WHERE status = 'activo';

-- 5. TIME type support (si se quiere en vez de String)
-- ALTER TABLE business_settings ALTER COLUMN "checkInTime" TYPE TIME USING "checkInTime"::time without time zone;
-- ALTER TABLE business_settings ALTER COLUMN "checkOutTime" TYPE TIME USING "checkOutTime"::time without time zone;
