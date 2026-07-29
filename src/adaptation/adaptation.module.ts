import { Module } from '@nestjs/common';

import { LlmProviderService } from '../llm/llm-provider.service';
import { LlmTextAdapter } from './adapters/llm-text-adapter';
import { AdaptationService } from './adaptation.service';
import { TEXT_ADAPTER_PORT } from './ports/text-adapter.port';

@Module({
  providers: [
    AdaptationService,
    LlmProviderService,
    {
      provide: TEXT_ADAPTER_PORT,
      useClass: LlmTextAdapter,
    },
  ],
  exports: [AdaptationService],
})
export class AdaptationModule {}
