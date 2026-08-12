require("dotenv").config();
const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (pooled connection for Neon)"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required (direct connection for Neon migrations)"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("15m"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formattedErrors = JSON.stringify(result.error.format(), null, 2);
  console.error("❌ Environment Variable Validation Error:\n", formattedErrors);
  throw new Error("Missing or invalid environment variables. Ensure DATABASE_URL, DIRECT_URL, and JWT_SECRET are defined in .env.");
}

module.exports = result.data;
