import { Inject, Injectable } from '@nestjs/common';

import { WORD_ANALYSIS_PORT } from '../ai/ports/word-analysis.port';
import type { WordAnalysisPort } from '../ai/ports/word-analysis.port';
import { ArticlesService } from '../articles/articles.service';
import type {
  TranslateWordRequest,
  TranslateWordResponse,
} from '../mini-app/mini-app-api.contracts';
import { UsersService } from '../users/users.service';

@Injectable()
export class TranslationService {
  constructor(
    @Inject(ArticlesService)
    private readonly articlesService: ArticlesService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(WORD_ANALYSIS_PORT)
    private readonly wordAnalysis: WordAnalysisPort,
  ) {}

  async translateWord(
    telegramId: number,
    request: TranslateWordRequest,
  ): Promise<TranslateWordResponse> {
    const user = await this.usersService.findOrCreateByTelegramId(telegramId);

    await this.articlesService.getArticleForReading(user.id, request.articleId);

    const analysis = await this.wordAnalysis.analyzeWord({
      word: request.word,
      sentenceContext: request.sentenceContext,
    });
    const learningWordsCount = await this.usersService.saveLearningWord({
      userId: user.id,
      lemma: analysis.lemma,
      originalWord: request.word,
      partOfSpeech: analysis.partOfSpeech,
    });

    return {
      ...analysis,
      learningWordsCount,
    };
  }
}
