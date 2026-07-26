import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../database/supabase.service';
import {
  EnqueueTelegramJobInput,
  EnqueuedJob,
  JobQueuePort,
} from '../ports/job-queue.port';

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
}
