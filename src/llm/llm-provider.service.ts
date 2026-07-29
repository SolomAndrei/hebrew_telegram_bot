import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { Env } from '../config/env.schema';

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';

export type LlmOutputMode = Env['LLM_OUTPUT_MODE'];

@Injectable()
export class LlmProviderService {
  private readonly apiKey: string | undefined;
  private readonly outputMode: LlmOutputMode;
  private readonly provider: ReturnType<typeof createOpenAICompatible>;

  constructor(@Inject(ConfigService) configService: ConfigService<Env, true>) {
    this.apiKey = configService.get('LLM_API_KEY', { infer: true });
    this.outputMode = configService.get('LLM_OUTPUT_MODE', { infer: true });
    const baseURL =
      configService.get('LLM_BASE_URL', { infer: true }) ??
      DEFAULT_OPENAI_COMPATIBLE_BASE_URL;

    this.provider = createOpenAICompatible({
      name: 'configured-llm',
      apiKey: this.apiKey,
      baseURL,
      supportsStructuredOutputs: this.outputMode === 'json_schema',
    });
  }

  getChatModel(modelId: string) {
    if (!this.apiKey) {
      throw new Error('LLM_API_KEY is required');
    }

    return this.provider.chatModel(modelId);
  }

  getOutputMode(): LlmOutputMode {
    return this.outputMode;
  }
}
