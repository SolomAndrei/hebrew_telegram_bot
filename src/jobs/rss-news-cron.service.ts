import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import { Env } from '../config/env.schema';
import { DefaultRssItem, DefaultRssService } from '../sources/default-rss.service';
import { JobsService } from './jobs.service';

const RSS_CRON_TICK_MS = 60_000;
const RSS_CRON_CANDIDATES_LIMIT = 10;

@Injectable()
export class RssNewsCronService {
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly targetTelegramId: number | undefined;
  private readonly targetChatId: number | undefined;
  private readonly logger = new Logger(RssNewsCronService.name);
  private hasLoggedMissingTarget = false;
  private isRunning = false;
  private nextRunAt = 0;

  constructor(
    private readonly defaultRssService: DefaultRssService,
    private readonly jobsService: JobsService,
    configService: ConfigService<Env, true>,
  ) {
    this.enabled = configService.get('RSS_CRON_ENABLED', { infer: true });
    this.intervalMs =
      configService.get('RSS_CRON_INTERVAL_MINUTES', { infer: true }) * 60_000;
    this.targetTelegramId = configService.get('RSS_CRON_TARGET_TELEGRAM_ID', {
      infer: true,
    });
    this.targetChatId = configService.get('RSS_CRON_TARGET_CHAT_ID', {
      infer: true,
    });
  }

  @Interval(RSS_CRON_TICK_MS)
  async enqueueLatestNews(): Promise<void> {
    if (!this.shouldRun()) {
      return;
    }

    if (!this.targetTelegramId || !this.targetChatId) {
      this.logMissingTargetOnce();
      return;
    }

    this.isRunning = true;

    try {
      const budget = await this.jobsService.checkDailyLlmJobBudget(
        this.targetTelegramId,
      );

      if (!budget.allowed) {
        this.logger.log(
          `RSS cron skipped because daily budget is exhausted (${budget.used}/${budget.limit})`,
        );
        return;
      }

      const items = await this.defaultRssService.getLatestItems(
        RSS_CRON_CANDIDATES_LIMIT,
      );

      for (const item of items) {
        const job = await this.jobsService.enqueueTelegramJob({
          type: 'source_url',
          telegramUserId: this.targetTelegramId,
          telegramChatId: this.targetChatId,
          deduplicationKey: this.buildDeduplicationKey(item),
          payload: {
            source: {
              type: 'url',
              url: item.url,
            },
            rssItem: item,
            automated: true,
          },
        });

        if (job.wasCreated) {
          this.logger.log(
            `RSS cron queued ${item.sourceName} item: ${item.url}`,
          );
          return;
        }
      }

      this.logger.log('RSS cron skipped because all candidate items are duplicates');
    } catch (error) {
      this.logger.error('RSS cron failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  private shouldRun(): boolean {
    if (!this.enabled || this.isRunning) {
      return false;
    }

    const now = Date.now();

    if (now < this.nextRunAt) {
      return false;
    }

    this.nextRunAt = now + this.intervalMs;
    return true;
  }

  private logMissingTargetOnce(): void {
    if (this.hasLoggedMissingTarget) {
      return;
    }

    this.logger.warn(
      'RSS cron is enabled but target Telegram ID or chat ID is missing',
    );
    this.hasLoggedMissingTarget = true;
  }

  private buildDeduplicationKey(item: DefaultRssItem): string {
    return `rss:${item.url}`;
  }
}
