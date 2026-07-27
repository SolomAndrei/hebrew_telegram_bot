import { Injectable } from '@nestjs/common';

import { ArticlesService } from '../articles/articles.service';
import type {
  FinishReadingSessionRequest,
  FinishReadingSessionResponse,
} from '../mini-app/mini-app-api.contracts';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReadingSessionsService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly usersService: UsersService,
  ) {}

  async finishReadingSession(
    telegramId: number,
    input: FinishReadingSessionRequest,
  ): Promise<FinishReadingSessionResponse> {
    const user = await this.usersService.findOrCreateByTelegramId(telegramId);

    await this.articlesService.getArticleForReading(user.id, input.articleId);

    return this.usersService.finishReadingSession(user, input);
  }
}
