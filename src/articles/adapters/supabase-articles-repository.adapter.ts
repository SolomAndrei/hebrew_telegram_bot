import { Inject, Injectable } from '@nestjs/common';

import { SupabaseService } from '../../database/supabase.service';
import type { ArticleToken } from '../../mini-app/mini-app-api.contracts';
import type {
  ArticleForReading,
  ArticlesRepositoryPort,
  SaveAdaptedArticleInput,
  SavedArticle,
} from '../ports/articles-repository.port';

type ArticleRow = {
  id: string;
  adapted_text: string;
};

type ArticleForReadingRow = {
  id: string;
  difficulty_score: number;
  reading_tokens: unknown;
};

@Injectable()
export class SupabaseArticlesRepositoryAdapter
  implements ArticlesRepositoryPort
{
  constructor(
    @Inject(SupabaseService)
    private readonly supabaseService: SupabaseService,
  ) {}

  async saveAdaptedArticle(
    input: SaveAdaptedArticleInput,
  ): Promise<SavedArticle> {
    const { data, error } = await this.supabaseService.client
      .from('articles')
      .insert({
        user_id: input.userId,
        source_type: input.sourceType,
        source_url: input.sourceUrl,
        original_text: input.originalText,
        original_summary: input.originalSummary,
        adapted_title: '',
        adapted_text: input.adaptedText,
        reading_tokens: input.readingTokens,
        difficulty_score: input.difficultyScore,
        is_validated: input.isValidated,
      })
      .select('id, adapted_text')
      .single<ArticleRow>();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      adaptedText: data.adapted_text,
    };
  }

  async findArticleForReadingByUserId(
    articleId: string,
    userId: string,
  ): Promise<ArticleForReading | null> {
    const { data, error } = await this.supabaseService.client
      .from('articles')
      .select('id, difficulty_score, reading_tokens')
      .eq('id', articleId)
      .eq('user_id', userId)
      .maybeSingle<ArticleForReadingRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      difficultyScore: data.difficulty_score,
      tokens: this.toArticleTokens(data.reading_tokens),
    };
  }

  private toArticleTokens(value: unknown): ArticleToken[] {
    if (!Array.isArray(value)) {
      throw new Error('Article reading tokens are missing or invalid');
    }

    return value.map((token) => {
      if (!this.isRecord(token)) {
        throw new Error('Article reading token is invalid');
      }

      if (token.type === 'text' && typeof token.text === 'string') {
        return {
          type: 'text',
          text: token.text,
        };
      }

      if (
        token.type === 'word' &&
        typeof token.id === 'string' &&
        typeof token.text === 'string' &&
        typeof token.pointedText === 'string' &&
        typeof token.transcriptionRu === 'string' &&
        typeof token.translationRu === 'string' &&
        typeof token.lemma === 'string'
      ) {
        return {
          type: 'word',
          id: token.id,
          text: token.text,
          pointedText: token.pointedText,
          transcriptionRu: token.transcriptionRu,
          translationRu: token.translationRu,
          lemma: token.lemma,
        };
      }

      throw new Error('Article reading token has unsupported shape');
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
