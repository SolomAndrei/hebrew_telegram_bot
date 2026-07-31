import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';

import { RateLimitService } from '../access/rate-limit.service';
import { TelegramAccessService } from '../access/telegram-access.service';
import { Env } from '../config/env.schema';
import { JobsService } from '../jobs/jobs.service';
import { DefaultRssService } from '../sources/default-rss.service';
import type { JobType } from '../jobs/ports/job-queue.port';
import { SourceClassifierService } from '../sources/source-classifier.service';
import type { SubmittedSource } from '../sources/source.types';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly bot: Bot;
  private readonly botMode: Env['TELEGRAM_BOT_MODE'];
  private readonly logger = new Logger(BotService.name);

  constructor(
    @Inject(ConfigService) configService: ConfigService<Env, true>,
    @Inject(TelegramAccessService)
    private readonly telegramAccessService: TelegramAccessService,
    @Inject(RateLimitService)
    private readonly rateLimitService: RateLimitService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    @Inject(DefaultRssService)
    private readonly defaultRssService: DefaultRssService,
    @Inject(SourceClassifierService)
    private readonly sourceClassifierService: SourceClassifierService,
  ) {
    this.bot = new Bot(configService.get('BOT_TOKEN', { infer: true }));
    this.botMode = configService.get('TELEGRAM_BOT_MODE', { infer: true });
    this.registerHandlers();
  }

  async onModuleInit(): Promise<void> {
    if (this.botMode === 'webhook') {
      await this.bot.init();
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

  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text);
  }

  async sendArticleReply(input: {
    chatId: number;
    articleId: string;
    articleUrl?: string;
  }): Promise<void> {
    if (!input.articleUrl) {
      await this.sendMessage(
        input.chatId,
        `Article is ready. ID: ${input.articleId}`,
      );
      return;
    }

    // Telegram requires message text; keep it short and put the Mini App behind the button.
    await this.bot.api.sendMessage(input.chatId, 'Article is ready.', {
      reply_markup: new InlineKeyboard().webApp(
        'Open in Mini App',
        input.articleUrl,
      ),
    });
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
        this.logger.warn(
          `Telegram access denied: telegramUserId=${telegramId ?? 'unknown'} updateId=${ctx.update.update_id}`,
        );
        await ctx.reply('Access denied.');
        return;
      }

      const rateLimit = this.rateLimitService.checkTelegramUser(telegramId);

      if (!rateLimit.allowed) {
        this.logger.warn(
          `Telegram rate limited: telegramUserId=${telegramId} retryAfterSeconds=${rateLimit.retryAfterSeconds}`,
        );
        await ctx.reply(
          `Too many messages. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        );
        return;
      }

      await next();
    });

    this.bot.command('start', async (ctx) => {
      this.logger.log(
        `Command /start: telegramUserId=${ctx.from?.id} chatId=${ctx.chat?.id}`,
      );
      await ctx.reply(
        'Welcome. Send Hebrew text, a news link, or /news.',
      );
    });

    this.bot.command('news', async (ctx) => {
      if (!ctx.from || !ctx.chat) {
        return;
      }

      this.logger.log(
        `Command /news: telegramUserId=${ctx.from.id} chatId=${ctx.chat.id} updateId=${ctx.update.update_id}`,
      );

      let item: Awaited<ReturnType<DefaultRssService['getLatestItem']>>;

      try {
        item = await this.defaultRssService.getLatestItem();
      } catch (error) {
        this.logger.warn('Failed to fetch default RSS news item', error);
        await ctx.reply('Could not fetch news right now. Try again later.');
        return;
      }

      try {
        const budget = await this.jobsService.checkDailyLlmJobBudget(
          ctx.from.id,
        );

        if (!budget.allowed) {
          this.logger.warn(
            `Daily LLM budget reached: telegramUserId=${ctx.from.id} used=${budget.used}/${budget.limit}`,
          );
          await ctx.reply(
            `Daily adaptation limit reached (${budget.used}/${budget.limit}). Try again tomorrow.`,
          );
          return;
        }

        this.logger.log(
          `Enqueueing /news job: telegramUserId=${ctx.from.id} sourceType=url urlHost=${this.safeHost(item.url)}`,
        );

        const job = await this.jobsService.enqueueTelegramJob({
          type: 'source_url',
          telegramUserId: ctx.from.id,
          telegramChatId: ctx.chat.id,
          telegramUpdateId: ctx.update.update_id,
          payload: {
            source: {
              type: 'url',
              url: item.url,
            },
            rssItem: item,
            update: ctx.update as unknown as Record<string, unknown>,
          },
        });

        this.logger.log(
          `Job enqueued: jobId=${job.id} type=source_url telegramUserId=${ctx.from.id}`,
        );
      } catch (error) {
        this.logger.error('Failed to enqueue default RSS news job', error);
        await ctx.reply('The queue is temporarily unavailable. Try again later.');
        return;
      }

      await ctx.reply(
        `Request received from ${item.sourceName}. Starting processing...`,
      );
    });

    this.bot.on('message', async (ctx) => {
      if (!ctx.from || !ctx.chat) {
        return;
      }

      const text = ctx.message?.text;

      if (!text) {
        this.logger.log(
          `Unsupported message type: telegramUserId=${ctx.from.id} updateId=${ctx.update.update_id}`,
        );
        await ctx.reply(
          'Unsupported message type. Send Hebrew text, a URL, or a public Telegram channel link.',
        );
        return;
      }

      const source = this.sourceClassifierService.classify(text);

      this.logger.log(
        `Telegram message classified: telegramUserId=${ctx.from.id} updateId=${ctx.update.update_id} sourceType=${source.type} textLength=${text.length}`,
      );

      if (source.type === 'unsupported') {
        await ctx.reply(this.getUnsupportedSourceMessage(source.reason));
        return;
      }

      try {
        const budget = await this.jobsService.checkDailyLlmJobBudget(
          ctx.from.id,
        );

        if (!budget.allowed) {
          this.logger.warn(
            `Daily LLM budget reached: telegramUserId=${ctx.from.id} used=${budget.used}/${budget.limit}`,
          );
          await ctx.reply(
            `Daily adaptation limit reached (${budget.used}/${budget.limit}). Try again tomorrow.`,
          );
          return;
        }

        const jobType = this.getJobType(source);

        this.logger.log(
          `Enqueueing Telegram job: telegramUserId=${ctx.from.id} type=${jobType} sourceType=${source.type}`,
        );

        const job = await this.jobsService.enqueueTelegramJob({
          type: jobType,
          telegramUserId: ctx.from.id,
          telegramChatId: ctx.chat.id,
          telegramUpdateId: ctx.update.update_id,
          payload: {
            source,
            update: ctx.update as unknown as Record<string, unknown>,
          },
        });

        this.logger.log(
          `Job enqueued: jobId=${job.id} type=${jobType} telegramUserId=${ctx.from.id}`,
        );
      } catch (error) {
        this.logger.error('Failed to enqueue Telegram message job', error);
        await ctx.reply('The queue is temporarily unavailable. Try again later.');
        return;
      }

      await ctx.reply('Request received. Starting processing...');
    });
  }

  private getJobType(
    source: Exclude<SubmittedSource, { type: 'unsupported' }>,
  ): JobType {
    switch (source.type) {
      case 'raw_hebrew_text':
        return 'source_raw_text';
      case 'url':
        return 'source_url';
      case 'telegram_channel':
        return 'source_telegram_channel';
    }
  }

  private getUnsupportedSourceMessage(
    reason: Extract<SubmittedSource, { type: 'unsupported' }>['reason'],
  ): string {
    if (reason === 'non_hebrew_text') {
      return 'This does not look like Hebrew. Send Hebrew text, a URL, or a public Telegram channel link.';
    }

    return 'Send Hebrew text, a URL, or a public Telegram channel link.';
  }

  private safeHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'invalid-url';
    }
  }
}
