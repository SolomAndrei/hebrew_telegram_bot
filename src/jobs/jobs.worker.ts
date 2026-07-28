import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import {
  AdaptationService,
  AdaptationValidationFailedError,
} from '../adaptation/adaptation.service';
import { ArticlesService } from '../articles/articles.service';
import type {
  SaveAdaptedArticleInput,
  SavedArticle,
} from '../articles/ports/articles-repository.port';
import { BotService } from '../bot/bot.service';
import { Env } from '../config/env.schema';
import { HebrewTextValidatorService } from '../sources/hebrew-text-validator.service';
import {
  TELEGRAM_CHANNEL_EXTRACTOR_PORT,
  TelegramChannelExtractorPort,
  TelegramChannelPost,
} from '../sources/ports/telegram-channel-extractor.port';
import {
  URL_CONTENT_EXTRACTOR_PORT,
  UrlContentExtractorPort,
} from '../sources/ports/url-content-extractor.port';
import { SourceTextNormalizerService } from '../sources/source-text-normalizer.service';
import type { User } from '../users/ports/users-repository.port';
import { UsersService } from '../users/users.service';
import { JobsService } from './jobs.service';
import type { QueuedJob } from './ports/job-queue.port';

@Injectable()
export class JobsWorker {
  private readonly enabled: boolean;
  private readonly publicMiniAppUrl: string | undefined;
  private readonly logger = new Logger(JobsWorker.name);
  private isProcessing = false;

