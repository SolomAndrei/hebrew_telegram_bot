import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  RequestWithTelegramMiniAppUser,
  TelegramMiniAppUser,
} from './telegram-mini-app-user';

export const CurrentTelegramUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TelegramMiniAppUser => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithTelegramMiniAppUser>();

    if (!request.telegramMiniAppUser) {
      throw new UnauthorizedException('Telegram Mini App user is missing');
    }

    return request.telegramMiniAppUser;
  },
);
