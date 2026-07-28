import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';

import type {
  ExtractedUrlContent,
  UrlContentExtractorPort,
} from '../ports/url-content-extractor.port';

@Injectable()
export class CheerioUrlContentExtractorAdapter
  implements UrlContentExtractorPort
{
  async extract(url: string): Promise<ExtractedUrlContent> {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent':
          'Mozilla/5.0 compatible HebrewReaderBot/1.0 article extractor',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL content: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);

    $('script, style, noscript, nav, footer, header, aside, form').remove();

    const title = this.normalizeText(
      $('meta[property="og:title"]').attr('content') ??
        $('title').first().text(),
    );
    const contentRoot = this.pickContentRoot($);
    const blocks = contentRoot
      .find('h1, h2, h3, p, li')
      .toArray()
      .map((element) => this.normalizeText($(element).text()))
      .filter((text) => text.length >= 20);
    const text =
      blocks.length > 0
        ? blocks.join('\n\n')
        : this.normalizeText(contentRoot.text());

    if (!text) {
      throw new Error('URL content extraction returned empty text');
    }

    return {
      url,
      title: title || undefined,
      text,
    };
  }

  private pickContentRoot($: ReturnType<typeof load>) {
    const article = $('article').first();

    if (article.length > 0) {
      return article;
    }

    const main = $('main').first();

    if (main.length > 0) {
      return main;
    }

    return $('body').first();
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
