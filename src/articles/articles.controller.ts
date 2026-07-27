import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import type { ArticleForReadingResponse } from '../mini-app/mini-app-api.contracts';
import { CurrentTelegramUser } from '../telegram-auth/current-telegram-user.decorator';
import type { TelegramMiniAppUser } from '../telegram-auth/telegram-mini-app-user';
import { TelegramInitDataGuard } from '../telegram-auth/telegram-init-data.guard';
import { UsersService } from '../users/users.service';
import { ArticlesService } from './articles.service';

@Controller('articles')
@UseGuards(TelegramInitDataGuard)
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':id')
  async getArticleForReading(
    @CurrentTelegramUser() telegramUser: TelegramMiniAppUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) articleId: string,
  ): Promise<ArticleForReadingResponse> {
    const user = await this.usersService.findOrCreateByTelegramId(
      telegramUser.id,
    );

    return this.articlesService.getArticleForReading(user.id, articleId);
  }
}
