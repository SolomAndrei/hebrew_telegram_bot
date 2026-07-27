import { Module } from '@nestjs/common';

import { OpenAiWordAnalysisAdapter } from './adapters/openai-word-analysis.adapter';
import { WORD_ANALYSIS_PORT } from './ports/word-analysis.port';

@Module({
  providers: [
    {
      provide: WORD_ANALYSIS_PORT,
      useClass: OpenAiWordAnalysisAdapter,
    },
  ],
  exports: [WORD_ANALYSIS_PORT],
})
export class AiModule {}
