export const ARTICLES_REPOSITORY_PORT = Symbol('ARTICLES_REPOSITORY_PORT');

export type SaveAdaptedArticleInput = {
  userId: string;
  sourceType: 'raw_text' | 'url' | 'telegram_channel';
  sourceUrl?: string;
  originalText: string;
  originalSummary: string;
  adaptedTitle: string;
  adaptedText: string;
  difficultyScore: number;
  isValidated: boolean;
};

export type SavedArticle = {
  id: string;
  adaptedTitle: string;
  adaptedText: string;
};

export type ArticleForReading = {
  id: string;
  title: string;
  adaptedText: string;
  difficultyScore: number;
};

export interface ArticlesRepositoryPort {
  saveAdaptedArticle(input: SaveAdaptedArticleInput): Promise<SavedArticle>;
  findArticleForReadingByUserId(
    articleId: string,
    userId: string,
  ): Promise<ArticleForReading | null>;
}
