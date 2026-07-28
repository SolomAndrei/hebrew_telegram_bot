import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';

import type {
  TelegramChannelExtractorPort,
  TelegramChannelPost,
} from '../ports/telegram-channel-extractor.port';

@Injectable()
export class TelegramWebChannelExtractorAdapter
  implements TelegramChannelExtractorPort
{
  async getLatestPosts(
    channelRef: string,
    limit: number,
  ): Promise<TelegramChannelPost[]> {
    const channelName = this.normalizeChannelRef(channelRef);
    const response = await fetch(`https://t.me/s/${channelName}`, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent':
          'Mozilla/5.0 compatible HebrewReaderBot/1.0 channel extractor',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Telegram channel: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);
    const posts = $('.tgme_widget_message')
      .toArray()
      .map((element) => {
        const message = $(element);
        const id = String(message.attr('data-post') ?? '');
        const text = this.normalizeText(
          message.find('.tgme_widget_message_text').text(),
        );
        const publishedAt =
          message.find('time').first().attr('datetime') ?? undefined;

        return {
          id,
          text,
          publishedAt,
        };
      })
      .filter((post) => post.id && post.text);

    return posts.slice(-limit).reverse();
  }

  private normalizeChannelRef(channelRef: string): string {
    const channelName = channelRef.replace(/^@/, '').trim();

    if (!/^[a-zA-Z][\w\d_]{4,}$/.test(channelName)) {
      throw new Error('Invalid Telegram channel reference');
    }

    return channelName;
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
