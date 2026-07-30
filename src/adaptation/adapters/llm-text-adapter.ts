import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { Env } from '../../config/env.schema';
import { parseLlmJsonResponse } from '../../llm/llm-json-response';
import { LlmProviderService } from '../../llm/llm-provider.service';
import type {
  AdaptRawTextInput,
  AdaptedTextDraft,
  EnrichedTextForReading,
  EnrichTextForReadingInput,
  TextAdapterPort,
  ValidateAdaptationInput,
  ValidationResult,
} from '../ports/text-adapter.port';

const adaptedTextSchema = z.object({
  original_summary: z.string(),
  adapted_text: z.string(),
  vocabulary_used: z.array(z.string()).default([]),
});

const readingTokenSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('word'),
    id: z.string(),
    text: z.string(),
    pointedText: z.string(),
    translationRu: z.string(),
    lemma: z.string(),
  }),
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
]);

const enrichedTextSchema = z.object({
  tokens: z.array(readingTokenSchema),
});

const validationSchema = z.object({
  is_valid: z.boolean(),
  reason: z.string(),
});

type AdaptedTextResponse = z.infer<typeof adaptedTextSchema>;
type EnrichedTextResponse = z.infer<typeof enrichedTextSchema>;
type ValidationResponse = z.infer<typeof validationSchema>;

@Injectable()
export class LlmTextAdapter implements TextAdapterPort {
  private readonly model: string | undefined;

  constructor(
    @Inject(LlmProviderService)
    private readonly llmProvider: LlmProviderService,
    @Inject(ConfigService) configService: ConfigService<Env, true>,
  ) {
    this.model = configService.get('LLM_ADAPTATION_MODEL', { infer: true });
  }

  async adaptRawText(input: AdaptRawTextInput): Promise<AdaptedTextDraft> {
    const system =
      'You adapt Hebrew texts for language learners. Return only valid JSON.';
    const prompt = [
      `Rewrite the Hebrew text for learner level MMR=${input.userLevelScore}.`,
      'Preserve all core facts. Do not invent facts.',
      'Write Hebrew without niqqud.',
      'Use learning words only when they fit the meaning naturally.',
      `Learning words: ${input.learningWords.join(', ') || 'none'}.`,
      'Return JSON with keys: original_summary, adapted_text, vocabulary_used.',
      `Text: ${input.rawText}`,
    ].join('\n');
    const object = await this.generateAdaptedText(system, prompt);

    return {
      originalSummary: object.original_summary,
      adaptedText: object.adapted_text,
      vocabularyUsed: object.vocabulary_used,
    };
  }

  async enrichTextForReading(
    input: EnrichTextForReadingInput,
  ): Promise<EnrichedTextForReading> {
    const system =
      'You prepare adapted Hebrew text for an interactive language-learning reader. Return only valid JSON.';
    const prompt = [
      'Split the adapted Hebrew text into ordered tokens.',
      'Preserve every word, space, punctuation mark, and newline in the original order.',
      'For Hebrew word tokens, return type="word", a stable id, text, pointedText, translationRu, and lemma.',
      'The text field must be the original unpointed token exactly as it appears in the input.',
      'The pointedText field must be the same token with niqqud.',
      'The translationRu field must be a short Russian translation in this sentence context.',
      'The lemma field must be a useful Hebrew dictionary lemma without niqqud.',
      'For punctuation, spaces, and newlines, return type="text" and text only.',
      'Do not add transcription, part of speech, alternatives, grammar notes, or explanations.',
      'Return JSON with key: tokens.',
      `Adapted text: ${input.adaptedText}`,
    ].join('\n');
    const object = await this.generateEnrichedText(system, prompt);
    const reconstructedText = object.tokens
      .map((token) => token.text)
      .join('');

    if (reconstructedText !== input.adaptedText) {
      throw new Error('Enriched reading tokens do not preserve adapted text');
    }

    return {
      tokens: object.tokens,
    };
  }

  async validateAdaptation(
    input: ValidateAdaptationInput,
  ): Promise<ValidationResult> {
    const system = 'You validate Hebrew text adaptations. Return only valid JSON.';
    const prompt = [
      'Compare the original Hebrew text and adapted Hebrew text.',
      'Check whether the main facts are preserved.',
      'Check that there are no hallucinations.',
      'Check that the Hebrew is grammatically correct.',
      'Return JSON with keys: is_valid, reason.',
      `Original: ${input.originalText}`,
      `Adapted: ${input.adaptedText}`,
    ].join('\n');
    const object = await this.generateValidation(system, prompt);

    return {
      isValid: object.is_valid,
      reason: object.reason,
    };
  }

  private getModel() {
    if (!this.model) {
      throw new Error('LLM_ADAPTATION_MODEL is required for adaptation');
    }

    return this.llmProvider.getChatModel(this.model);
  }

  private async generateAdaptedText(
    system: string,
    prompt: string,
  ): Promise<AdaptedTextResponse> {
    if (this.llmProvider.getOutputMode() === 'json_schema') {
      const { object } = await generateObject({
        model: this.getModel(),
        schema: adaptedTextSchema,
        system,
        prompt,
      });

      return object;
    }

    return this.generateJsonObject(
      system,
      prompt,
      adaptedTextSchema,
      'Adaptation',
    );
  }

  private async generateEnrichedText(
    system: string,
    prompt: string,
  ): Promise<EnrichedTextResponse> {
    if (this.llmProvider.getOutputMode() === 'json_schema') {
      const { object } = await generateObject({
        model: this.getModel(),
        schema: enrichedTextSchema,
        system,
        prompt,
      });

      return object;
    }

    return this.generateJsonObject(
      system,
      prompt,
      enrichedTextSchema,
      'Reading token enrichment',
    );
  }

  private async generateValidation(
    system: string,
    prompt: string,
  ): Promise<ValidationResponse> {
    if (this.llmProvider.getOutputMode() === 'json_schema') {
      const { object } = await generateObject({
        model: this.getModel(),
        schema: validationSchema,
        system,
        prompt,
      });

      return object;
    }

    return this.generateJsonObject(
      system,
      prompt,
      validationSchema,
      'Adaptation validation',
    );
  }

  private async generateJsonObject<T>(
    system: string,
    prompt: string,
    schema: z.ZodType<T>,
    context: string,
  ): Promise<T> {
    const { text } = await generateText({
      model: this.getModel(),
      system,
      prompt: [
        prompt,
        'Return only one valid JSON object. Do not include markdown fences, explanations, or extra text.',
      ].join('\n'),
    });

    return parseLlmJsonResponse(text, schema, context);
  }
}
