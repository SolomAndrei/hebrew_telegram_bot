import type { ArticleToken } from '../../mini-app/mini-app-api.contracts';

export const ARTICLES_REPOSITORY_PORT = Symbol('ARTICLES_REPOSITORY_PORT');

export type SaveAdaptedArticleInput = {
  userId: string;
  sourceType: 'raw_text' | 'url' | 'telegram_channel';
  sourceUrl?: string;
  originalText: string;
  originalSummary: string;
  adaptedText: string;
  readingTokens: ArticleToken[];
  difficultyScore: number;
  isValidated: boolean;
};

export type SavedArticle = {
  id: string;
  adaptedText: string;
};

export type ArticleForReading = {
  id: string;
  difficultyScore: number;
  tokens: ArticleToken[];
};

export interface ArticlesRepositoryPort {
  saveAdaptedArticle(input: SaveAdaptedArticleInput): Promise<SavedArticle>;
  findArticleForReadingByUserId(
    articleId: string,
    userId: string,
  ): Promise<ArticleForReading | null>;
}
