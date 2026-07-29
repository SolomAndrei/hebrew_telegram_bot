import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, MinLength } from 'class-validator';

import type {
  TranslateWordRequest,
  TranslateWordResponse,
} from '../mini-app/mini-app-api.contracts';
import { CurrentTelegramUser } from '../telegram-auth/current-telegram-user.decorator';
import type { TelegramMiniAppUser } from '../telegram-auth/telegram-mini-app-user';
import { TelegramInitDataGuard } from '../telegram-auth/telegram-init-data.guard';
import { TranslationService } from './translation.service';

class TranslateWordDto implements TranslateWordRequest {
  @IsUUID()
  articleId!: string;

  @IsString()
  @MinLength(1)
  word!: string;

  @IsString()
  @MinLength(1)
  sentenceContext!: string;
}

@Controller('translate-word')
@UseGuards(TelegramInitDataGuard)
export class TranslationController {
  constructor(
    @Inject(TranslationService)
    private readonly translationService: TranslationService,
  ) {}

  @Post()
  translateWord(
    @CurrentTelegramUser() user: TelegramMiniAppUser,
    @Body() body: TranslateWordDto,
  ): Promise<TranslateWordResponse> {
    return this.translationService.translateWord(user.id, body);
  }
}
