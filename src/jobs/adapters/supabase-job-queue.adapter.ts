import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../database/supabase.service';
import {
  EnqueueTelegramJobInput,
  EnqueuedJob,
  JobQueuePort,
} from '../ports/job-queue.port';
import type { JobType, QueuedJob } from '../ports/job-queue.port';

type ClaimedJobRow = {
  id: string;
  type: JobType;
  telegram_user_id: number;
  telegram_chat_id: number;
  telegram_update_id: number;
  payload: Record<string, unknown>;
  attempts: number;
};

@Injectable()
export class SupabaseJobQueueAdapter implements JobQueuePort {
  constructor(private readonly supabaseService: SupabaseService) {}

  async enqueue(input: EnqueueTelegramJobInput): Promise<EnqueuedJob> {
    const { data, error } = await this.supabaseService.client
      .from('jobs')
      .upsert(
        {
          type: input.type,
          telegram_user_id: input.telegramUserId,
          telegram_chat_id: input.telegramChatId,
          telegram_update_id: input.telegramUpdateId,
          payload: input.payload,
        },
        {
          onConflict: 'telegram_update_id',
        },
      )
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id as string,
    };
  }

  async claimNext(): Promise<QueuedJob | null> {
    const { data, error } = await this.supabaseService.client
      .rpc('claim_next_job')
      .maybeSingle<ClaimedJobRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      type: data.type,
      telegramUserId: data.telegram_user_id,
      telegramChatId: data.telegram_chat_id,
      telegramUpdateId: data.telegram_update_id,
      payload: data.payload,
      attempts: data.attempts,
    };
  }

  async complete(jobId: string): Promise<void> {
    const { error } = await this.supabaseService.client.rpc('complete_job', {
      job_id: jobId,
    });

    if (error) {
      throw error;
    }
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabaseService.client.rpc('fail_job', {
      job_id: jobId,
      error_message: errorMessage,
    });

    if (error) {
      throw error;
    }
  }
}
