import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Env } from '../config/env.schema';
import { BotService } from './bot.service';

@Controller('telegram')
export class BotController {
  private readonly logger = new Logger(BotController.name);

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
      this.logger.warn(
        `Telegram webhook rejected: invalid secret (updateId=${this.getUpdateId(update)})`,
      );
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    this.logger.log(
      `Telegram webhook received: updateId=${this.getUpdateId(update)} type=${this.getUpdateType(update)}`,
    );

    await this.botService.handleUpdate(update);

    return { ok: true };
  }

  private getUpdateId(update: unknown): string {
    if (
      typeof update === 'object' &&
      update !== null &&
      'update_id' in update &&
      typeof update.update_id === 'number'
    ) {
      return String(update.update_id);
    }

    return 'unknown';
  }

  private getUpdateType(update: unknown): string {
    if (typeof update !== 'object' || update === null) {
      return 'unknown';
    }

    if ('message' in update) {
      return 'message';
    }

    if ('edited_message' in update) {
      return 'edited_message';
    }

    if ('callback_query' in update) {
      return 'callback_query';
    }

    if ('inline_query' in update) {
      return 'inline_query';
    }

    return 'other';
  }
}
