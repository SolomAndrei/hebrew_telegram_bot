import { Module } from '@nestjs/common';

import { LlmProviderService } from '../llm/llm-provider.service';
import { LlmWordAnalysisAdapter } from './adapters/llm-word-analysis.adapter';
import { WORD_ANALYSIS_PORT } from './ports/word-analysis.port';

@Module({
  providers: [
    LlmProviderService,
    {
      provide: WORD_ANALYSIS_PORT,
      useClass: LlmWordAnalysisAdapter,
    },
  ],
  exports: [WORD_ANALYSIS_PORT],
})
export class AiModule {}
