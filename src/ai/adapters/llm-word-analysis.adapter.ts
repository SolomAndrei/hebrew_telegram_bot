import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { Env } from '../../config/env.schema';
import { parseLlmJsonResponse } from '../../llm/llm-json-response';
import { LlmProviderService } from '../../llm/llm-provider.service';
import type {
  AnalyzeWordInput,
  AnalyzeWordResult,
  WordAnalysisPort,
} from '../ports/word-analysis.port';

const wordAnalysisSchema = z.object({
  contextTranslationRu: z.string(),
  transcriptionRu: z.string(),
  lemma: z.string(),
  partOfSpeech: z.string(),
  baseFormReason: z.string(),
  alternatives: z.array(z.string()).default([]),
});

type WordAnalysisResponse = z.infer<typeof wordAnalysisSchema>;

@Injectable()
export class LlmWordAnalysisAdapter implements WordAnalysisPort {
  private readonly model: string | undefined;

  constructor(
    @Inject(LlmProviderService)
    private readonly llmProvider: LlmProviderService,
    @Inject(ConfigService) configService: ConfigService<Env, true>,
  ) {
    this.model = configService.get('LLM_WORD_ANALYSIS_MODEL', { infer: true });
  }

  async analyzeWord(input: AnalyzeWordInput): Promise<AnalyzeWordResult> {
    const system =
      'You analyze Hebrew words for language learners. Return only valid JSON.';
    const prompt = [
      'Analyze the selected Hebrew word in its sentence context.',
      'Return Russian translation and Russian phonetic transcription.',
      'Normalize the word to a useful dictionary lemma.',
      'Do not add facts that are not implied by the sentence.',
      'Return JSON with keys: contextTranslationRu, transcriptionRu, lemma, partOfSpeech, baseFormReason, alternatives.',
      `Word: ${input.word}`,
      `Sentence context: ${input.sentenceContext}`,
    ].join('\n');

    if (this.llmProvider.getOutputMode() === 'json_schema') {
      const { object } = await generateObject({
        model: this.getModel(),
        schema: wordAnalysisSchema,
        system,
        prompt,
      });

      return object;
    }

    return this.generateJsonObject(system, prompt);
  }

  private getModel() {
    if (!this.model) {
      throw new Error('LLM_WORD_ANALYSIS_MODEL is required for word analysis');
    }

    return this.llmProvider.getChatModel(this.model);
  }

  private async generateJsonObject(
    system: string,
    prompt: string,
  ): Promise<WordAnalysisResponse> {
    const { text } = await generateText({
      model: this.getModel(),
      system,
      prompt: [
        prompt,
        'Return only one valid JSON object. Do not include markdown fences, explanations, or extra text.',
      ].join('\n'),
    });

    return parseLlmJsonResponse(text, wordAnalysisSchema, 'Word analysis');
  }
}
