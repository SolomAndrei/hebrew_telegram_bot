import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
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
    private readonly telegramAccessService: TelegramAccessService,
    private readonly rateLimitService: RateLimitService,
    private readonly jobsService: JobsService,
    private readonly defaultRssService: DefaultRssService,
    private readonly sourceClassifierService: SourceClassifierService,
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

  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text);
  }

  async sendArticleReply(input: {
    chatId: number;
    title: string;
    text: string;
    articleId: string;
    articleUrl?: string;
  }): Promise<void> {
    const message = this.formatArticleReply(
      input.title,
      input.text,
      input.articleId,
      input.articleUrl,
    );

    if (!input.articleUrl) {
      await this.sendMessage(input.chatId, message);
      return;
    }

    await this.bot.api.sendMessage(input.chatId, message, {
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
        'Welcome. Send Hebrew text, a news link, or /news.',
      );
    });

    this.bot.command('news', async (ctx) => {
      if (!ctx.from || !ctx.chat) {
        return;
      }

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
          await ctx.reply(
            `Daily adaptation limit reached (${budget.used}/${budget.limit}). Try again tomorrow.`,
          );
          return;
        }

        await this.jobsService.enqueueTelegramJob({
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
      } catch (error) {
        this.logger.error('Failed to enqueue default RSS news job', error);
        await ctx.reply('The queue is temporarily unavailable. Try again later.');
        return;
      }

      await ctx.reply(`Latest news from ${item.sourceName} has been queued.`);
    });

    this.bot.on('message', async (ctx) => {
      if (!ctx.from || !ctx.chat) {
        return;
      }

      const text = ctx.message?.text;

      if (!text) {
        await ctx.reply(
          'Unsupported message type. Send Hebrew text, a URL, or a public Telegram channel link.',
        );
        return;
      }

      const source = this.sourceClassifierService.classify(text);

      if (source.type === 'unsupported') {
        await ctx.reply(this.getUnsupportedSourceMessage(source.reason));
        return;
      }

      try {
        const budget = await this.jobsService.checkDailyLlmJobBudget(
          ctx.from.id,
        );

        if (!budget.allowed) {
          await ctx.reply(
            `Daily adaptation limit reached (${budget.used}/${budget.limit}). Try again tomorrow.`,
          );
          return;
        }

        await this.jobsService.enqueueTelegramJob({
          type: this.getJobType(source),
          telegramUserId: ctx.from.id,
          telegramChatId: ctx.chat.id,
          telegramUpdateId: ctx.update.update_id,
          payload: {
            source,
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

  private formatArticleReply(
    title: string,
    text: string,
    articleId: string,
    articleUrl?: string,
  ): string {
    const maxTextLength = 3000;
    const visibleText =
      text.length > maxTextLength
        ? `${text.slice(0, maxTextLength)}...`
        : text;
    const articleReference = articleUrl
      ? `Open in Mini App: ${articleUrl}`
      : `Article ID: ${articleId}`;

    return `${title}\n\n${visibleText}\n\n${articleReference}`;
  }
}
