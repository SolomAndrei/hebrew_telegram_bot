import { Module } from '@nestjs/common';

import { OpenAiTextAdapter } from './adapters/openai-text-adapter';
import { AdaptationService } from './adaptation.service';
import { TEXT_ADAPTER_PORT } from './ports/text-adapter.port';

@Module({
  providers: [
    AdaptationService,
    {
      provide: TEXT_ADAPTER_PORT,
      useClass: OpenAiTextAdapter,
    },
  ],
  exports: [AdaptationService],
})
export class AdaptationModule {}
