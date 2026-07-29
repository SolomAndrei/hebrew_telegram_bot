import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsString, IsUUID, Min } from 'class-validator';

import type {
  FinishReadingSessionRequest,
  FinishReadingSessionResponse,
} from '../mini-app/mini-app-api.contracts';
import { CurrentTelegramUser } from '../telegram-auth/current-telegram-user.decorator';
import type { TelegramMiniAppUser } from '../telegram-auth/telegram-mini-app-user';
import { TelegramInitDataGuard } from '../telegram-auth/telegram-init-data.guard';
import { ReadingSessionsService } from './reading-sessions.service';

class FinishReadingSessionDto implements FinishReadingSessionRequest {
  @IsUUID()
  articleId!: string;

  @IsInt()
  @Min(1)
  generatedWordsCount!: number;

  @IsInt()
  @Min(0)
  translationRequestsCount!: number;

  @IsArray()
  @IsString({ each: true })
  translatedLemmas!: string[];
}

@Controller('reading-sessions')
@UseGuards(TelegramInitDataGuard)
export class ReadingSessionsController {
  constructor(
    @Inject(ReadingSessionsService)
    private readonly readingSessionsService: ReadingSessionsService,
  ) {}

  @Post('finish')
  finishReadingSession(
    @CurrentTelegramUser() user: TelegramMiniAppUser,
    @Body() body: FinishReadingSessionDto,
  ): Promise<FinishReadingSessionResponse> {
    return this.readingSessionsService.finishReadingSession(user.id, body);
  }
}
