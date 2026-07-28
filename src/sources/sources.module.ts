import { Module } from '@nestjs/common';

import { CheerioUrlContentExtractorAdapter } from './adapters/cheerio-url-content-extractor.adapter';
import { TelegramWebChannelExtractorAdapter } from './adapters/telegram-web-channel-extractor.adapter';
import { DefaultRssService } from './default-rss.service';
import { HebrewTextValidatorService } from './hebrew-text-validator.service';
import { TELEGRAM_CHANNEL_EXTRACTOR_PORT } from './ports/telegram-channel-extractor.port';
import { URL_CONTENT_EXTRACTOR_PORT } from './ports/url-content-extractor.port';
import { SourceTextNormalizerService } from './source-text-normalizer.service';
import { SourceClassifierService } from './source-classifier.service';

@Module({
  providers: [
    DefaultRssService,
    HebrewTextValidatorService,
    SourceClassifierService,
    SourceTextNormalizerService,
    {
      provide: URL_CONTENT_EXTRACTOR_PORT,
      useClass: CheerioUrlContentExtractorAdapter,
    },
    {
      provide: TELEGRAM_CHANNEL_EXTRACTOR_PORT,
      useClass: TelegramWebChannelExtractorAdapter,
    },
  ],
  exports: [
    DefaultRssService,
    HebrewTextValidatorService,
    SourceClassifierService,
    SourceTextNormalizerService,
    TELEGRAM_CHANNEL_EXTRACTOR_PORT,
    URL_CONTENT_EXTRACTOR_PORT,
  ],
})
export class SourcesModule {}
