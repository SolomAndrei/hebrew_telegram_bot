import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

import { RateLimitService } from '../access/rate-limit.service';
import { TelegramAccessService } from '../access/telegram-access.service';
import { Env } from '../config/env.schema';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly bot: Bot;
  private readonly botMode: Env['TELEGRAM_BOT_MODE'];
  private readonly logger = new Logger(BotService.name);

  constructor(
    @Inject(ConfigService) configService: ConfigService<Env, true>,
    private readonly telegramAccessService: TelegramAccessService,
    private readonly rateLimitService: RateLimitService,
    private readonly jobsService: JobsService,
  ) {
    this.bot = new Bot(configService.get('BOT_TOKEN', { infer: true }));
    this.botMode = configService.get('TELEGRAM_BOT_MODE', { infer: true });
    this.registerHandlers();
  }

  onModuleInit(): void {
    if (this.botMode === 'webhook') {
      this.logger.log('Telegram bot webhook mode enabled');
      return;
    }

    void this.bot
      .start({
        drop_pending_updates: true,
      })
      .then(() => {
        this.logger.log('Telegram bot polling stopped');
      })
      .catch((error: unknown) => {
        this.logger.error('Telegram bot polling failed', error);
      });

    this.logger.log('Telegram bot polling started');
  }

  onModuleDestroy(): void {
    if (this.botMode === 'polling') {
      this.bot.stop();
    }
  }

  async handleUpdate(update: unknown): Promise<void> {
    await this.bot.handleUpdate(
      update as Parameters<Bot['handleUpdate']>[0],
    );
  }

  private registerHandlers(): void {
    this.bot.catch((error) => {
      this.logger.error('Telegram bot handler failed', error.error);
    });

    this.bot.use(async (ctx, next) => {
      const telegramId = ctx.from?.id;

      if (
        !telegramId ||
        !this.telegramAccessService.isAllowedTelegramId(telegramId)
      ) {
        await ctx.reply('Access denied.');
        return;
      }

      const rateLimit = this.rateLimitService.checkTelegramUser(telegramId);

      if (!rateLimit.allowed) {
        await ctx.reply(
          `Too many messages. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        );
        return;
      }

      await next();
    });

    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        'Welcome. Send Hebrew text or a news link.',
      );
    });

    this.bot.on('message', async (ctx) => {
      if (!ctx.from || !ctx.chat) {
        return;
      }

      try {
        await this.jobsService.enqueueTelegramJob({
          type: 'telegram_message',
          telegramUserId: ctx.from.id,
          telegramChatId: ctx.chat.id,
          telegramUpdateId: ctx.update.update_id,
          payload: {
            update: ctx.update as unknown as Record<string, unknown>,
          },
        });
      } catch (error) {
        this.logger.error('Failed to enqueue Telegram message job', error);
        await ctx.reply('The queue is temporarily unavailable. Try again later.');
        return;
      }

      await ctx.reply('Your request has been queued.');
    });
  }
}
