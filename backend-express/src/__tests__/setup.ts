import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";

// Cargar .env raíz ANTES de importar cualquier módulo de la app
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

// BD de test aislada: mismo proyecto Neon, schema "test"
const base = process.env.DATABASE_URL!;
process.env.DATABASE_URL =
  base + (base.includes("?") ? "&schema=test" : "?schema=test");

// Par de llaves Ed25519 propio para firmar webhooks Telnyx en los tests
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
process.env.TELNYX_PUBLIC_KEY = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

process.env.NODE_ENV = "test";

(globalThis as any).__TELNYX_TEST_PRIVATE_KEY__ = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
