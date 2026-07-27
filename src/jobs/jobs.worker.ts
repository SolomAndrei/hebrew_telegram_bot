import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import { AdaptationService } from '../adaptation/adaptation.service';
import { ArticlesService } from '../articles/articles.service';
import { BotService } from '../bot/bot.service';
import { Env } from '../config/env.schema';
import { UsersService } from '../users/users.service';
import { JobsService } from './jobs.service';
import type { QueuedJob } from './ports/job-queue.port';

@Injectable()
export class JobsWorker {
  private readonly enabled: boolean;
  private readonly publicApiUrl: string | undefined;
  private readonly logger = new Logger(JobsWorker.name);
  private isProcessing = false;

  constructor(
    private readonly jobsService: JobsService,
    private readonly usersService: UsersService,
    private readonly articlesService: ArticlesService,
    private readonly adaptationService: AdaptationService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(ConfigService)
    configService: ConfigService<Env, true>,
  ) {
    this.enabled = configService.get('JOBS_WORKER_ENABLED', { infer: true });
    this.publicApiUrl = configService.get('PUBLIC_API_URL', { infer: true });
  }

  @Interval(2_000)
  async processNextJob(): Promise<void> {
    if (!this.enabled || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    let job: QueuedJob | null = null;

    try {
      job = await this.jobsService.claimNext();

      if (!job) {
        return;
      }

      await this.handleJob(job);
      await this.jobsService.complete(job.id);
    } catch (error) {
      this.logger.error('Failed to process job', error);

      if (job) {
        await this.jobsService.fail(job.id, this.getErrorMessage(error));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleJob(job: QueuedJob): Promise<void> {
    switch (job.type) {
      case 'source_raw_text':
        await this.handleRawTextJob(job);
        return;

      case 'source_url':
      case 'source_telegram_channel':
        await this.botService.sendMessage(
          job.telegramChatId,
          'This source type is queued, but extraction is not connected yet.',
        );
        return;
    }
  }

  private async handleRawTextJob(job: QueuedJob): Promise<void> {
    const rawText = this.getRawTextFromJob(job);
    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );
    const learningWords = await this.usersService.getLearningWords(user.id);
    const adapted = await this.adaptationService.adaptRawText({
      rawText,
      userLevelScore: user.currentLevelScore,
      learningWords: learningWords.map((word) => word.lemma),
    });
    const article = await this.articlesService.saveAdaptedArticle({
      userId: user.id,
      sourceType: 'raw_text',
      originalText: rawText,
      originalSummary: adapted.originalSummary,
      adaptedTitle: adapted.adaptedTitle,
      adaptedText: adapted.adaptedText,
      difficultyScore: user.currentLevelScore,
      isValidated: adapted.isValidated,
    });

    await this.botService.sendMessage(
      job.telegramChatId,
      this.formatAdaptedArticleReply(
        article.adaptedTitle,
        article.adaptedText,
        article.id,
      ),
    );
  }

  private getRawTextFromJob(job: QueuedJob): string {
    const source = job.payload.source;

    if (
      !this.isRecord(source) ||
      source.type !== 'raw_hebrew_text' ||
      typeof source.text !== 'string'
    ) {
      throw new Error('Invalid source_raw_text job payload');
    }

    return source.text;
  }

  private formatAdaptedArticleReply(
    title: string,
    text: string,
    articleId: string,
  ): string {
    const maxTextLength = 3000;
    const visibleText =
      text.length > maxTextLength
        ? `${text.slice(0, maxTextLength)}...`
        : text;
    const articleReference = this.buildArticleReference(articleId);

    return `${title}\n\n${visibleText}\n\n${articleReference}`;
  }

  private buildArticleReference(articleId: string): string {
    if (!this.publicApiUrl) {
      return `Article ID: ${articleId}`;
    }

    const baseUrl = this.publicApiUrl.replace(/\/$/, '');

    return `Open in Mini App: ${baseUrl}/articles/${articleId}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
