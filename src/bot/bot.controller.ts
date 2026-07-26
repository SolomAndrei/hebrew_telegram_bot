import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Env } from '../config/env.schema';
import { BotService } from './bot.service';

@Controller('telegram')
export class BotController {
  constructor(
    @Inject(BotService) private readonly botService: BotService,
    @Inject(ConfigService)
    private readonly configService: ConfigService<Env, true>,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() update: unknown,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
  ) {
    const expectedSecret = this.configService.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });

    if (!expectedSecret || secretToken !== expectedSecret) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    await this.botService.handleUpdate(update);

    return { ok: true };
  }
}
