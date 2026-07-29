import { z } from 'zod';

const telegramIdsSchema = z.string().refine(
  (value) => {
    const ids = value.split(',').map((id) => id.trim());

    return ids.length > 0 && ids.every((id) => /^\d+$/.test(id));
  },
  {
    message: 'ALLOWED_TELEGRAM_IDS must be a comma-separated list of numbers',
  },
);

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const optionalUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.url().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    BOT_TOKEN: z.string().min(1),
    TELEGRAM_BOT_MODE: z.enum(['polling', 'webhook']).optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
    TELEGRAM_USER_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    TELEGRAM_GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(100),
    TELEGRAM_DAILY_LLM_JOB_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(20),
    JOBS_WORKER_ENABLED: booleanStringSchema.optional(),
    RSS_CRON_ENABLED: booleanStringSchema.optional(),
    RSS_CRON_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    RSS_CRON_TARGET_TELEGRAM_ID: z.coerce.number().int().positive().optional(),
    RSS_CRON_TARGET_CHAT_ID: z.coerce.number().int().optional(),
    PUBLIC_API_URL: z.url().optional(),
    PUBLIC_MINI_APP_URL: z.url().optional(),
    ALLOWED_TELEGRAM_IDS: telegramIdsSchema,
    LLM_API_KEY: z.string().optional(),
    LLM_BASE_URL: optionalUrlSchema,
    LLM_OUTPUT_MODE: z.enum(['json_schema', 'json_object']).default('json_schema'),
    LLM_ADAPTATION_MODEL: z.string().min(1).optional(),
    LLM_WORD_ANALYSIS_MODEL: z.string().min(1).optional(),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .transform((env) => ({
    ...env,
    TELEGRAM_BOT_MODE:
      env.TELEGRAM_BOT_MODE ??
      (env.NODE_ENV === 'production' ? 'webhook' : 'polling'),
    JOBS_WORKER_ENABLED:
      env.JOBS_WORKER_ENABLED ?? env.NODE_ENV === 'production',
    RSS_CRON_ENABLED: env.RSS_CRON_ENABLED ?? false,
  }))
  .superRefine((env, ctx) => {
    if (env.TELEGRAM_BOT_MODE !== 'webhook') {
      return;
    }

    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'TELEGRAM_WEBHOOK_SECRET is required in webhook mode',
      });
    }

    if (!env.PUBLIC_API_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_API_URL'],
        message: 'PUBLIC_API_URL is required in webhook mode',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
