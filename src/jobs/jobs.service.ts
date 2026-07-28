import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Env } from '../config/env.schema';
import {
  EnqueueTelegramJobInput,
  EnqueuedJob,
  JOB_QUEUE_PORT,
  JobType,
  JobQueuePort,
  QueuedJob,
} from './ports/job-queue.port';

const LLM_HEAVY_JOB_TYPES: JobType[] = [
  'source_raw_text',
  'source_url',
  'source_telegram_channel',
];

export type DailyLlmJobBudget = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
};

@Injectable()
export class JobsService {
  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly jobQueue: JobQueuePort,
    @Inject(ConfigService)
    private readonly configService: ConfigService<Env, true>,
  ) {}

  enqueueTelegramJob(input: EnqueueTelegramJobInput): Promise<EnqueuedJob> {
    return this.jobQueue.enqueue(input);
  }

  async checkDailyLlmJobBudget(
    telegramUserId: number,
  ): Promise<DailyLlmJobBudget> {
    const limit = this.configService.get('TELEGRAM_DAILY_LLM_JOB_LIMIT', {
      infer: true,
    });
    const used = await this.jobQueue.countTelegramJobsCreatedSince({
      telegramUserId,
      jobTypes: LLM_HEAVY_JOB_TYPES,
      createdAfter: this.getUtcDayStart(new Date()),
    });

    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
    };
  }

  claimNext(): Promise<QueuedJob | null> {
    return this.jobQueue.claimNext();
  }

  complete(jobId: string): Promise<void> {
    return this.jobQueue.complete(jobId);
  }

  fail(jobId: string, error: string): Promise<void> {
    return this.jobQueue.fail(jobId, error);
  }

  private getUtcDayStart(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
}
