import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Env } from '../config/env.schema';

@Injectable()
export class TelegramAccessService {
  private readonly allowedTelegramIds: Set<number>;

  constructor(@Inject(ConfigService) configService: ConfigService<Env, true>) {
    this.allowedTelegramIds = new Set(
      configService
        .get('ALLOWED_TELEGRAM_IDS', { infer: true })
        .split(',')
        .map((telegramId) => Number(telegramId.trim())),
    );
  }

  isAllowedTelegramId(telegramId: number): boolean {
    return this.allowedTelegramIds.has(telegramId);
  }
}
