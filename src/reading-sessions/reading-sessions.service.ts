import { Inject, Injectable } from '@nestjs/common';

import { ArticlesService } from '../articles/articles.service';
import type {
  FinishReadingSessionRequest,
  FinishReadingSessionResponse,
} from '../mini-app/mini-app-api.contracts';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReadingSessionsService {
  constructor(
    @Inject(ArticlesService)
    private readonly articlesService: ArticlesService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  async finishReadingSession(
    telegramId: number,
    input: FinishReadingSessionRequest,
  ): Promise<FinishReadingSessionResponse> {
    const user = await this.usersService.findOrCreateByTelegramId(telegramId);
    const article = await this.articlesService.getArticleForReading(
      user.id,
      input.articleId,
    );
    const result = await this.usersService.finishReadingSession(user, input);
    const learningWordsCount =
      await this.usersService.updateExposuresAfterReading(
        user.id,
        article.adaptedText,
        input.translatedLemmas,
      );

    return {
      ...result,
      learningWordsCount,
    };
  }
}
