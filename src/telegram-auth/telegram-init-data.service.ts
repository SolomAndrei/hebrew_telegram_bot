import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TelegramAccessService } from '../access/telegram-access.service';
import { Env } from '../config/env.schema';
import type { TelegramMiniAppUser } from './telegram-mini-app-user';

type TelegramInitDataUserPayload = {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  username?: unknown;
  language_code?: unknown;
  is_premium?: unknown;
  allows_write_to_pm?: unknown;
};

@Injectable()
export class TelegramInitDataService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<Env, true>,
    @Inject(TelegramAccessService)
    private readonly telegramAccessService: TelegramAccessService,
  ) {}

  validate(initData: string): TelegramMiniAppUser {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');

    if (!receivedHash) {
      throw new UnauthorizedException('Invalid Telegram Mini App init data');
    }

    params.delete('hash');

    if (!this.hasValidSignature(params, receivedHash)) {
      throw new UnauthorizedException('Invalid Telegram Mini App init data');
    }

    const user = this.parseUser(params.get('user'));

    if (!this.telegramAccessService.isAllowedTelegramId(user.id)) {
      throw new UnauthorizedException('Telegram user is not allowed');
    }

    return user;
  }

  private hasValidSignature(
    params: URLSearchParams,
    receivedHash: string,
  ): boolean {
    if (!/^[a-f0-9]{64}$/i.test(receivedHash)) {
      return false;
    }

    const dataCheckString = Array.from(params.entries())
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const botToken = this.configService.get('BOT_TOKEN', { infer: true });
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return timingSafeEqual(
      Buffer.from(calculatedHash, 'hex'),
      Buffer.from(receivedHash, 'hex'),
    );
  }

  private parseUser(userJson: string | null): TelegramMiniAppUser {
    if (!userJson) {
      throw new UnauthorizedException('Telegram Mini App user is missing');
    }

    let payload: TelegramInitDataUserPayload;

    try {
      payload = JSON.parse(userJson) as TelegramInitDataUserPayload;
    } catch {
      throw new UnauthorizedException('Invalid Telegram Mini App user');
    }

    if (typeof payload.id !== 'number') {
      throw new UnauthorizedException('Invalid Telegram Mini App user');
    }

    return {
      id: payload.id,
      firstName: this.optionalString(payload.first_name),
      lastName: this.optionalString(payload.last_name),
      username: this.optionalString(payload.username),
      languageCode: this.optionalString(payload.language_code),
      isPremium: this.optionalBoolean(payload.is_premium),
      allowsWriteToPm: this.optionalBoolean(payload.allows_write_to_pm),
    };
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private optionalBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }
}
