import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';

import type {
  MeResponse,
  UpdateLevelRequest,
} from '../mini-app/mini-app-api.contracts';
import { CurrentTelegramUser } from '../telegram-auth/current-telegram-user.decorator';
import type { TelegramMiniAppUser } from '../telegram-auth/telegram-mini-app-user';
import { TelegramInitDataGuard } from '../telegram-auth/telegram-init-data.guard';
import {
  MAX_CURRENT_LEVEL_SCORE,
  MIN_CURRENT_LEVEL_SCORE,
  UsersService,
} from '../users/users.service';

class UpdateLevelDto implements UpdateLevelRequest {
  @IsInt()
  @Min(MIN_CURRENT_LEVEL_SCORE)
  @Max(MAX_CURRENT_LEVEL_SCORE)
  currentLevelScore!: number;
}

@Controller('me')
@UseGuards(TelegramInitDataGuard)
export class MeController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  getMe(@CurrentTelegramUser() user: TelegramMiniAppUser): Promise<MeResponse> {
    return this.usersService.getProfileByTelegramId(user.id);
  }

  @Patch('level')
  updateLevel(
    @CurrentTelegramUser() user: TelegramMiniAppUser,
    @Body() body: UpdateLevelDto,
  ): Promise<MeResponse> {
    return this.usersService.updateLevelByTelegramId(
      user.id,
      body.currentLevelScore,
    );
  }
}
