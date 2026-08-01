import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    console.error("❌ Archivo .env no encontrado");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && !key.startsWith("#")) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  });
}

loadEnv();

const requiredEnv = {
  DATABASE_URL: "PostgreSQL connection string",
  REDIS_URL: "Redis connection string",
  GEMINI_API_KEY: "Google AI Studio API key",
  TELNYX_API_KEY: "Telnyx API Key v2",
  TELNYX_PUBLIC_KEY: "Telnyx Public Key (Ed25519) for webhook verification",
  TELNYX_WEBHOOK_SECRET: "Telnyx webhook secret (optional HMAC)",
  TELNYX_ORG_ID: "Telnyx Organization ID for child accounts",
  TELNYX_WEBHOOK_URL: "Telnyx webhook URL (e.g. https://api.vozia.com/webhooks/telnyx/voice)",
  WHOP_API_KEY: "Whop API key",
  WHOP_WEBHOOK_SECRET: "Whop webhook signing secret",
  R2_ACCOUNT_ID: "Cloudflare R2 Account ID",
  R2_ACCESS_KEY_ID: "Cloudflare R2 Access Key ID",
  R2_SECRET_ACCESS_KEY: "Cloudflare R2 Secret Access Key",
  R2_BUCKET_NAME: "Cloudflare R2 bucket name",
  JWT_SECRET: "JWT signing secret (32+ chars)",
  JWT_REFRESH_SECRET: "JWT refresh secret (32+ chars)",
  ENCRYPTION_KEY: "Encryption key (64 hex chars)",
  INTERNAL_API_KEY: "Internal API key for Next.js ↔ Express",
  SMTP_HOST: "SMTP host",
  SMTP_PORT: "SMTP port",
  SMTP_USER: "SMTP username",
  SMTP_PASS: "SMTP password",
  DOMINIO_FRONTEND: "Frontend domain (e.g. https://app.vozia.com)",
  DOMINIO_EXPRESS: "Express backend domain (e.g. https://api.vozia.com)",
  NEXT_PUBLIC_API_URL: "Public API URL for frontend",
  NEXT_PUBLIC_WS_URL: "Public WebSocket URL for frontend",
};

const optionalEnv = {
  NODE_ENV: "development",
  LOG_LEVEL: "info",
};

function validateEnv(): void {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const [key, desc] of Object.entries(requiredEnv)) {
    const val = process.env[key];
    if (!val) {
      missing.push(`${key} (${desc})`);
    } else if (val.trim() === "") {
      empty.push(`${key} (${desc})`);
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    console.error("\n❌ VARIABLES DE ENTORNO FALTANTES O VACÍAS:\n");
    [...missing, ...empty].forEach((m) => console.error(`  - ${m}`));
    console.error("\n💡 Copia .env.example a .env y completa todos los valores requeridos.");
    console.error("   Para desarrollo local, usa los valores de docker-compose.\n");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    const devDefaults = [
      "vozia-dev-jwt-secret",
      "vozia-dev-refresh-secret",
      "vozia-dev-key",
    ];
    for (const def of devDefaults) {
      if (
        process.env.JWT_SECRET === def ||
        process.env.JWT_REFRESH_SECRET === def ||
        process.env.ENCRYPTION_KEY?.includes(def)
      ) {
        console.error("\n❌ SECRETS DE DESARROLLO DETECTADOS EN PRODUCCIÓN:");
        console.error(`   No uses valores por defecto: ${devDefaults.join(", ")}`);
        console.error("   Genera secrets seguros (openssl rand -hex 32).\n");
        process.exit(1);
      }
    }

    if (
      process.env.DOMINIO_FRONTEND?.includes("localhost") ||
      process.env.DOMINIO_EXPRESS?.includes("localhost")
    ) {
      console.error("\n⚠️  ADVERTENCIA: DOMINIO_FRONTEND/EXPRESS apuntan a localhost en producción");
    }
  }

  console.log("✅ Variables de entorno validadas correctamente");
}

export const env = {
  ...requiredEnv,
  ...optionalEnv,
  get(key: string) {
    return process.env[key];
  },
  required: (key: string) => {
    const val = process.env[key];
    if (!val) throw new Error(`Variable requerida ${key} no configurada`);
    return val;
  },
};

validateEnv();