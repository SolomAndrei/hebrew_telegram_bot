import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ArticleForReadingResponse } from '../mini-app/mini-app-api.contracts';
import {
  ARTICLES_REPOSITORY_PORT,
  ArticlesRepositoryPort,
  SaveAdaptedArticleInput,
  SavedArticle,
} from './ports/articles-repository.port';

@Injectable()
export class ArticlesService {
  constructor(
    @Inject(ARTICLES_REPOSITORY_PORT)
    private readonly articlesRepository: ArticlesRepositoryPort,
  ) {}

  saveAdaptedArticle(
    input: SaveAdaptedArticleInput,
  ): Promise<SavedArticle> {
    return this.articlesRepository.saveAdaptedArticle(input);
  }

  async getArticleForReading(
    userId: string,
    articleId: string,
  ): Promise<ArticleForReadingResponse> {
    const article = await this.articlesRepository.findArticleForReadingByUserId(
      articleId,
      userId,
    );

    if (!article) {
      throw new NotFoundException('Article was not found');
    }

    return article;
  }
}
