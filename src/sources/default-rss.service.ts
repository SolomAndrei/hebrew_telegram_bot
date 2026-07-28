import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

import { DEFAULT_RSS_SOURCES, DefaultRssSource } from './default-rss-sources';

type ParsedRssItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
};

export type DefaultRssItem = {
  sourceName: string;
  title: string;
  url: string;
  publishedAt?: string;
};

@Injectable()
export class DefaultRssService {
  private readonly logger = new Logger(DefaultRssService.name);
  private readonly parser = new Parser<Record<string, never>, ParsedRssItem>();

  async getLatestItem(): Promise<DefaultRssItem> {
    const [item] = await this.getLatestItems(1);

    if (item) {
      return item;
    }

    throw new Error('No valid RSS news items found');
  }

  async getLatestItems(limit: number): Promise<DefaultRssItem[]> {
    const items: DefaultRssItem[] = [];

    for (const source of DEFAULT_RSS_SOURCES) {
      items.push(...(await this.getLatestItemsFromSource(source)));
    }

    return items
      .sort((left, right) => {
        return (
          this.getPublishedAtTimestamp(right.publishedAt) -
          this.getPublishedAtTimestamp(left.publishedAt)
        );
      })
      .slice(0, limit);
  }

  private async getLatestItemsFromSource(
    source: DefaultRssSource,
  ): Promise<DefaultRssItem[]> {
    try {
      const feed = await this.parser.parseURL(source.url);

      return feed.items
        .map((item) => this.toDefaultRssItem(source, item))
        .filter((item): item is DefaultRssItem => Boolean(item));
    } catch (error) {
      this.logger.warn(
        `Failed to fetch RSS source ${source.name}: ${this.getErrorMessage(error)}`,
      );
      return [];
    }
  }

  private toDefaultRssItem(
    source: DefaultRssSource,
    item: ParsedRssItem,
  ): DefaultRssItem | undefined {
    const url = this.toHttpUrl(item.link);

    if (!url) {
      return undefined;
    }

    return {
      sourceName: source.name,
      title: item.title?.trim() || source.name,
      url,
      publishedAt: item.isoDate ?? item.pubDate,
    };
  }

  private toHttpUrl(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const url = new URL(value);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return undefined;
      }

      return url.toString();
    } catch {
      return undefined;
    }
  }

  private getPublishedAtTimestamp(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
