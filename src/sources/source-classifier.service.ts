import { Injectable } from '@nestjs/common';

import { HebrewTextValidatorService } from './hebrew-text-validator.service';
import { SubmittedSource } from './source.types';

@Injectable()
export class SourceClassifierService {
  constructor(
    private readonly hebrewTextValidator: HebrewTextValidatorService,
  ) {}

  classify(rawInput: string): SubmittedSource {
    const input = rawInput.trim();

    if (!input) {
      return {
        type: 'unsupported',
        reason: 'empty',
      };
    }

    const telegramChannelRef = this.parseTelegramChannelRef(input);

    if (telegramChannelRef) {
      return {
        type: 'telegram_channel',
        channelRef: telegramChannelRef,
      };
    }

    const url = this.parseUrl(input);

    if (url) {
      return {
        type: 'url',
        url,
      };
    }

    if (this.hebrewTextValidator.isProbablyHebrew(input)) {
      return {
        type: 'raw_hebrew_text',
        text: input,
      };
    }

    return {
      type: 'unsupported',
      reason: 'non_hebrew_text',
    };
  }

  private parseUrl(input: string): string | undefined {
    try {
      const url = new URL(input);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return undefined;
      }

      return url.toString();
    } catch {
      return undefined;
    }
  }

  private parseTelegramChannelRef(input: string): string | undefined {
    if (/^@[a-zA-Z][\w\d_]{4,}$/.test(input)) {
      return input;
    }

    const url = this.parseUrl(input);

    if (!url) {
      return undefined;
    }

    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== 't.me' && parsedUrl.hostname !== 'telegram.me') {
      return undefined;
    }

    const [channelName] = parsedUrl.pathname.split('/').filter(Boolean);

    if (!channelName || channelName === 'c') {
      return undefined;
    }

    return `@${channelName}`;
  }
}
