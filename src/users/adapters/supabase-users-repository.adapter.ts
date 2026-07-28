import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../database/supabase.service';
import type {
  LearningWord,
  SaveReadingStatsInput,
  UpdateLearningWordExposuresInput,
  UpsertLearningWordInput,
  User,
  UsersRepositoryPort,
} from '../ports/users-repository.port';

type UserRow = {
  id: string;
  telegram_id: number;
  current_level_score: number;
};

type LearningWordRow = {
  lemma: string;
};

type ExistingLearningWordRow = {
  translation_requests: number;
};

type LearningWordExposureRow = {
  lemma: string;
  successful_exposures: number;
};

@Injectable()
export class SupabaseUsersRepositoryAdapter implements UsersRepositoryPort {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findOrCreateByTelegramId(telegramId: number): Promise<User> {
    const { data, error } = await this.supabaseService.client
      .from('users')
      .upsert(
        {
          telegram_id: telegramId,
        },
        {
          onConflict: 'telegram_id',
        },
      )
      .select('id, telegram_id, current_level_score')
      .single<UserRow>();

    if (error) {
      throw error;
    }

    return this.toUser(data);
  }

  async getProfileByTelegramId(telegramId: number): Promise<User> {
    return this.findOrCreateByTelegramId(telegramId);
  }

  async getLearningWords(userId: string): Promise<LearningWord[]> {
    const { data, error } = await this.supabaseService.client
      .from('user_words')
      .select('lemma')
      .eq('user_id', userId)
      .eq('status', 'learning')
      .returns<LearningWordRow[]>();

    if (error) {
      throw error;
    }

    return data.map((row) => ({
      lemma: row.lemma,
    }));
  }

  async getLearningWordsCount(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService.client
      .from('user_words')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', userId)
      .eq('status', 'learning');

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async upsertLearningWord(input: UpsertLearningWordInput): Promise<void> {
    const { data: existing, error: selectError } =
      await this.supabaseService.client
        .from('user_words')
        .select('translation_requests')
        .eq('user_id', input.userId)
        .eq('lemma', input.lemma)
        .maybeSingle<ExistingLearningWordRow>();

    if (selectError) {
      throw selectError;
    }

    const { error } = await this.supabaseService.client
      .from('user_words')
      .upsert(
        {
          user_id: input.userId,
          lemma: input.lemma,
          original_word: input.originalWord,
          part_of_speech: input.partOfSpeech,
          status: 'learning',
          translation_requests: (existing?.translation_requests ?? 0) + 1,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,lemma',
        },
      );

    if (error) {
      throw error;
    }
  }

  async updateLearningWordExposures(
    input: UpdateLearningWordExposuresInput,
  ): Promise<void> {
    if (input.lemmas.length === 0) {
      return;
    }

    const { data, error } = await this.supabaseService.client
      .from('user_words')
      .select('lemma, successful_exposures')
      .eq('user_id', input.userId)
      .eq('status', 'learning')
      .in('lemma', input.lemmas)
      .returns<LearningWordExposureRow[]>();

    if (error) {
      throw error;
    }

    await Promise.all(
      data.map(async (row) => {
        const successfulExposures = row.successful_exposures + 1;
        const { error: updateError } = await this.supabaseService.client
          .from('user_words')
          .update({
            successful_exposures: successfulExposures,
            status: successfulExposures >= 10 ? 'mastered' : 'learning',
            last_seen_at: new Date().toISOString(),
          })
          .eq('user_id', input.userId)
          .eq('lemma', row.lemma);

        if (updateError) {
          throw updateError;
        }
      }),
    );
  }

  async saveReadingStats(input: SaveReadingStatsInput): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('reading_stats')
      .insert({
        user_id: input.userId,
        article_id: input.articleId,
        generated_words_count: input.generatedWordsCount,
        translation_requests_count: input.translationRequestsCount,
      });

    if (error) {
      throw error;
    }
  }

  async updateLevelByTelegramId(
    telegramId: number,
    currentLevelScore: number,
  ): Promise<User> {
    await this.findOrCreateByTelegramId(telegramId);

    const { data, error } = await this.supabaseService.client
      .from('users')
      .update({
        current_level_score: currentLevelScore,
      })
      .eq('telegram_id', telegramId)
      .select('id, telegram_id, current_level_score')
      .single<UserRow>();

    if (error) {
      throw error;
    }

    return this.toUser(data);
  }

  private toUser(row: UserRow): User {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      currentLevelScore: row.current_level_score,
    };
  }
}
