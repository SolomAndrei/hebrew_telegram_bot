import { Injectable } from '@nestjs/common';

import { SupabaseService } from '../../database/supabase.service';
import type {
  ArticleForReading,
  ArticlesRepositoryPort,
  SaveAdaptedArticleInput,
  SavedArticle,
} from '../ports/articles-repository.port';

type ArticleRow = {
  id: string;
  adapted_title: string;
  adapted_text: string;
};

type ArticleForReadingRow = ArticleRow & {
  difficulty_score: number;
};

@Injectable()
export class SupabaseArticlesRepositoryAdapter
  implements ArticlesRepositoryPort
{
  constructor(private readonly supabaseService: SupabaseService) {}

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
        adapted_title: input.adaptedTitle,
        adapted_text: input.adaptedText,
        difficulty_score: input.difficultyScore,
        is_validated: input.isValidated,
      })
      .select('id, adapted_title, adapted_text')
      .single<ArticleRow>();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      adaptedTitle: data.adapted_title,
      adaptedText: data.adapted_text,
    };
  }

  async findArticleForReadingByUserId(
    articleId: string,
    userId: string,
  ): Promise<ArticleForReading | null> {
    const { data, error } = await this.supabaseService.client
      .from('articles')
      .select('id, adapted_title, adapted_text, difficulty_score')
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
      title: data.adapted_title,
      adaptedText: data.adapted_text,
      difficultyScore: data.difficulty_score,
    };
  }
}
