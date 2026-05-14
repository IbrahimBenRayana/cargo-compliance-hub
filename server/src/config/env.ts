import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:8080'),
  CC_API_BASE_URL: z.string().default('https://api-cert.customscity.com'),
  CC_API_TOKEN: z.string().optional(),
  CC_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  // Email (Azure Communication Services SMTP)
  EMAIL_HOST: z.string().default('smtp.azurecomm.net'),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@mycargolens.com'),
  EMAIL_FROM_NAME: z.string().default('MyCargoLens'),
  // Stripe (Billing) — optional in dev, required in production (enforced below)
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  // AI provider — Compliance Center features. All optional with sensible
  // defaults; server boots fine without them (graceful degradation via
  // services/ai.ts). When AI_API_KEY is unset the /ai-status endpoint
  // reports disabled and the UI hides AI buttons.
  AI_ASSESSMENT_ENABLED:    z.coerce.boolean().default(false),
  AI_PROVIDER:              z.enum(['openai']).default('openai'),
  AI_MODEL:                 z.string().default('gpt-4o-mini'),
  AI_API_KEY:               z.string().default(''),
  AI_MAX_TOKENS:            z.coerce.number().int().positive().default(2048),
  AI_TEMPERATURE:           z.coerce.number().min(0).max(2).default(0.3),
  // Per-user daily call cap. Resets at UTC midnight.
  AI_RATE_LIMIT_PER_USER:   z.coerce.number().int().positive().default(50),
  // When true, sets OpenAI's `store: false` flag so prompts can't enter
  // their training corpus (zero-retention policy for trade data).
  AI_DISABLE_TRAINING_DATA: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Production-only hard requirements — fail fast at boot rather than at runtime
if (env.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!env.CC_API_TOKEN) missing.push('CC_API_TOKEN');
  if (!env.EMAIL_USER)   missing.push('EMAIL_USER');
  if (!env.EMAIL_PASS)   missing.push('EMAIL_PASS');
  if (missing.length > 0) {
    console.error(`❌ Missing required production environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
