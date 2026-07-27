import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { RequestWithTelegramMiniAppUser } from './telegram-mini-app-user';
import { TelegramInitDataService } from './telegram-init-data.service';

@Injectable()
export class TelegramInitDataGuard implements CanActivate {
  constructor(private readonly telegramInitDataService: TelegramInitDataService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithTelegramMiniAppUser>();
    const initDataHeader = request.headers['x-telegram-init-data'];
    const initData = Array.isArray(initDataHeader)
      ? initDataHeader[0]
      : initDataHeader;

    if (!initData) {
      throw new UnauthorizedException('Missing Telegram Mini App init data');
    }

    request.telegramMiniAppUser =
      this.telegramInitDataService.validate(initData);

    return true;
  }
}
