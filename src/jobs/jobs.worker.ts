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
import {
  getErrorMessage,
  getErrorStatusCode,
  toUserFacingJobError,
} from './job-user-error';
import { JobsService } from './jobs.service';
import type { QueuedJob } from './ports/job-queue.port';

@Injectable()
export class JobsWorker {
  private readonly enabled: boolean;
  private readonly publicMiniAppUrl: string | undefined;
  private readonly logger = new Logger(JobsWorker.name);
  private isProcessing = false;

  constructor(
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ArticlesService))
    private readonly articlesService: ArticlesService,
    @Inject(forwardRef(() => AdaptationService))
    private readonly adaptationService: AdaptationService,
    @Inject(forwardRef(() => HebrewTextValidatorService))
    private readonly hebrewTextValidator: HebrewTextValidatorService,
    @Inject(URL_CONTENT_EXTRACTOR_PORT)
    private readonly urlContentExtractor: UrlContentExtractorPort,
    @Inject(TELEGRAM_CHANNEL_EXTRACTOR_PORT)
    private readonly telegramChannelExtractor: TelegramChannelExtractorPort,
    @Inject(forwardRef(() => SourceTextNormalizerService))
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
    const startedAt = Date.now();

    try {
      job = await this.jobsService.claimNext();

      if (!job) {
        return;
      }

      this.logger.log(
        `Job claimed: jobId=${job.id} type=${job.type} telegramUserId=${job.telegramUserId} chatId=${job.telegramChatId} attempt=${job.attempts}`,
      );

      await this.notifyUser(
        job.telegramChatId,
        this.getProcessingStartedMessage(job.type),
      );

      await this.handleJob(job);
      await this.jobsService.complete(job.id);

      this.logger.log(
        `Job completed: jobId=${job.id} type=${job.type} durationMs=${Date.now() - startedAt}`,
      );
    } catch (error) {
      if (job && error instanceof AdaptationValidationFailedError) {
        await this.handleAdaptationValidationFailure(job, error);
        return;
      }

      const errorMessage = getErrorMessage(error);
      const statusCode = getErrorStatusCode(error);

      this.logger.error(
        `Failed to process job: jobId=${job?.id ?? 'none'} type=${job?.type ?? 'none'} statusCode=${statusCode ?? 'n/a'} durationMs=${Date.now() - startedAt} error=${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (job) {
        const isFinalAttempt = job.attempts >= 3;

        await this.notifyUser(
          job.telegramChatId,
          isFinalAttempt
            ? toUserFacingJobError(error)
            : 'Temporary error while processing. Retrying...',
        );
        await this.jobsService.fail(job.id, errorMessage);
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

    this.logger.log(
      `Stage user_lookup: jobId=${job.id} telegramUserId=${job.telegramUserId}`,
    );
    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );

    const article = await this.adaptAndSaveArticle({
      jobId: job.id,
      chatId: job.telegramChatId,
      user,
      rawText,
      sourceType: 'raw_text',
    });

    await this.sendAdaptedArticleReply(job, article);
  }

  private async handleTelegramChannelJob(job: QueuedJob): Promise<void> {
    const channelRef = this.getTelegramChannelRefFromJob(job);

    this.logger.log(
      `Stage source_extraction: jobId=${job.id} source=telegram_channel channelRef=${channelRef}`,
    );
    await this.notifyUser(
      job.telegramChatId,
      'Reading the Telegram channel...',
    );

    let posts: TelegramChannelPost[];

    try {
      posts = await this.telegramChannelExtractor.getLatestPosts(channelRef, 5);
    } catch (error) {
      this.logger.warn(
        `Failed to extract Telegram channel ${channelRef}: ${getErrorMessage(error)}`,
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

    this.logger.log(
      `Stage source_extraction_done: jobId=${job.id} postsChecked=${posts.length} selectedPostLength=${post.text.length}`,
    );

    this.logger.log(
      `Stage user_lookup: jobId=${job.id} telegramUserId=${job.telegramUserId}`,
    );
    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );
    const article = await this.adaptAndSaveArticle({
      jobId: job.id,
      chatId: job.telegramChatId,
      user,
      rawText: post.text,
      sourceType: 'telegram_channel',
      sourceUrl: this.buildTelegramPostUrl(post.id),
    });

    await this.sendAdaptedArticleReply(job, article);
  }

  private async handleUrlJob(job: QueuedJob): Promise<void> {
    const url = this.getUrlFromJob(job);

    this.logger.log(
      `Stage source_extraction: jobId=${job.id} source=url host=${this.safeHost(url)}`,
    );
    await this.notifyUser(job.telegramChatId, 'Reading the article URL...');

    const extracted = await this.urlContentExtractor.extract(url);
    const rawText = extracted.title
      ? `${extracted.title}\n\n${extracted.text}`
      : extracted.text;

    this.logger.log(
      `Stage source_extraction_done: jobId=${job.id} textLength=${rawText.length} hasTitle=${Boolean(extracted.title)}`,
    );

    if (!this.hebrewTextValidator.isProbablyHebrew(rawText)) {
      await this.botService.sendMessage(
        job.telegramChatId,
        'Extracted content does not look like Hebrew. Send a Hebrew article URL.',
      );
      return;
    }

    this.logger.log(
      `Stage user_lookup: jobId=${job.id} telegramUserId=${job.telegramUserId}`,
    );
    const user = await this.usersService.findOrCreateByTelegramId(
      job.telegramUserId,
    );
    const article = await this.adaptAndSaveArticle({
      jobId: job.id,
      chatId: job.telegramChatId,
      user,
      rawText,
      sourceType: 'url',
      sourceUrl: extracted.url,
    });

    await this.sendAdaptedArticleReply(job, article);
  }

  private async adaptAndSaveArticle(input: {
    jobId: string;
    chatId: number;
    user: User;
    rawText: string;
    sourceType: SaveAdaptedArticleInput['sourceType'];
    sourceUrl?: string;
  }): Promise<SavedArticle> {
    const normalizedRawText = this.sourceTextNormalizer.normalize(input.rawText);

    if (!normalizedRawText) {
      throw new Error('Source text normalization returned empty text');
    }

    this.logger.log(
      `Stage normalize_source: jobId=${input.jobId} textLength=${normalizedRawText.length}`,
    );

    const learningWords = await this.usersService.getLearningWords(input.user.id);

    this.logger.log(
      `Stage llm_adaptation: jobId=${input.jobId} userLevel=${input.user.currentLevelScore} learningWords=${learningWords.length}`,
    );
    await this.notifyUser(
      input.chatId,
      'Adapting the text with LLM. This may take up to a minute...',
    );

    const adapted = await this.adaptationService.adaptRawText({
      rawText: normalizedRawText,
      userLevelScore: input.user.currentLevelScore,
      learningWords: learningWords.map((word) => word.lemma),
    });

    this.logger.log(
      `Stage llm_adaptation_done: jobId=${input.jobId} adaptedLength=${adapted.adaptedText.length} tokens=${adapted.tokens.length} isValidated=${adapted.isValidated}`,
    );

    this.logger.log(`Stage article_save: jobId=${input.jobId}`);
    const saved = await this.articlesService.saveAdaptedArticle({
      userId: input.user.id,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      originalText: normalizedRawText,
      originalSummary: adapted.originalSummary,
      adaptedText: adapted.adaptedText,
      readingTokens: adapted.tokens,
      difficultyScore: input.user.currentLevelScore,
      isValidated: adapted.isValidated,
    });

    this.logger.log(
      `Stage article_save_done: jobId=${input.jobId} articleId=${saved.id}`,
    );

    return saved;
  }

  private async handleAdaptationValidationFailure(
    job: QueuedJob,
    error: AdaptationValidationFailedError,
  ): Promise<void> {
    this.logger.warn(
      `Adaptation validation failed: jobId=${job.id} reason=${error.reason ?? 'none'}`,
    );

    try {
      await this.botService.sendMessage(
        job.telegramChatId,
        'I could not adapt this text safely. Try a shorter Hebrew text or another source.',
      );
      await this.jobsService.complete(job.id);
    } catch (replyError) {
      this.logger.error(
        `Failed to handle adaptation validation failure: jobId=${job.id} error=${getErrorMessage(replyError)}`,
        replyError instanceof Error ? replyError.stack : undefined,
      );
      await this.jobsService.fail(job.id, getErrorMessage(replyError));
    }
  }

  private async sendAdaptedArticleReply(
    job: QueuedJob,
    article: SavedArticle,
  ): Promise<void> {
    this.logger.log(
      `Stage telegram_reply: jobId=${job.id} articleId=${article.id}`,
    );

    await this.botService.sendArticleReply({
      chatId: job.telegramChatId,
      text: article.adaptedText,
      articleId: article.id,
      articleUrl: this.buildMiniAppArticleUrl(article.id),
    });

    this.logger.log(
      `Stage telegram_reply_done: jobId=${job.id} articleId=${article.id}`,
    );
  }

  private async notifyUser(chatId: number, text: string): Promise<void> {
    try {
      await this.botService.sendMessage(chatId, text);
    } catch (error) {
      this.logger.warn(
        `Failed to notify user chatId=${chatId}: ${getErrorMessage(error)}`,
      );
    }
  }

  private getProcessingStartedMessage(jobType: QueuedJob['type']): string {
    switch (jobType) {
      case 'source_raw_text':
        return 'Processing your Hebrew text...';
      case 'source_url':
        return 'Processing the article URL...';
      case 'source_telegram_channel':
        return 'Processing the Telegram channel...';
    }
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

  private safeHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return 'invalid-url';
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
