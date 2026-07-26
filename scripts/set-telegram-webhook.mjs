const requiredEnv = ['BOT_TOKEN', 'PUBLIC_API_URL', 'TELEGRAM_WEBHOOK_SECRET'];

for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    console.error(`Missing required env: ${envName}`);
    process.exit(1);
  }
}

const webhookUrl = new URL('/api/telegram/webhook', process.env.PUBLIC_API_URL);
const telegramUrl = new URL(
  `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`,
);

telegramUrl.searchParams.set('url', webhookUrl.toString());
telegramUrl.searchParams.set(
  'secret_token',
  process.env.TELEGRAM_WEBHOOK_SECRET,
);
telegramUrl.searchParams.set('drop_pending_updates', 'true');

const response = await fetch(telegramUrl);
const body = await response.json().catch(() => undefined);

if (!response.ok || !body?.ok) {
  console.error('Failed to set Telegram webhook:', body ?? response.statusText);
  process.exit(1);
}

console.log('Telegram webhook configured:', webhookUrl.toString());
