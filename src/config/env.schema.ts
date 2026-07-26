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
    PUBLIC_API_URL: z.url().optional(),
    ALLOWED_TELEGRAM_IDS: telegramIdsSchema,
    OPENAI_API_KEY: z.string().optional(),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .transform((env) => ({
    ...env,
    TELEGRAM_BOT_MODE:
      env.TELEGRAM_BOT_MODE ??
      (env.NODE_ENV === 'production' ? 'webhook' : 'polling'),
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