  constructor(
    private readonly jobsService: JobsService,
    private readonly usersService: UsersService,
    private readonly articlesService: ArticlesService,
    private readonly adaptationService: AdaptationService,
    private readonly hebrewTextValidator: HebrewTextValidatorService,
    @Inject(URL_CONTENT_EXTRACTOR_PORT)
    private readonly urlContentExtractor: UrlContentExtractorPort,
    @Inject(TELEGRAM_CHANNEL_EXTRACTOR_PORT)
    private readonly telegramChannelExtractor: TelegramChannelExtractorPort,
    private readonly sourceTextNormalizer: SourceTextNormalizerService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(ConfigService)
    configService: ConfigService<Env, true>,
  ) {
    this.enabled = configService.get('JOBS_WORKER_ENABLED', { infer: true });
    this.publicMiniAppUrl =
      configService.get('PUBLIC_MINI_APP_URL', { infer: true }) ??
      configService.get('PUBLIC_API_URL', { infer: true });
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
      if (job && error instanceof AdaptationValidationFailedError) {
        await this.handleAdaptationValidationFailure(job, error);
        return;
      }

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
        await this.handleUrlJob(job);
        return;

      case 'source_telegram_channel':
        await this.handleTelegramChannelJob(job);
        return;
    }
  }

  private async handleRawTextJob(job: QueuedJob): Promise<void> {
    const rawText = this.getRawTextFromJob(job);
    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );
    const article = await this.adaptAndSaveArticle({
      user,
      rawText,
      sourceType: 'raw_text',
    });

    await this.sendAdaptedArticleReply(job.telegramChatId, article);
  }

  private async handleTelegramChannelJob(job: QueuedJob): Promise<void> {
    const channelRef = this.getTelegramChannelRefFromJob(job);
    let posts: TelegramChannelPost[];

    try {
      posts = await this.telegramChannelExtractor.getLatestPosts(channelRef, 5);
    } catch (error) {
      this.logger.warn(
        `Failed to extract Telegram channel ${channelRef}: ${this.getErrorMessage(error)}`,
      );
      await this.botService.sendMessage(
        job.telegramChatId,
        'Could not read this public Telegram channel. Send a public channel username or link.',
      );
      return;
    }

    const post = posts.find((candidate) =>
      this.hebrewTextValidator.isProbablyHebrew(candidate.text),
    );

    if (!post) {
      await this.botService.sendMessage(
        job.telegramChatId,
        'No recent Hebrew posts were found in this channel.',
      );
      return;
    }

    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );
    const article = await this.adaptAndSaveArticle({
      user,
      rawText: post.text,
      sourceType: 'telegram_channel',
      sourceUrl: this.buildTelegramPostUrl(post.id),
    });

    await this.sendAdaptedArticleReply(job.telegramChatId, article);
  }

  private async handleUrlJob(job: QueuedJob): Promise<void> {
    const url = this.getUrlFromJob(job);
    const extracted = await this.urlContentExtractor.extract(url);
    const rawText = extracted.title
      ? `${extracted.title}\n\n${extracted.text}`
      : extracted.text;

    if (!this.hebrewTextValidator.isProbablyHebrew(rawText)) {
      await this.botService.sendMessage(
        job.telegramChatId,
        'Extracted content does not look like Hebrew. Send a Hebrew article URL.',
      );
      return;
    }

    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );
    const article = await this.adaptAndSaveArticle({
      user,
      rawText,
      sourceType: 'url',
      sourceUrl: extracted.url,
    });

    await this.sendAdaptedArticleReply(job.telegramChatId, article);
  }

  private async adaptAndSaveArticle(input: {
    user: User;
    rawText: string;
    sourceType: SaveAdaptedArticleInput['sourceType'];
    sourceUrl?: string;
  }): Promise<SavedArticle> {
    const normalizedRawText = this.sourceTextNormalizer.normalize(input.rawText);

    if (!normalizedRawText) {
      throw new Error('Source text normalization returned empty text');
    }

    const learningWords = await this.usersService.getLearningWords(input.user.id);
    const adapted = await this.adaptationService.adaptRawText({
      rawText: normalizedRawText,
      userLevelScore: input.user.currentLevelScore,
      learningWords: learningWords.map((word) => word.lemma),
    });

    return this.articlesService.saveAdaptedArticle({
      userId: input.user.id,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      originalText: normalizedRawText,
      originalSummary: adapted.originalSummary,
      adaptedTitle: adapted.adaptedTitle,
      adaptedText: adapted.adaptedText,
      difficultyScore: input.user.currentLevelScore,
      isValidated: adapted.isValidated,
    });
  }

  private async handleAdaptationValidationFailure(
    job: QueuedJob,
    error: AdaptationValidationFailedError,
  ): Promise<void> {
    this.logger.warn(error.message);

    try {
      await this.botService.sendMessage(
        job.telegramChatId,
        'I could not adapt this text safely. Try a shorter Hebrew text or another source.',
      );
      await this.jobsService.complete(job.id);
    } catch (replyError) {
      this.logger.error(
        'Failed to handle adaptation validation failure',
        replyError,
      );
      await this.jobsService.fail(job.id, this.getErrorMessage(replyError));
    }
  }

  private async sendAdaptedArticleReply(
    chatId: number,
    article: SavedArticle,
  ): Promise<void> {
    await this.botService.sendArticleReply({
      chatId,
      title: article.adaptedTitle,
      text: article.adaptedText,
      articleId: article.id,
      articleUrl: this.buildMiniAppArticleUrl(article.id),
    });
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

  private getUrlFromJob(job: QueuedJob): string {
    const source = job.payload.source;

    if (
      !this.isRecord(source) ||
      source.type !== 'url' ||
      typeof source.url !== 'string'
    ) {
      throw new Error('Invalid source_url job payload');
    }

    return source.url;
  }

  private getTelegramChannelRefFromJob(job: QueuedJob): string {
    const source = job.payload.source;

    if (
      !this.isRecord(source) ||
      source.type !== 'telegram_channel' ||
      typeof source.channelRef !== 'string'
    ) {
      throw new Error('Invalid source_telegram_channel job payload');
    }

    return source.channelRef;
  }

  private buildMiniAppArticleUrl(articleId: string): string | undefined {
    if (!this.publicMiniAppUrl) {
      return undefined;
    }

    const baseUrl = this.publicMiniAppUrl.replace(/\/$/, '');

    return `${baseUrl}/articles/${articleId}`;
  }

  private buildTelegramPostUrl(postId: string): string | undefined {
    return postId ? `https://t.me/${postId}` : undefined;
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
